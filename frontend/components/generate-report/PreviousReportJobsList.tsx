import type { Job } from "./types";
import { formatJobDate, getJobStatusTextColor } from "./utils";

type Props = {
  jobs: Job[];
  onViewJob: (jobId: string, enrollmentId: string) => void;
};

export function PreviousReportJobsList({ jobs, onViewJob }: Props) {
  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold text-dark">Previous Report Generations</h3>
      {jobs.length === 0 ? (
        <p className="italic text-gray-500">
          No previous report generations found. Start your first report generation above!
        </p>
      ) : (
        <div className="space-y-3">
          {jobs.slice(0, 5).map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between rounded-lg bg-gray-50 p-4 transition-colors hover:bg-gray-100"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  Report Generation #{job.id.slice(0, 8)}
                </p>
                <p className="text-xs text-gray-500">{formatJobDate(job.created_at)}</p>
              </div>
              <div className="flex items-center space-x-4">
                <span className={`text-sm font-medium ${getJobStatusTextColor(job.status)}`}>
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </span>
                {job.status === "completed" && job.enrollment_id && (
                  <button
                    type="button"
                    onClick={() => {
                      const eid = job.enrollment_id;
                      if (eid) onViewJob(job.id, eid);
                    }}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                  >
                    View
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
