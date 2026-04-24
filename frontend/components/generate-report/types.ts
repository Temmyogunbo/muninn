export type Agent = {
  icon: string;
  name: string;
  role: string;
  description: string;
  color: string;
  bgColor: string;
};

export type Job = {
  id: string;
  enrollment_id?: string;
  created_at: string;
  status: string;
  job_type: string;
  report_payload?: unknown;
  error_message?: string;
};

export type AnalysisProgress = {
  stage: "idle" | "starting" | "planner" | "parallel" | "completing" | "complete" | "error";
  message: string;
  activeAgents: string[];
  error?: string;
};

export type EnrollmentTableRow = {
  enrollmentId: string;
  programName: string;
  studentName: string;
};
