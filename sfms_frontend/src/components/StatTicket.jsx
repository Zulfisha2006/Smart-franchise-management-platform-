/**
 * StatTicket — the signature visual element of the dashboard.
 * Styled like a small printed receipt/ticket: dashed perforation edge,
 * amber accent tab, and monospace tabular numbers.
 */
export default function StatTicket({ label, value, prefix = "₹", trend, trendLabel, tone = "default" }) {
  const trendColor =
    trend === null || trend === undefined
      ? "var(--ink-soft)"
      : trend >= 0
      ? "var(--green)"
      : "var(--red)";
  const trendBg =
    trend === null || trend === undefined
      ? "var(--surface-sunken)"
      : trend >= 0
      ? "var(--green-tint)"
      : "var(--red-tint)";

  return (
    <div style={styles.card}>
      <div style={styles.perforation}>
        {Array.from({ length: 22 }).map((_, i) => (
          <span key={i} style={styles.dot} />
        ))}
      </div>
      <div style={styles.body}>
        <div style={styles.label}>{label}</div>
        <div style={styles.value} className="mono">
          {typeof value === "number" ? (
            <>
              <span style={styles.prefix}>{prefix}</span>
              {value.toLocaleString("en-IN")}
            </>
          ) : (
            value
          )}
        </div>
        {(trend !== undefined) && (
          <div style={{ ...styles.trendPill, color: trendColor, background: trendBg }}>
            {trend === null ? "No prior data" : `${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend)}% ${trendLabel || ""}`}
          </div>
        )}
      </div>
      <div style={{ ...styles.accentBar, background: tone === "amber" ? "var(--amber)" : "var(--teal)" }} />
    </div>
  );
}

const styles = {
  card: {
    background: "var(--surface)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-card)",
    position: "relative",
    overflow: "hidden",
    minWidth: "0",
  },
  perforation: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0 10px",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "6px",
  },
  dot: {
    width: "4px",
    height: "4px",
    borderRadius: "50%",
    background: "var(--paper)",
    marginTop: "-2px",
  },
  body: {
    padding: "22px 20px 18px",
  },
  label: {
    fontSize: "11.5px",
    fontWeight: 600,
    color: "var(--ink-soft)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "10px",
  },
  value: {
    fontSize: "26px",
    fontWeight: 600,
    color: "var(--ink)",
    lineHeight: 1,
  },
  prefix: {
    fontSize: "16px",
    color: "var(--ink-soft)",
    marginRight: "2px",
  },
  trendPill: {
    display: "inline-block",
    marginTop: "12px",
    padding: "3px 9px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
  },
  accentBar: {
    height: "3px",
    width: "100%",
  },
};
