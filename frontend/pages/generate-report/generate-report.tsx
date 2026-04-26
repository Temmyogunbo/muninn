import Head from "next/head";
import { AppLayout } from "@/components/AppLayout";
import {
  ReportPageHero,
  EnrollmentsReportTable,
  AnalysisCenterPanel,
  ReportViewModal,
} from "@/components/generate-report";
import { useGenerateReport } from "@/hooks/useGenerateReport";

export default function ReportGenerator() {
  const {
    isRouterReady,
    enrollmentIdsFromQuery,
    jobs,
    enrollmentContextError,
    enrollmentTableRows,
    latestJobByEnrollmentId,
    completedJobByEnrollmentId,
    isGenerating,
    enrollmentIdsInActiveRun,
    progress,
    startReportGeneration,
    // isAgentActive,
    resetProgressForRetry,
    reportView,
    openViewReport,
    closeViewReport,
  } = useGenerateReport();

  const enrollmentCount = enrollmentIdsFromQuery.length;

  return (
    <>
      <Head>
        <title>End-of-Camp Program Report - AI Report Generator</title>
      </Head>
      <AppLayout>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ReportPageHero />
            <EnrollmentsReportTable
              enrollmentCount={enrollmentCount}
              enrollmentContextError={enrollmentContextError}
              enrollmentTableRows={enrollmentTableRows}
              isGenerating={isGenerating}
              enrollmentIdsInActiveRun={enrollmentIdsInActiveRun}
              onStart={() => void startReportGeneration()}
              latestJobByEnrollmentId={latestJobByEnrollmentId}
              completedJobByEnrollmentId={completedJobByEnrollmentId}
              onViewReport={openViewReport}
            />
            {/* <AnalysisCenterPanel
              isRouterReady={isRouterReady}
              enrollmentCount={enrollmentCount}
              isGenerating={isGenerating}
              progress={progress}
              jobs={jobs}
              onStartReport={() => void startReportGeneration()}
              onResetProgress={resetProgressForRetry}
              onViewJob={openViewReport}
            /> */}
            <ReportViewModal
              open={reportView.open}
              jobId={reportView.jobId}
              isLoading={reportView.loading}
              error={reportView.error}
              markdown={reportView.markdown}
              onClose={closeViewReport}
            />
          </div>
        </div>
      </AppLayout>
    </>
  );
}
