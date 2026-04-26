import type { UserRow } from "@/lib/types";

type Props = {
  parents: UserRow[];
};

export function ParentsTable({ parents }: Props) {
  if (parents.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No parent accounts yet. Use <strong>Add parent</strong> to create one.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/50">
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Name
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Email
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Phone
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Clerk user id
            </th>
            <th scope="col" className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">
              Id
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {parents.map((p) => (
            <tr key={p.id} className="bg-white dark:bg-zinc-950/40">
              <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{p.display_name}</td>
              <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">{p.email}</td>
              <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">{p.phone}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-zinc-600 dark:text-zinc-400">{p.clerk_user_id}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">{p.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
