import type { CourseRow, ProgramRow } from "@/lib/types";

function firstLines(value: unknown, max = 2): string {
  if (value == null) return "";
  const raw =
    typeof value === "string"
      ? (() => {
          try {
            const p = JSON.parse(value) as unknown;
            if (Array.isArray(p)) return p.map(String).join("\n");
          } catch {
            /* not JSON */
          }
          return value;
        })()
      : Array.isArray(value)
        ? value.map(String).join("\n")
        : String(value);
  const lines = raw.split("\n").filter(Boolean);
  return lines.slice(0, max).join(" · ");
}

type Props = {
  courses: CourseRow[];
  programs: ProgramRow[];
};

export function CoursesList({ courses, programs }: Props) {
  const nameById = new Map(programs.map((p) => [p.id, p.name]));

  if (courses.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No courses yet. Use <strong>Add course</strong> to create one.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/50">
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Title
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Program
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Description
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Preview
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {courses.map((c) => {
            const programName = c.program_id ? nameById.get(c.program_id) ?? c.program_id : "—";
            const preview = firstLines(c.learning_outcomes) || firstLines(c.skills) || "—";
            return (
              <tr key={c.id} className="bg-white dark:bg-zinc-950/40">
                <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{c.title}</td>
                <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">{programName}</td>
                <td className="max-w-xs px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                  {c.description ? (
                    <span className="line-clamp-2">{c.description}</span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="max-w-sm px-3 py-2.5 text-xs text-zinc-500 dark:text-zinc-500">
                  <span className="line-clamp-2">{preview}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
