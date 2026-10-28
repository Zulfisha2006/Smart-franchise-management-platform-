import { useState } from "react";
import { markRoyaltyPaid } from "../api/api";
import Badge from "./Badge";
import StatTicket from "./StatTicket";

/**
 * RoyaltySection — Displays monthly royalty invoices and settlements for Franchise Owners.
 * Features:
 *   - Quick StatTicket cards for Total Pending and Paid This Year
 *   - Breakdown table of past & current invoices with status badges
 *   - "Mark as Paid" action to simulate payment gateway settlement
 */
export default function RoyaltySection({ invoices = [], summary, onReload }) {
  const [payingId, setPayingId] = useState(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleMarkPaid = async (id, periodName) => {
    setError("");
    setSuccessMsg("");
    setPayingId(id);
    try {
      await markRoyaltyPaid(id);
      setSuccessMsg(`Payment recorded for ${periodName}. Invoice is now settled.`);
      if (onReload) {
        await onReload();
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not record payment. Please try again.";
      setError(msg);
    } finally {
      setPayingId(null);
    }
  };

  const pendingAmount = parseFloat(summary?.total_pending_amount || 0);
  const paidThisYear = parseFloat(summary?.total_paid_this_year || 0);

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <h3 style={styles.heading}>Royalty & Payment Tracking</h3>
          <p style={styles.subheading}>
            Monthly franchise royalty is calculated automatically from logged sales.
          </p>
        </div>
        <div style={styles.simBadge}>
          <span style={styles.simDot} /> Simulated Gateway
        </div>
      </div>

      <div style={styles.statGrid}>
        <StatTicket
          label="Total Royalty Pending"
          value={pendingAmount}
          tone={pendingAmount > 0 ? "amber" : "default"}
        />
        <StatTicket
          label="Royalty Paid This Year"
          value={paidThisYear}
          tone="default"
        />
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}
      {successMsg && <div style={styles.successBox}>{successMsg}</div>}

      <div style={styles.tableWrap}>
        {invoices.length === 0 ? (
          <div style={styles.empty}>
            No royalty invoices generated yet. Invoices are generated at month end or via HQ management command.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Billing Period</th>
                <th style={styles.th}>Gross Sales</th>
                <th style={styles.th}>Royalty Rate</th>
                <th style={styles.th}>Amount Due</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Paid At</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const isPaid = inv.status === "paid";
                const isPaying = payingId === inv.id;
                const formattedDate = inv.paid_at
                  ? new Date(inv.paid_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—";

                return (
                  <tr key={inv.id} style={!isPaid ? styles.pendingRow : undefined}>
                    <td style={styles.td}>
                      <span style={styles.periodText}>{inv.period_name || `${inv.month}/${inv.year}`}</span>
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
                    <td style={{ ...styles.td, color: "var(--ink-soft)" }} className="mono">
                      {formattedDate}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      {!isPaid ? (
                        <button
                          style={styles.payBtn}
                          disabled={isPaying}
                          onClick={() => handleMarkPaid(inv.id, inv.period_name || `${inv.month}/${inv.year}`)}
                        >
                          {isPaying ? "Processing..." : "Mark as Paid"}
                        </button>
                      ) : (
                        <span style={styles.settledText}>Settled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={styles.footerNote}>
        <span>
          Payment Gateway note: "Mark as Paid" simulates payment settlement. In a production deployment, this integrates directly with Stripe or Razorpay webhooks.
        </span>
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
    marginBottom: "18px",
    flexWrap: "wrap",
    gap: "10px",
  },
  heading: {
    fontSize: "16px",
    marginBottom: "4px",
  },
  subheading: {
    color: "var(--ink-soft)",
    fontSize: "13px",
  },
  simBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "999px",
    background: "var(--surface-sunken)",
    fontSize: "11.5px",
    fontWeight: 600,
    color: "var(--ink-soft)",
    border: "1px solid var(--border)",
  },
  simDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--teal)",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  },
  errorBox: {
    background: "var(--red-tint)",
    color: "var(--red)",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "14px",
    fontWeight: 500,
  },
  successBox: {
    background: "var(--green-tint)",
    color: "var(--green)",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "14px",
    fontWeight: 500,
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
  periodText: {
    fontWeight: 600,
    color: "var(--ink)",
  },
  pendingRow: {
    background: "rgba(226, 139, 38, 0.03)",
  },
  payBtn: {
    padding: "6px 14px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s ease",
  },
  settledText: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--green)",
  },
  empty: {
    color: "var(--ink-soft)",
    fontSize: "13px",
    padding: "36px 0",
    textAlign: "center",
  },
  footerNote: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "16px",
    paddingTop: "14px",
    borderTop: "1px solid var(--border)",
    fontSize: "12px",
    color: "var(--ink-soft)",
    lineHeight: 1.4,
  },
  infoIcon: {
    fontSize: "14px",
    color: "var(--ink-soft)",
  },
};
