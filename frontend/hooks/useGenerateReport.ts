import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@clerk/nextjs";
import { useMuninnApi } from "@/hooks/useMuninnApi";
import { getApiBaseUrl } from "@/lib/muninn-api";
import { useJobReportViewer } from "@/hooks/useJobReportViewer";
import type { EnrollmentRow, IProgram, StudentRow } from "@/lib/types";
import { emitReportCompleted, emitReportFailed, emitReportStarted } from "@/lib/event";
import type { AnalysisProgress, Job } from "@/components/generate-report/types";

const idleProgress: AnalysisProgress = { stage: "idle", message: "", activeAgents: [] };

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
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress>(idleProgress);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const pollEnrollmentIdRef = useRef<string | null>(null);
  const { reportView, openViewReport, closeViewReport } = useJobReportViewer();

  const enrollmentIdsFromQuery = useMemo((): string[] => {
    if (!router.isReady) return [];
    const q = router.query.enrollment_id;
    if (q == null || q === "") return [];
    if (Array.isArray(q)) return q.map(String);
    return [String(q)];
  }, [router.isReady, router.query.enrollment_id]);

  const fetchJobs = useCallback(async () => {
    try {
      const token = await getToken();
      if (enrollmentIdsFromQuery.length === 0) {
        setJobs([]);
        return;
      }
      const params = new URLSearchParams();
      for (const id of enrollmentIdsFromQuery) {
        params.append("enrollment_ids", id);
      }
      const response = await fetch(`${getApiBaseUrl()}/api/jobs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
  }, [enrollmentIdsFromQuery, getToken]);

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

  useEffect(() => {
    const checkJobStatusLocal = async (jobId: string) => {
      try {
        const enrollmentId = pollEnrollmentIdRef.current;
        if (!enrollmentId) {
          console.warn("No enrollment_id for job status poll");
          return;
        }
        const token = await getToken();
        const response = await fetch(
          `${getApiBaseUrl()}/api/jobs/${jobId}?enrollment_id=${encodeURIComponent(enrollmentId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (response.ok) {
          const job = await response.json();
          if (job.status === "completed") {
            setProgress({ stage: "complete", message: "Analysis complete!", activeAgents: [] });
            if (pollInterval) {
              clearInterval(pollInterval);
              setPollInterval(null);
            }
            emitReportCompleted(jobId);
            fetchJobs();
            pollEnrollmentIdRef.current = null;
            // setTimeout(() => {
            //   void router.push(`/analysis?job_id=${jobId}`);
            // }, 1500);
          } else if (job.status === "failed") {
            setProgress({
              stage: "error",
              message: "Analysis failed",
              activeAgents: [],
              error: job.error || "Analysis encountered an error",
            });
            if (pollInterval) {
              clearInterval(pollInterval);
              setPollInterval(null);
            }
            emitReportFailed(jobId, job.error);
            setisGenerating(false);
            setCurrentJobId(null);
            pollEnrollmentIdRef.current = null;
          }
        }
      } catch (error) {
        console.error("Error checking job status:", error);
      }
    };

    if (currentJobId && !pollInterval) {
      const interval = setInterval(() => {
        void checkJobStatusLocal(currentJobId);
      }, 2000);
      setPollInterval(interval);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJobId, pollInterval, router]);

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

      if (response.ok) {
        const data = (await response.json()) as { job_ids: string[] };
        const firstJobId = data.job_ids?.[0] ?? null;
        const firstEnrollmentId = enrollmentIdsFromQuery[0] ?? null;
        if (!firstJobId || !firstEnrollmentId) {
          throw new Error("Invalid response: missing job or enrollment");
        }
        pollEnrollmentIdRef.current = firstEnrollmentId;
        setCurrentJobId(firstJobId);
        emitReportStarted(firstJobId);
        setProgress({
          stage: "planner",
          message: "Report job queued. Coordinating...",
          activeAgents: ["Report Generator"],
        });
        setTimeout(() => {
          setProgress({ stage: "parallel", message: "Processing…", activeAgents: ["Report Generator"] });
        }, 2000);
        void fetchJobs();
      } else {
        const errText = await response.text();
        throw new Error(errText || "Failed to start report generation");
      }
    } catch (error) {
      console.error("Error starting report generation:", error);
      setProgress({
        stage: "error",
        message: "Failed to start report generation",
        activeAgents: [],
        error: error instanceof Error ? error.message : "Unknown error",
      });
      setisGenerating(false);
      setCurrentJobId(null);
      pollEnrollmentIdRef.current = null;
    }
  }, [enrollmentIdsFromQuery, getToken, fetchJobs]);

  // const isAgentActive = useCallback(
  //   (agentName: string) => progress.activeAgents.includes(agentName),
  //   [progress.activeAgents],
  // );

  const resetProgressForRetry = useCallback(() => {
    setisGenerating(false);
    setCurrentJobId(null);
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
    // isAgentActive,
    resetProgressForRetry,
    reportView,
    openViewReport,
    closeViewReport,
  };
}
