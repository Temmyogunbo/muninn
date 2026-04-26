export function formatJobDate(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getJobStatusTextColor(status: string): string {
  switch (status) {
    case "completed":
      return "text-green-600";
    case "failed":
      return "text-red-500";
    case "running":
      return "text-blue-600";
    default:
      return "text-gray-500";
  }
}

export function isJobTerminalStatus(status: string): boolean {
  return status === "completed" || status === "failed";
}

/** Job is still queued or in progress (show loader, disable view). */
export function isJobPendingStatus(status: string): boolean {
  return !isJobTerminalStatus(status);
}
