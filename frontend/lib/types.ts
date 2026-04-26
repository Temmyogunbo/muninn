/** Shapes returned by the Muninn FastAPI (Aurora JSON). Dates are ISO strings. */

export type ProgramType =
  | "summer_camp"
  | "after_school_program"
  | "online_program"
  | "holiday_camp";

export type Gender = "male" | "female" | "other";

export type EnrollmentStatus = "pending" | "active" | "completed" | "withdrawn";

export type ProgramRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  program_type: ProgramType;
  course_id: string;
};

/** Full program row as returned from the API (includes audit fields when present). */
export type IProgram = ProgramRow & {
  created_at?: string;
  updated_at?: string;
};

export type ProgramCreateInput = {
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  program_type: ProgramType;
  course_id: string;
};

export type ProgramUpdateInput = Partial<ProgramCreateInput>;

export type UserRow = {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  role: "parent" | "instructor" | "admin";
  clerk_user_id: string;
};

export type UserProfileResponse = {
  user: UserRow;
  created: boolean;
};

export type StudentRow = {
  id: string;
  student_name: string;
  date_of_birth: string;
  gender: Gender;
  parent_id: string;
};

export type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  learning_outcomes: unknown;
  learning_objectives: unknown;
  program_id: string | null;
  skills: unknown;
};

export type EnrollmentRow = {
  id: string;
  student_id: string;
  program_id: string;
  enrolled_at: string;
  status: EnrollmentStatus;
  notes: string | null;
};

export type EnrollmentUpdateInput = {
  enrolled_at?: string;
  status?: EnrollmentStatus;
  notes?: string | null;
};

export type ApiErrorBody = { detail?: string };
