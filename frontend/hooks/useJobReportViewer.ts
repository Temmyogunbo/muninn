import { useCallback, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { getJob } from "@/lib/muninn-api";
import { reportPayloadToMarkdown } from "@/lib/reportPayloadToMarkdown";

export type ReportViewState = {
  open: boolean;
  jobId: string | null;
  enrollmentId: string | null;
  markdown: string | null;
  error: string | null;
  loading: boolean;
};

const initialReportView: ReportViewState = {
  open: false,
  jobId: null,
  enrollmentId: null,
  markdown: null,
  error: null,
  loading: false,
};

/** Fetch one job and open the report modal (markdown from `report_payload`). */
export function useJobReportViewer() {
  const { getToken } = useAuth();
  const [reportView, setReportView] = useState<ReportViewState>(initialReportView);

  const openViewReport = useCallback(
    (jobId: string, enrollmentId: string) => {
      setReportView({
        open: true,
        jobId,
        enrollmentId,
        markdown: null,
        error: null,
        loading: true,
      });
      void (async () => {
        try {
          const job = await getJob(getToken, jobId, enrollmentId);
          const raw = job["report_payload"];
          setReportView((s) => ({
            ...s,
            markdown: reportPayloadToMarkdown(raw),
            error: null,
            loading: false,
          }));
        } catch (e) {
          setReportView((s) => ({
            ...s,
            loading: false,
            markdown: null,
            error: e instanceof Error ? e.message : "Failed to load report",
          }));
        }
      })();
    },
    [getToken],
  );

  const closeViewReport = useCallback(() => {
    setReportView(initialReportView);
  }, []);

  return { reportView, openViewReport, closeViewReport };
}
