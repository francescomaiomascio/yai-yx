import { DataTable } from "../components/DataTable.js";

export function EventsView(state) {
  return `
    <section>
      <div class="yx-toolbar">
        <input id="yx-events-filter-text" placeholder="Filter text" />
        <input id="yx-events-filter-topic" placeholder="Topic filter" />
        <select id="yx-events-filter-severity">
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
      </div>
      ${DataTable({ id: "yx-events-table", rows: state.events, kind: "events" })}
    </section>
  `;
}
