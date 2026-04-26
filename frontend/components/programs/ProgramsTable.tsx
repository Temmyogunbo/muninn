import Link from "next/link";
import { IconPencil, IconTrash2 } from "@/components/icons/ProgramTableIcons";
import { formatDate, programTypeLabel } from "./programUtils";
import type { CourseRow, IProgram } from "@/lib/types";

type Props = {
  programs: IProgram[];
  courses: CourseRow[];
  deletingId: string | null;
  onEdit: (p: IProgram) => void;
  onDelete: (p: IProgram) => void;
};

function courseTitle(courses: CourseRow[], courseId: string | undefined): string {
  if (!courseId) return "—";
  return courses.find((c) => c.id === courseId)?.title ?? "—";
}

export function ProgramsTable({ programs, courses, deletingId, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/50">
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Name
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Course
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Start
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              End
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Location
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Type
            </th>
            <th scope="col" className="w-[1%] px-3 py-3 text-right font-medium text-zinc-700 dark:text-zinc-200">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {programs.map((p) => (
            <tr key={p.id} className="bg-white dark:bg-zinc-950/40">
              <td className="px-3 py-2.5">
                <Link
                  href={`/programs/${p.id}`}
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {p.name}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300">{courseTitle(courses, p.course_id)}</td>
              <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">{formatDate(p.start_date)}</td>
              <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">{formatDate(p.end_date)}</td>
              <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">{p.location}</td>
              <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                {programTypeLabel(p.program_type)}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                <div className="inline-flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(p)}
                    disabled={deletingId === p.id}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition hover:bg-blue-100 hover:text-blue-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-blue-950 dark:hover:text-blue-200"
                    aria-label={`Edit ${p.name}`}
                    title="Edit"
                  >
                    <IconPencil />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(p)}
                    disabled={deletingId === p.id}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition hover:bg-red-100 hover:text-red-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-red-950 dark:hover:text-red-200"
                    aria-label={`Delete ${p.name}`}
                    title="Delete"
                  >
                    {deletingId === p.id ? (
                      <span className="h-4 w-4 animate-pulse rounded border border-zinc-300 dark:border-zinc-600" />
                    ) : (
                      <IconTrash2 />
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
