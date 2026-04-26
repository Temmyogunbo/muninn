import { PROGRAM_TYPE_OPTIONS } from "./programUtils";
import type { CourseRow, ProgramCreateInput, ProgramType } from "@/lib/types";

const input =
  "mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
/** Native date() needs explicit text + color-scheme in dark mode or the value and picker look broken. */
const inputDate =
  "mt-1 min-h-[2.5rem] w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 " +
  "[color-scheme:light]";
const label = "text-zinc-600 dark:text-zinc-400";

type Props = {
  value: ProgramCreateInput;
  onChange: (next: ProgramCreateInput) => void;
  courses: CourseRow[];
};

export function ProgramFormFields({ value, onChange, courses }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2 text-sm">
        <span className={label}>Course</span>
        <select
          required
          className={inputDate}
          value={value.course_id}
          onChange={(e) => onChange({ ...value, course_id: e.target.value })}
        >
          <option value="" disabled>
            {courses.length ? "Select a course" : "No courses available — create one on the Courses page first"}
          </option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2 text-sm">
        <span className={label}>Name</span>
        <input
          required
          className={input}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </label>
      <label className="text-sm">
        <span className={label}>Start</span>
        <input
          type="date"
          required
          className={inputDate}
          name="start_date"
          autoComplete="off"
          value={value.start_date}
          onChange={(e) => onChange({ ...value, start_date: e.target.value })}
        />
      </label>
      <label className="text-sm">
        <span className={label}>End</span>
        <input
          type="date"
          required
          className={inputDate}
          name="end_date"
          autoComplete="off"
          value={value.end_date}
          onChange={(e) => onChange({ ...value, end_date: e.target.value })}
        />
      </label>
      <label className="sm:col-span-2 text-sm">
        <span className={label}>Location</span>
        <input
          required
          className={input}
          value={value.location}
          onChange={(e) => onChange({ ...value, location: e.target.value })}
        />
      </label>
      <label className="sm:col-span-2 text-sm">
        <span className={label}>Type</span>
        <select
          className={inputDate}
          value={value.program_type}
          onChange={(e) => onChange({ ...value, program_type: e.target.value as ProgramType })}
        >
          {PROGRAM_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
