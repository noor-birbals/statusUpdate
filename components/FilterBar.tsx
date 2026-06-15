import type { DashboardFilters } from '@/lib/filters';

interface Props {
  assignees: string[];
  filters: DashboardFilters;
  totalCount: number;
  filteredCount: number;
  onChange: (filters: DashboardFilters) => void;
  onClear: () => void;
}

export default function FilterBar({
  assignees,
  filters,
  totalCount,
  filteredCount,
  onChange,
  onClear,
}: Props) {
  const active = filters.assignee || filters.dateFrom || filters.dateTo;

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label htmlFor="filter-assignee">Team member</label>
        <select
          id="filter-assignee"
          value={filters.assignee}
          onChange={(e) => onChange({ ...filters, assignee: e.target.value })}
        >
          <option value="">All team members</option>
          {assignees.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="filter-date-from">Updated from</label>
        <input
          id="filter-date-from"
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
        />
      </div>

      <div className="filter-group">
        <label htmlFor="filter-date-to">Updated to</label>
        <input
          id="filter-date-to"
          type="date"
          value={filters.dateTo}
          min={filters.dateFrom || undefined}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
        />
      </div>

      {active && (
        <button type="button" className="filter-clear" onClick={onClear}>
          Clear filters
        </button>
      )}

      {active && (
        <span className="filter-count">
          Showing {filteredCount} of {totalCount} issues
        </span>
      )}
    </div>
  );
}
