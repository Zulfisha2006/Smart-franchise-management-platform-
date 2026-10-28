/**
 * Network-wide low-stock alert panel, used inside the Admin Dashboard.
 * Displays estimated run-out timelines and suggested restock quantities
 * computed from actual consumption rates and predicted demand.
 */
export default function LowStockAlerts({ items = [] }) {
  const formatDays = (days) => {
    if (days === null || days === undefined) return null;
    if (days <= 1) return "Runs out today";
    if (days <= 2) return "Runs out in 2 days";
    return `Runs out in ${Math.ceil(days)} days`;
  };

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <h3 style={styles.heading}>Low Stock Alerts &amp; Predictive Depletion</h3>
      </div>
      {items.length === 0 ? (
        <div style={styles.empty}>No low-stock items across the network right now.</div>
      ) : (
        <div style={styles.list}>
          {items.map((item) => {
            const days = item.days_until_depletion;
            const daysText = formatDays(days);
            const advisory =
              item.depletion_advisory ||
              `${item.name} is below the safety threshold. Suggested restock: ${
                item.suggested_restock_qty || parseFloat(item.low_stock_threshold) * 2
              } ${item.unit}.`;

            return (
              <div key={item.id} style={styles.alertItem}>
                <div style={styles.itemMain}>
                  <div style={styles.topRow}>
                    <div style={styles.identityGroup}>
                      <span style={styles.alertOutlet}>{item.outlet_name}</span>
                      <span style={styles.divider}>·</span>
                      <span style={styles.alertItemName}>{item.name}</span>
                    </div>
                    {daysText && (
                      <span
                        style={{
                          ...styles.timelineBadge,
                          background:
                            days <= 2
                              ? "var(--red-tint)"
                              : "var(--amber-tint)",
                          color:
                            days <= 2
                              ? "var(--red)"
                              : "var(--amber)",
                        }}
                      >
                        {daysText}
                      </span>
                    )}
                  </div>
                  <div style={styles.advisoryText}>{advisory}</div>
                </div>

                <div style={styles.metricsBox}>
                  <div style={styles.metricLabel}>Current / Threshold</div>
                  <div style={styles.metricVal} className="mono">
                    {parseFloat(item.current_quantity)} / {parseFloat(item.low_stock_threshold)} {item.unit}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
    alignItems: "center",
    marginBottom: "16px",
  },
  heading: {
    fontSize: "15px",
    fontWeight: 700,
    margin: 0,
    color: "var(--ink)",
  },
  empty: {
    color: "var(--ink-soft)",
    fontSize: "13px",
    padding: "20px 0",
    textAlign: "center",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  alertItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 18px",
    borderRadius: "10px",
    background: "var(--paper)",
    border: "1px solid var(--border)",
    flexWrap: "wrap",
    gap: "12px",
  },
  itemMain: {
    flex: 1,
    minWidth: "240px",
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "4px",
    flexWrap: "wrap",
  },
  identityGroup: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  alertOutlet: {
    fontWeight: 700,
    fontSize: "13.5px",
    color: "var(--ink)",
  },
  divider: {
    color: "var(--ink-soft)",
    fontSize: "12px",
  },
  alertItemName: {
    fontSize: "13.5px",
    fontWeight: 600,
    color: "var(--ink)",
  },
  timelineBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  advisoryText: {
    fontSize: "13px",
    color: "var(--ink)",
    lineHeight: 1.45,
    marginTop: "2px",
    fontWeight: 500,
  },
  metricsBox: {
    textAlign: "right",
    flexShrink: 0,
  },
  metricLabel: {
    fontSize: "10.5px",
    fontWeight: 600,
    color: "var(--ink-soft)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    marginBottom: "2px",
  },
  metricVal: {
    fontWeight: 700,
    fontSize: "13.5px",
    color: "var(--red)",
  },
};
