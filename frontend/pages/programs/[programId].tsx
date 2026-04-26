import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ProgramEnrollmentsBlock } from "@/components/programs/ProgramEnrollmentsBlock";
import { useMuninnApi } from "@/hooks/useMuninnApi";
import type { CourseRow, EnrollmentRow, IProgram, StudentRow } from "@/lib/types";

export default function ProgramDetailPage() {
  const { query, isReady } = useRouter();
  const id = typeof query.programId === "string" ? query.programId : "";
  const api = useMuninnApi();
  const [program, setProgram] = useState<IProgram | null>(null);
  const [courses, setCourses] = useState<CourseRow[] | null>(null);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    void Promise.all([
      api.getProgram(id),
      api.listCourses(),
      api.listStudents(),
      api.listProgramEnrollments(id),
    ])
      .then(([p, c, s, e]) => {
        setProgram(p);
        setCourses(c);
        setStudents(s);
        setEnrollments(e);
      })
      .catch((e: Error) => {
        setError(e.message);
      });
  }, [api, id]);

  useEffect(() => {
    if (!isReady || !id) return;
    void load();
  }, [isReady, id, load]);

  if (!isReady) return null;
  if (!id) {
    return (
      <AppLayout title="Program">
        <p className="text-zinc-500">Invalid program id.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={program ? program.name : "Program"}>
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <p className="mb-6">
        <Link href="/programs" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
          ← All programs
        </Link>
      </p>

      {program && (
        <div className="mb-8 space-y-1">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {program.start_date} — {program.end_date}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{program.location}</p>
          <p className="text-sm text-zinc-500">Type: {program.program_type}</p>
        </div>
      )}

      {!program && !error && <p className="text-zinc-500">Loading…</p>}

      {program && (
        <ProgramEnrollmentsBlock
          programId={id}
          enrollments={enrollments}
          students={students}
          onRefetch={load}
        />
      )}
    </AppLayout>
  );
}
