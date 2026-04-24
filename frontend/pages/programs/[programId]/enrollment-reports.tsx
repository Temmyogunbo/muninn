import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ReportViewModal } from "@/components/generate-report/ReportViewModal";
import { formatJobDate, getJobStatusTextColor } from "@/components/generate-report/utils";
import { useJobReportViewer } from "@/hooks/useJobReportViewer";
import { useMuninnApi } from "@/hooks/useMuninnApi";
import { listJobs } from "@/lib/muninn-api";
import type { EnrollmentRow, IProgram, StudentRow } from "@/lib/types";
import { useAuth } from "@clerk/nextjs";

type JobRow = {
  id: string;
  status: string;
  job_type: string;
  created_at: string;
  error_message?: string;
};

function asJobList(records: Record<string, unknown>[]): JobRow[] {
  return records.map((r) => ({
    id: String(r["id"] ?? ""),
    status: String(r["status"] ?? "—"),
    job_type: String(r["job_type"] ?? "—"),
    created_at: String(r["created_at"] ?? ""),
    error_message: r["error_message"] != null ? String(r["error_message"]) : undefined,
  }));
}

export default function EnrollmentReportsPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const api = useMuninnApi();
  const { reportView, openViewReport, closeViewReport } = useJobReportViewer();

  const programId = typeof router.query.programId === "string" ? router.query.programId : "";
  const enrollmentId =
    typeof router.query.enrollment_id === "string"
      ? router.query.enrollment_id
      : Array.isArray(router.query.enrollment_id)
        ? router.query.enrollment_id[0] ?? ""
        : "";

  const [program, setProgram] = useState<IProgram | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentRow | null>(null);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!programId || !enrollmentId) return;
    setLoadError(null);
    setLoading(true);
    try {
      const [p, enrollments, students] = await Promise.all([
        api.getProgram(programId),
        api.listProgramEnrollments(programId),
        api.listStudents(),
      ]);
      setProgram(p);
      const enr = enrollments.find((e) => e.id === enrollmentId) ?? null;
      setEnrollment(enr);
      if (enr) {
        setStudent(students.find((s) => s.id === enr.student_id) ?? null);
        const { jobs: raw } = await listJobs(getToken, [enrollmentId]);
        setJobs(asJobList(raw));
      } else {
        setStudent(null);
        setJobs([]);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load this page");
      setProgram(null);
      setEnrollment(null);
      setStudent(null);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [api, getToken, programId, enrollmentId]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!programId || !enrollmentId) {
      setLoading(false);
      return;
    }
    void load();
  }, [router.isReady, programId, enrollmentId, load]);

  const pageTitle = useMemo(() => {
    if (student) return `Reports — ${student.student_name}`;
    return "Enrollment reports";
  }, [student]);

  const anyJobError = useMemo(() => jobs.some((j) => j.error_message), [jobs]);

  if (!router.isReady) return null;

  if (!programId) {
    return (
      <AppLayout title="Reports">
        <p className="text-zinc-500">Invalid program.</p>
      </AppLayout>
    );
  }

  if (!enrollmentId) {
    return (
      <AppLayout title="Reports">
        <p className="mb-4 text-zinc-500">No enrollment was specified. Open this page from a program&rsquo;s enrollments table.</p>
        <Link href={`/programs/${programId}`} className="text-sm text-violet-700 hover:underline dark:text-violet-400">
          ← Back to program
        </Link>
      </AppLayout>
    );
  }

  return (
    <>
      <Head>
        <title>{pageTitle} — Muninn</title>
      </Head>
      <AppLayout title={pageTitle}>
        {loadError && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {loadError}
          </p>
        )}

        <p className="mb-6">
          <Link
            href={`/programs/${encodeURIComponent(programId)}`}
            className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
          >
            ← Back to program
          </Link>
        </p>

        {loading && <p className="text-sm text-zinc-500">Loading…</p>}

        {!loading && program && (
          <div className="mb-8 space-y-1">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{program.name}</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {program.start_date} — {program.end_date}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{program.location}</p>
            <p className="text-sm text-zinc-500">Type: {program.program_type}</p>
          </div>
        )}

        {!loading && enrollment && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Child</h2>
            <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              {student?.student_name ?? "Unknown student"}
            </p>
          </div>
        )}

        {!loading && !enrollment && !loadError && (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This enrollment is not part of this program, or the link is out of date.
          </p>
        )}

        {!loading && enrollment && (
          <section aria-label="Report jobs for this enrollment">
            <h2 className="mb-3 text-sm font-medium text-zinc-500">Reports for this enrollment</h2>
            {jobs.length === 0 ? (
              <p className="text-sm text-zinc-500">No report jobs yet. Generate a report from the program or report generator page.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-200">Created</th>
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-200">Status</th>
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-200">Type</th>
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-200">Job ID</th>
                      {anyJobError && (
                        <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-200">Error</th>
                      )}
                      <th className="w-[1%] px-3 py-2 text-right font-medium text-zinc-700 dark:text-zinc-200">
                        <span className="sr-only">View</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {jobs.map((job) => (
                      <tr key={job.id} className="bg-white dark:bg-zinc-950/40">
                        <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                          {job.created_at ? formatJobDate(job.created_at) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`font-medium ${getJobStatusTextColor(job.status)}`}>
                            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{job.job_type}</td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                          {job.id.length >= 8 ? `${job.id.slice(0, 8)}…` : job.id || "—"}
                        </td>
                        {anyJobError && (
                          <td className="max-w-xs truncate px-3 py-2 text-amber-800 dark:text-amber-200" title={job.error_message}>
                            {job.error_message ?? "—"}
                          </td>
                        )}
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => openViewReport(job.id, enrollmentId)}
                            className="inline-flex items-center justify-center rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-900 transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/50"
                          >
                            View report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <ReportViewModal
          open={reportView.open}
          jobId={reportView.jobId}
          isLoading={reportView.loading}
          error={reportView.error}
          markdown={reportView.markdown}
          onClose={closeViewReport}
        />
      </AppLayout>
    </>
  );
}
