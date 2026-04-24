import type { IProgram, ProgramCreateInput, ProgramType } from "@/lib/types";

export const PROGRAM_TYPE_OPTIONS: { value: ProgramType; label: string }[] = [
  { value: "summer_camp", label: "Summer camp" },
  { value: "after_school_program", label: "After school" },
  { value: "online_program", label: "Online" },
  { value: "holiday_camp", label: "Holiday camp" },
];

export function programTypeLabel(value: string): string {
  return PROGRAM_TYPE_OPTIONS.find((p) => p.value === value)?.label ?? value;
}

export function toDateInputValue(s: string): string {
  if (!s) return "";
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function emptyProgramForm(): ProgramCreateInput {
  return {
    name: "",
    start_date: "",
    end_date: "",
    location: "",
    program_type: "summer_camp",
  };
}

export function programToForm(p: IProgram): ProgramCreateInput {
  return {
    name: p.name,
    start_date: toDateInputValue(p.start_date),
    end_date: toDateInputValue(p.end_date),
    location: p.location,
    program_type: p.program_type,
  };
}
