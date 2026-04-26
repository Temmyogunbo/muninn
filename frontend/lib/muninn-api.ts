import type {
  CourseRow,
  EnrollmentRow,
  Gender,
  IProgram,
  UserProfileResponse,
  UserRow,
  ProgramCreateInput,
  ProgramUpdateInput,
  StudentRow,
  EnrollmentStatus,
  EnrollmentUpdateInput,
} from "./types";

export type MuninnGetToken = () => Promise<string | null>;

export function getApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_MUNINN_API_URL ||
    "http://localhost:8000";
  return raw.replace(/\/$/, "");
}

async function parseError(res: Response): Promise<Error> {
  let message = res.statusText;
  try {
    const j = (await res.json()) as { detail?: string };
    if (j.detail) message = typeof j.detail === "string" ? j.detail : String(j.detail);
  } catch {
    /* ignore */
  }
  return new Error(message);
}

export async function muninnRequest<T>(
  getToken: MuninnGetToken,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("You must be signed in to use the API.");
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Full job document from `GET /api/jobs/{job_id}?enrollment_id=…` (includes `report_payload` when present). */
export function getJob(
  getToken: MuninnGetToken,
  jobId: string,
  enrollmentId: string,
): Promise<Record<string, unknown>> {
  const q = new URLSearchParams({ enrollment_id: enrollmentId });
  return muninnRequest<Record<string, unknown>>(
    getToken,
    `/api/jobs/${encodeURIComponent(jobId)}?${q.toString()}`,
  );
}

export type ListJobsResponse = { jobs: Record<string, unknown>[] };

/** List report jobs, optionally filtered by one or more enrollments. */
export function listJobs(
  getToken: MuninnGetToken,
  enrollmentIds: string[],
  limit = 200,
): Promise<ListJobsResponse> {
  const params = new URLSearchParams();
  for (const id of enrollmentIds) {
    params.append("enrollment_ids", id);
  }
  params.set("limit", String(limit));
  return muninnRequest<ListJobsResponse>(getToken, `/api/jobs?${params.toString()}`);
}

export function getHealth(): Promise<{ status: string; timestamp: string }> {
  return fetch(`${getApiBaseUrl()}/health`).then((r) => {
    if (!r.ok) throw new Error("Health check failed");
    return r.json() as Promise<{ status: string; timestamp: string }>;
  });
}

export function getUserMe(getToken: MuninnGetToken): Promise<UserProfileResponse> {
  return muninnRequest<UserProfileResponse>(getToken, "/api/user/me");
}

export function updateUser(
  getToken: MuninnGetToken,
  body: {
    display_name?: string;
    email?: string;
    phone?: string;
  },
): Promise<UserRow> {
  return muninnRequest<UserRow>(getToken, "/api/user/me", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function listParents(getToken: MuninnGetToken): Promise<UserRow[]> {
  return muninnRequest<UserRow[]>(getToken, "/api/parents");
}

export function createParent(
  getToken: MuninnGetToken,
  body: {
    display_name: string;
    email: string;
    phone: string;
    clerk_user_id: string;
  },
): Promise<UserRow> {
  return muninnRequest<UserRow>(getToken, "/api/parents", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listPrograms(getToken: MuninnGetToken): Promise<IProgram[]> {
  return muninnRequest<IProgram[]>(getToken, "/api/programs");
}

export function getProgram(getToken: MuninnGetToken, id: string): Promise<IProgram> {
  return muninnRequest<IProgram>(getToken, `/api/programs/${encodeURIComponent(id)}`);
}

export function createProgram(
  getToken: MuninnGetToken,
  body: ProgramCreateInput,
): Promise<IProgram> {
  return muninnRequest<IProgram>(getToken, "/api/programs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateProgram(
  getToken: MuninnGetToken,
  programId: string,
  body: ProgramUpdateInput,
): Promise<IProgram> {
  return muninnRequest<IProgram>(getToken, `/api/programs/${encodeURIComponent(programId)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteProgram(getToken: MuninnGetToken, programId: string): Promise<void> {
  await muninnRequest<undefined>(getToken, `/api/programs/${encodeURIComponent(programId)}`, {
    method: "DELETE",
  });
}

export function listStudents(getToken: MuninnGetToken): Promise<StudentRow[]> {
  return muninnRequest<StudentRow[]>(getToken, "/api/students");
}

export function getStudent(getToken: MuninnGetToken, id: string): Promise<StudentRow> {
  return muninnRequest<StudentRow>(getToken, `/api/students/${encodeURIComponent(id)}`);
}

export function createStudent(
  getToken: MuninnGetToken,
  body: {
    student_name: string;
    date_of_birth: string;
    gender: Gender;
    parent_id: string;
  },
): Promise<StudentRow> {
  return muninnRequest<StudentRow>(getToken, "/api/students", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listCourses(getToken: MuninnGetToken): Promise<CourseRow[]> {
  return muninnRequest<CourseRow[]>(getToken, `/api/courses`);
}

export function createCourse(
  getToken: MuninnGetToken,
  body: Record<string, unknown>,
): Promise<CourseRow> {
  return muninnRequest<CourseRow>(getToken, "/api/courses", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Fetches specific enrollment row(s) by id (e.g. report generator). */
export function listEnrollments(
  getToken: MuninnGetToken,
  enrollmentIds: string[],
): Promise<EnrollmentRow[]> {
  if (enrollmentIds.length === 0) {
    return Promise.resolve([]);
  }
  const query = `?${enrollmentIds.map((id) => `id=${encodeURIComponent(id)}`).join("&")}`;
  return muninnRequest<EnrollmentRow[]>(getToken, `/api/enrollments${query}`);
}

export function listProgramEnrollments(
  getToken: MuninnGetToken,
  programId: string,
): Promise<EnrollmentRow[]> {
  return muninnRequest<EnrollmentRow[]>(
    getToken,
    `/api/programs/${encodeURIComponent(programId)}/enrollments`,
  );
}

export function addProgramEnrollment(
  getToken: MuninnGetToken,
  programId: string,
  body: {
    student_id: string;
    enrolled_at: string;
    status: EnrollmentStatus;
    notes?: string | null;
  },
): Promise<EnrollmentRow> {
  return muninnRequest<EnrollmentRow>(getToken, `/api/programs/${encodeURIComponent(programId)}/enrollments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateProgramEnrollment(
  getToken: MuninnGetToken,
  programId: string,
  enrollmentId: string,
  body: EnrollmentUpdateInput,
): Promise<EnrollmentRow> {
  return muninnRequest<EnrollmentRow>(
    getToken,
    `/api/programs/${encodeURIComponent(programId)}/enrollments/${encodeURIComponent(enrollmentId)}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export async function deleteProgramEnrollment(
  getToken: MuninnGetToken,
  programId: string,
  enrollmentId: string,
): Promise<void> {
  await muninnRequest<undefined>(
    getToken,
    `/api/programs/${encodeURIComponent(programId)}/enrollments/${encodeURIComponent(enrollmentId)}`,
    { method: "DELETE" },
  );
}

export type MuninnApi = {
  health: typeof getHealth;
  getUserMe: () => ReturnType<typeof getUserMe>;
  updateUser: (body: Parameters<typeof updateUser>[1]) => ReturnType<typeof updateUser>;
  listParents: () => ReturnType<typeof listParents>;
  createParent: (body: Parameters<typeof createParent>[1]) => ReturnType<typeof createParent>;
  listPrograms: () => ReturnType<typeof listPrograms>;
  getProgram: (id: string) => ReturnType<typeof getProgram>;
  createProgram: (body: Parameters<typeof createProgram>[1]) => ReturnType<typeof createProgram>;
  updateProgram: (id: string, body: ProgramUpdateInput) => ReturnType<typeof updateProgram>;
  deleteProgram: (id: string) => ReturnType<typeof deleteProgram>;
  listStudents: () => ReturnType<typeof listStudents>;
  getStudent: (id: string) => ReturnType<typeof getStudent>;
  createStudent: (body: Parameters<typeof createStudent>[1]) => ReturnType<typeof createStudent>;
  listCourses: () => ReturnType<typeof listCourses>;
  createCourse: (body: Parameters<typeof createCourse>[1]) => ReturnType<typeof createCourse>;
  listEnrollments: (enrollmentIds: string[]) => ReturnType<typeof listEnrollments>;
  listProgramEnrollments: (programId: string) => ReturnType<typeof listProgramEnrollments>;
  addProgramEnrollment: (programId: string, body: Parameters<typeof addProgramEnrollment>[2]) => ReturnType<typeof addProgramEnrollment>;
  updateProgramEnrollment: (
    programId: string,
    enrollmentId: string,
    body: EnrollmentUpdateInput,
  ) => ReturnType<typeof updateProgramEnrollment>;
  deleteProgramEnrollment: (programId: string, enrollmentId: string) => ReturnType<typeof deleteProgramEnrollment>;
};

export function createMuninnApiClient(getToken: MuninnGetToken): MuninnApi {
  return {
    health: () => getHealth(),
    getUserMe: () => getUserMe(getToken),
    updateUser: (body) => updateUser(getToken, body),
    listParents: () => listParents(getToken),
    createParent: (body) => createParent(getToken, body),
    listPrograms: () => listPrograms(getToken),
    getProgram: (id) => getProgram(getToken, id),
    createProgram: (body) => createProgram(getToken, body),
    updateProgram: (id, body) => updateProgram(getToken, id, body),
    deleteProgram: (id) => deleteProgram(getToken, id),
    listStudents: () => listStudents(getToken),
    getStudent: (id) => getStudent(getToken, id),
    createStudent: (body) => createStudent(getToken, body),
    listCourses: () => listCourses(getToken),
    createCourse: (body) => createCourse(getToken, body),
    listEnrollments: (enrollmentIds) => listEnrollments(getToken, enrollmentIds),
    listProgramEnrollments: (programId) => listProgramEnrollments(getToken, programId),
    addProgramEnrollment: (programId, body) => addProgramEnrollment(getToken, programId, body),
    updateProgramEnrollment: (programId, enrollmentId, body) =>
      updateProgramEnrollment(getToken, programId, enrollmentId, body),
    deleteProgramEnrollment: (programId, enrollmentId) => deleteProgramEnrollment(getToken, programId, enrollmentId),
  };
}
