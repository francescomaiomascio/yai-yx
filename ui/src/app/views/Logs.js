import { DataTable } from "../components/DataTable.js";

export function LogsView(state) {
  return `
    <section>
      <div class="yx-toolbar">
        <input id="yx-logs-filter-text" placeholder="Filter text" />
        <input id="yx-logs-filter-topic" placeholder="Topic filter" />
        <select id="yx-logs-filter-severity">
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
      </div>
      ${DataTable({ id: "yx-logs-table", rows: state.logs, kind: "logs" })}
    </section>
  `;
}
