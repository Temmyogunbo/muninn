import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { CoursesList, CreateCourseModal } from "@/components/courses";
import { useMuninnApi } from "@/hooks/useMuninnApi";
import type { CourseRow, ProgramRow } from "@/lib/types";

const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";

export default function CoursesPage() {
  const api = useMuninnApi();
  const [courses, setCourses] = useState<CourseRow[] | null>(null);
  const [programs, setPrograms] = useState<ProgramRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadCourses = useCallback(() => {
    setListError(null);
    return api
      .listCourses()
      .then(setCourses)
      .catch((e: Error) => {
        setListError(e.message);
        setCourses(null);
      });
  }, [api]);

  const loadPrograms = useCallback(() => {
    return api
      .listPrograms()
      .then(setPrograms)
      .catch(() => setPrograms([]));
  }, [api]);

  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const handleCreate = useCallback(
    async (data: {
      title: string;
      description: string | null;
      learning_outcomes: string[];
      learning_objectives: string[];
      skills: string[];
      program_id: string | null;
    }) => {
      setFormError(null);
      setSuccessMsg(null);
      setSaving(true);
      try {
        const row = await api.createCourse({ ...data });
        setSuccessMsg(`Course “${row.title}” was created.`);
        setModalOpen(false);
        await loadCourses();
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Failed to create course");
      } finally {
        setSaving(false);
      }
    },
    [api, loadCourses],
  );

  return (
    <AppLayout title="Courses">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
          All courses in the system. Use <strong>Programs</strong> to build schedules; programs reference a course
          as needed.
        </p>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setFormError(null);
            setModalOpen(true);
          }}
        >
          Add course
        </button>
      </div>

      {successMsg && (
        <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          {successMsg}
        </p>
      )}

      {listError && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {listError}
        </p>
      )}

      {courses === null && !listError && <p className="text-zinc-500">Loading courses…</p>}

      {courses !== null && (
        <CoursesList courses={courses} programs={programs ?? []} />
      )}

      <CreateCourseModal
        open={modalOpen}
        isSubmitting={saving}
        error={formError}
        programs={programs ?? []}
        onClose={() => {
          if (!saving) {
            setFormError(null);
            setModalOpen(false);
          }
        }}
        onCreate={(data) => handleCreate(data)}
      />
    </AppLayout>
  );
}
