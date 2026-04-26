import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@clerk/nextjs";
import { useMuninnApi } from "@/hooks/useMuninnApi";
import { getApiBaseUrl } from "@/lib/muninn-api";
import { useJobReportViewer } from "@/hooks/useJobReportViewer";
import type { EnrollmentRow, IProgram, StudentRow } from "@/lib/types";
import { emitReportCompleted, emitReportFailed, emitReportStarted } from "@/lib/event";
import type { AnalysisProgress, Job } from "@/components/generate-report/types";
import { isJobTerminalStatus } from "@/components/generate-report/utils";

const idleProgress: AnalysisProgress = { stage: "idle", message: "", activeAgents: [] };

const POLL_MS = 2000;

function zipEnrollmentToJobIds(enrollmentIds: string[], jobIds: string[]): Map<string, string> {
  const m = new Map<string, string>();
  enrollmentIds.forEach((eid, i) => {
    const jid = jobIds[i];
    if (eid && jid) m.set(eid, jid);
  });
  return m;
}

export function useGenerateReport() {
  const router = useRouter();
  const { getToken } = useAuth();
  const api = useMuninnApi();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [programs, setPrograms] = useState<IProgram[] | null>(null);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [allEnrollments, setAllEnrollments] = useState<EnrollmentRow[] | null>(null);
  const [enrollmentContextError, setEnrollmentContextError] = useState<string | null>(null);
  const [isGenerating, setisGenerating] = useState(false);
  /** Bumps when a new run starts so the poll effect re-subscribes after `activeRunByEnrollment` is set. */
  const [pollSession, setPollSession] = useState(0);
  /** Enrollments in the last started batch (cleared when the batch finishes) — for row-level “generating” UI. */
  const [enrollmentIdsInActiveRun, setEnrollmentIdsInActiveRun] = useState<string[] | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress>(idleProgress);
  const { reportView, openViewReport, closeViewReport } = useJobReportViewer();

  /** When non-null, we poll until every job in this map reaches a terminal status. */
  const activeRunByEnrollment = useRef<Map<string, string> | null>(null);

  const enrollmentIdsFromQuery = useMemo((): string[] => {
    if (!router.isReady) return [];
    const q = router.query.enrollment_id;
    if (q == null || q === "") return [];
    if (Array.isArray(q)) return q.map(String);
    return [String(q)];
  }, [router.isReady, router.query.enrollment_id]);

  const fetchJobsList = useCallback(async (): Promise<Job[]> => {
    const token = await getToken();
    if (!token || enrollmentIdsFromQuery.length === 0) return [];
    const params = new URLSearchParams();
    for (const id of enrollmentIdsFromQuery) {
      params.append("enrollment_ids", id);
    }
    const response = await fetch(`${getApiBaseUrl()}/api/jobs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { jobs?: Job[] };
    return data.jobs ?? [];
  }, [enrollmentIdsFromQuery, getToken]);

  const fetchJobs = useCallback(async () => {
    try {
      const list = await fetchJobsList();
      setJobs(list);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
  }, [fetchJobsList]);

  useEffect(() => {
    if (!router.isReady) return;
    void fetchJobs();
  }, [router.isReady, fetchJobs]);

  const loadEnrollmentTableContext = useCallback(async () => {
    if (enrollmentIdsFromQuery.length === 0) {
      setPrograms(null);
      setStudents(null);
      setAllEnrollments(null);
      return;
    }
    setEnrollmentContextError(null);
    try {
      const [e, p, s] = await Promise.all([
        api.listEnrollments(enrollmentIdsFromQuery),
        api.listPrograms(),
        api.listStudents(),
      ]);
      setAllEnrollments(e);
      setPrograms(p);
      setStudents(s);
    } catch (err) {
      setEnrollmentContextError(
        err instanceof Error ? err.message : "Could not load enrollment details",
      );
      setAllEnrollments([]);
      setPrograms([]);
      setStudents([]);
    }
  }, [api, enrollmentIdsFromQuery]);

  useEffect(() => {
    if (!router.isReady) return;
    void loadEnrollmentTableContext();
  }, [router.isReady, loadEnrollmentTableContext]);

  const enrollmentTableRows = useMemo(() => {
    if (enrollmentIdsFromQuery.length === 0) return [];
    if (allEnrollments === null || programs === null || students === null) return null;
    const progById = new Map(programs.map((p) => [p.id, p]));
    const stuById = new Map(students.map((s) => [s.id, s]));
    const enrById = new Map(allEnrollments.map((e) => [e.id, e]));
    return enrollmentIdsFromQuery.map((eid) => {
      const enr = enrById.get(eid);
      if (!enr) {
        return { enrollmentId: eid, programName: "—", studentName: "—" };
      }
      const prog = progById.get(enr.program_id);
      const stu = stuById.get(enr.student_id);
      return {
        enrollmentId: eid,
        programName: prog?.name ?? "—",
        studentName: stu?.student_name ?? "—",
      };
    });
  }, [enrollmentIdsFromQuery, allEnrollments, programs, students]);

  const latestJobByEnrollmentId = useMemo(() => {
    const m = new Map<string, Job>();
    for (const j of jobs) {
      const eid = j.enrollment_id;
      if (!eid) continue;
      const prev = m.get(eid);
      if (!prev || new Date(j.created_at) > new Date(prev.created_at)) {
        m.set(eid, j);
      }
    }
    return m;
  }, [jobs]);

  const completedJobByEnrollmentId = useMemo(() => {
    const m = new Map<string, Job>();
    for (const j of jobs) {
      if (j.status !== "completed" || !j.enrollment_id) continue;
      const eid = j.enrollment_id;
      const prev = m.get(eid);
      if (!prev || new Date(j.created_at) > new Date(prev.created_at)) {
        m.set(eid, j);
      }
    }
    return m;
  }, [jobs]);

  const completeBatchPoll = useCallback(
    (runMap: Map<string, string>, list: Job[]) => {
      const failedJob = [...runMap]
        .map(([, id]) => list.find((x) => x.id === id))
        .find((j) => j?.status === "failed");
      activeRunByEnrollment.current = null;
      setEnrollmentIdsInActiveRun(null);
      setisGenerating(false);
      if (failedJob) {
        const err =
          (failedJob as { error_message?: string }).error_message || "One or more reports failed.";
        setProgress({ stage: "error", message: "Report generation failed", activeAgents: [], error: err });
        emitReportFailed(failedJob.id, err);
        return;
      }
      setProgress({ stage: "complete", message: "All reports are ready.", activeAgents: [] });
      const anyId = runMap.values().next().value;
      if (typeof anyId === "string") emitReportCompleted(anyId);
    },
    [],
  );

  const pollActiveRun = useCallback(async () => {
    const runMap = activeRunByEnrollment.current;
    if (!runMap?.size) return;

    const list = await fetchJobsList();
    setJobs(list);

    let allTerminal = true;
    for (const jobId of runMap.values()) {
      const j = list.find((x) => x.id === jobId);
      if (!j || !isJobTerminalStatus(j.status)) {
        allTerminal = false;
        break;
      }
    }
    if (!allTerminal) return;
    completeBatchPoll(runMap, list);
  }, [fetchJobsList, completeBatchPoll]);

  const startReportGeneration = useCallback(async () => {
    if (enrollmentIdsFromQuery.length === 0) {
      setProgress({
        stage: "error",
        message: "No enrollments selected",
        activeAgents: [],
        error:
          "Select one or more enrollments on the program page and choose Generate report, or open this page with ?enrollment_id=… in the URL.",
      });
      return;
    }

    setisGenerating(true);
    setProgress({
      stage: "starting",
      message: "Initializing report generation...",
      activeAgents: [],
    });

    try {
      const token = await getToken();
      const response = await fetch(`${getApiBaseUrl()}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          enrollment_ids: enrollmentIdsFromQuery,
          analysis_type: "generate_report",
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Failed to start report generation");
      }

      const data = (await response.json()) as { job_ids: string[] };
      const jobIds = data.job_ids ?? [];
      if (jobIds.length === 0 || jobIds.length !== enrollmentIdsFromQuery.length) {
        throw new Error("Invalid response: missing job ids for enrollments");
      }

      const runMap = zipEnrollmentToJobIds(enrollmentIdsFromQuery, jobIds);
      activeRunByEnrollment.current = runMap;
      setEnrollmentIdsInActiveRun([...enrollmentIdsFromQuery]);
      setPollSession((n) => n + 1);

      const firstJobId = jobIds[0]!;
      emitReportStarted(firstJobId);
      setProgress({
        stage: "planner",
        message: "Report jobs queued. Processing…",
        activeAgents: ["Report Generator"],
      });
      setTimeout(() => {
        setProgress((p) => (p.stage === "planner" ? { ...p, stage: "parallel", message: "Processing…" } : p));
      }, 2000);
      void fetchJobs();
    } catch (error) {
      console.error("Error starting report generation:", error);
      setProgress({
        stage: "error",
        message: "Failed to start report generation",
        activeAgents: [],
        error: error instanceof Error ? error.message : "Unknown error",
      });
      setisGenerating(false);
      activeRunByEnrollment.current = null;
      setEnrollmentIdsInActiveRun(null);
    }
  }, [enrollmentIdsFromQuery, getToken, fetchJobs]);

  useEffect(() => {
    if (!isGenerating) return;
    if (!activeRunByEnrollment.current?.size) return;
    void pollActiveRun();
    const id = setInterval(() => {
      void pollActiveRun();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [isGenerating, pollSession, pollActiveRun]);

  const resetProgressForRetry = useCallback(() => {
    setisGenerating(false);
    activeRunByEnrollment.current = null;
    setEnrollmentIdsInActiveRun(null);
    setProgress(idleProgress);
  }, []);

  return {
    router,
    isRouterReady: router.isReady,
    enrollmentIdsFromQuery,
    jobs,
    enrollmentContextError,
    enrollmentTableRows,
    latestJobByEnrollmentId,
    completedJobByEnrollmentId,
    isGenerating,
    progress,
    startReportGeneration,
    enrollmentIdsInActiveRun,
    resetProgressForRetry,
    reportView,
    openViewReport,
    closeViewReport,
  };
}
