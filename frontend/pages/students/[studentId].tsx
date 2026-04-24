import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useMuninnApi } from "@/hooks/useMuninnApi";
import type { StudentRow } from "@/lib/types";

export default function StudentDetailPage() {
  const { query, isReady } = useRouter();
  const id = typeof query.studentId === "string" ? query.studentId : "";
  const api = useMuninnApi();
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    api
      .getStudent(id)
      .then(setStudent)
      .catch((e: Error) => setError(e.message));
  }, [api, id]);

  useEffect(() => {
    if (!isReady || !id) return;
    void load();
  }, [isReady, id, load]);

  if (!isReady) return null;
  if (!id) {
    return (
      <AppLayout title="Student">
        <p className="text-zinc-500">Invalid student id.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={student ? student.student_name : "Student"}>
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <p className="mb-6">
        <Link href="/students" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
          ← All students
        </Link>
      </p>

      {!student && !error && <p className="text-zinc-500">Loading…</p>}

      {student && (
        <dl className="max-w-md space-y-2 text-sm">
          <div>
            <dt className="text-zinc-500">Date of birth</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">{student.date_of_birth}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Gender</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">{student.gender}</dd>
          </div>
        </dl>
      )}
    </AppLayout>
  );
}
