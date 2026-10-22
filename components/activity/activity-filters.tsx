import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_OUTCOMES,
  type ActivityCategory,
  type ActivityFilter,
  type ActivityOutcome,
} from "@/lib/api/activity";

const categoryLabels: Record<ActivityCategory, string> = {
  auth: "Authentication",
  key: "API key",
  session: "Session",
  admin: "Administrative",
};

const outcomeLabels: Record<ActivityOutcome, string> = {
  success: "Success",
  failure: "Failure",
  pending: "Pending",
};

export function ActivityFilters({
  filter,
  onChange,
}: {
  filter: ActivityFilter;
  onChange: (filter: ActivityFilter) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="grid gap-[7px] text-xs font-semibold text-slate-300 sm:w-48">
        Category
        <select
          className="h-10 rounded-lg border border-white/15 bg-transparent px-3 text-sm font-normal text-white"
          onChange={(event) =>
            onChange({
              ...filter,
              category: event.target.value ? (event.target.value as ActivityCategory) : undefined,
            })
          }
          value={filter.category ?? ""}
        >
          <option value="">All categories</option>
          {ACTIVITY_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {categoryLabels[category]}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-[7px] text-xs font-semibold text-slate-300 sm:w-48">
        Outcome
        <select
          className="h-10 rounded-lg border border-white/15 bg-transparent px-3 text-sm font-normal text-white"
          onChange={(event) =>
            onChange({
              ...filter,
              outcome: event.target.value ? (event.target.value as ActivityOutcome) : undefined,
            })
          }
          value={filter.outcome ?? ""}
        >
          <option value="">All outcomes</option>
          {ACTIVITY_OUTCOMES.map((outcome) => (
            <option key={outcome} value={outcome}>
              {outcomeLabels[outcome]}
            </option>
          ))}
        </select>
      </label>

      {(filter.category || filter.outcome) && (
        <button
          className="h-10 rounded-lg border border-white/15 px-4 text-xs font-semibold text-white transition hover:bg-white/10"
          onClick={() => onChange({})}
          type="button"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
