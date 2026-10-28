import { useState } from "react";
import Badge from "./Badge";
import StatTicket from "./StatTicket";

/**
 * RoyaltyOverview — Network-wide royalty monitoring panel for Admin/HQ.
 * Features:
 *   - StatTickets for Total Network Royalty Pending, Collected This Month, and Lifetime Royalty Collected
 *   - Network-wide table showing all outlets' billing periods, rates, dues, and payment statuses
 *   - Instant filtering by Outlet and Status
 */
export default function RoyaltyOverview({ invoices = [], summary, outlets = [] }) {
  const [selectedOutlet, setSelectedOutlet] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const filteredInvoices = invoices.filter((inv) => {
    if (selectedOutlet !== "all" && String(inv.outlet) !== String(selectedOutlet)) {
      return false;
    }
    if (selectedStatus !== "all" && inv.status !== selectedStatus) {
      return false;
    }
    return true;
  });

  const pendingAmount = parseFloat(summary?.total_pending_amount || 0);
  const collectedThisMonth = parseFloat(summary?.total_collected_this_month || 0);
  const collectedThisYear = parseFloat(summary?.total_collected_this_year || 0);

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <h3 style={styles.heading}>Network Royalty & Collections Overview</h3>
          <p style={styles.subheading}>
            HQ tracking of network-wide franchise royalty dues, collection rates, and settlement records.
          </p>
        </div>

        <div style={styles.filterGroup}>
          <select
            style={styles.select}
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
          >
            <option value="all">All Outlets ({outlets.length})</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.outlet_name} ({o.city})
              </option>
            ))}
          </select>

          <select
            style={styles.select}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Only</option>
            <option value="paid">Paid / Settled Only</option>
          </select>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <StatTicket
          label="Network Royalty Pending"
          value={pendingAmount}
          tone={pendingAmount > 0 ? "amber" : "default"}
        />
        <StatTicket
          label="Collected This Month"
          value={collectedThisMonth}
          tone="default"
        />
        <StatTicket
          label="Total Collected (YTD)"
          value={collectedThisYear}
          tone="default"
        />
      </div>

      <div style={styles.tableWrap}>
        {filteredInvoices.length === 0 ? (
          <div style={styles.empty}>
            {invoices.length === 0
              ? "No royalty invoices exist across the network yet. Run the 'generate_royalty_invoices' command to calculate last month's royalties."
              : "No invoices match the selected filter criteria."}
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Outlet</th>
                <th style={styles.th}>City</th>
                <th style={styles.th}>Period</th>
                <th style={styles.th}>Gross Sales</th>
                <th style={styles.th}>Rate</th>
                <th style={styles.th}>Royalty Due</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Settlement Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => {
                const isPaid = inv.status === "paid";
                const formattedDate = inv.paid_at
                  ? new Date(inv.paid_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "Unsettled";

                return (
                  <tr key={inv.id} style={!isPaid ? styles.pendingRow : undefined}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{inv.outlet_name}</td>
                    <td style={{ ...styles.td, color: "var(--ink-soft)" }}>{inv.city}</td>
                    <td style={styles.td}>
                      <span style={styles.periodPill}>{inv.period_name || `${inv.month}/${inv.year}`}</span>
                    </td>
                    <td style={styles.td} className="mono">
                      ₹{parseFloat(inv.total_sales).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={styles.td} className="mono">
                      {parseFloat(inv.royalty_percentage)}%
                    </td>
                    <td style={{ ...styles.td, fontWeight: 700 }} className="mono">
                      ₹{parseFloat(inv.amount_due).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={styles.td}>
                      <Badge tone={isPaid ? "approved" : "pending"}>
                        {isPaid ? "Paid" : "Pending"}
                      </Badge>
                    </td>
                    <td style={{ ...styles.td, color: isPaid ? "var(--ink)" : "var(--ink-soft)" }} className="mono">
                      {formattedDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
    padding: "24px",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "14px",
  },
  heading: {
    fontSize: "16px",
    marginBottom: "4px",
  },
  subheading: {
    color: "var(--ink-soft)",
    fontSize: "13px",
  },
  filterGroup: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  select: {
    padding: "7px 12px",
    borderRadius: "8px",
    border: "1.5px solid var(--border)",
    fontSize: "12.5px",
    background: "var(--surface)",
    color: "var(--ink)",
    outline: "none",
    fontFamily: "var(--font-body)",
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
    marginBottom: "22px",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "10px 10px",
    fontSize: "11.5px",
    color: "var(--ink-soft)",
    borderBottom: "2px solid var(--border)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    fontWeight: 600,
  },
  td: {
    padding: "13px 10px",
    fontSize: "13.5px",
    borderBottom: "1px solid var(--border)",
  },
  periodPill: {
    fontWeight: 500,
    color: "var(--ink)",
  },
  pendingRow: {
    background: "rgba(226, 139, 38, 0.02)",
  },
  empty: {
    color: "var(--ink-soft)",
    fontSize: "13px",
    padding: "36px 0",
    textAlign: "center",
  },
};
