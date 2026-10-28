import { useState, useEffect } from "react";

/**
 * SaleEntryPanel
 * 
 * Enforces business rules:
 * 1. Fixed time window: Daily sales can only be entered after 9:00 PM IST (end-of-day reporting).
 * 2. Immutable lock: Once saved for today, entry is locked and cannot be edited.
 */
export default function SaleEntryPanel({
  summary,
  saleForm,
  saleError,
  saleSubmitting,
  onSaleChange,
  onSaleSubmit,
}) {
  const ENTRY_HOUR = 21; // 9:00 PM IST

  // Helper to get current Date object in Asia/Kolkata timezone
  const getISTDate = () => {
    const now = new Date();
    const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    return new Date(istString);
  };

  const [istTime, setIstTime] = useState(getISTDate());

  // Keep clock updated every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setIstTime(getISTDate());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const currentHour = istTime.getHours();
  const currentMinute = istTime.getMinutes();
  const isWindowOpen = currentHour >= ENTRY_HOUR;

  // Has today's sale already been logged and locked?
  const isTodayLocked = Boolean(
    summary?.today_sale_locked ||
    (summary?.today_sales && parseFloat(summary.today_sales) > 0)
  );

  // Remaining time calculation until 9 PM IST
  const minutesUntilOpen = isWindowOpen
    ? 0
    : (ENTRY_HOUR - currentHour - 1) * 60 + (60 - currentMinute);
  const hoursLeft = Math.floor(minutesUntilOpen / 60);
  const minsLeft = minutesUntilOpen % 60;

  const formattedIST = istTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h3 style={styles.title}>Daily Sales Entry</h3>
          <p style={styles.subtitle}>End-of-day revenue reconciliation</p>
        </div>
        <div style={styles.clockPill}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{formattedIST} IST</span>
        </div>
      </div>

      {/* STATE 1: TODAY'S SALE IS RECORDED AND LOCKED */}
      {isTodayLocked ? (
        <div style={styles.lockedBox}>
          <div style={styles.lockedHeader}>
            <div style={styles.lockedBadge}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Entry Finalized &amp; Locked</span>
            </div>
            <span style={styles.lockDate}>Today</span>
          </div>

          <div style={styles.recordedAmountBlock}>
            <div style={styles.recordedLabel}>Logged Amount</div>
            <div style={styles.recordedAmount}>
              ₹{parseFloat(summary?.today_sales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div style={styles.lockNotice}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "1px" }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              Today&apos;s daily revenue has been successfully saved to the ledger. Once recorded, entries are locked to ensure franchise audit compliance.
            </span>
          </div>
        </div>
      ) : !isWindowOpen ? (
        /* STATE 2: BEFORE 9:00 PM IST — WINDOW CLOSED */
        <div style={styles.gateBox}>
          <div style={styles.gateIconWrap}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>

          <div style={styles.gateTitle}>Entry Window Closed</div>
          <div style={styles.gateCountdown}>
            Opens in {hoursLeft > 0 ? `${hoursLeft}h ` : ""}{minsLeft}m (9:00 PM IST)
          </div>

          <p style={styles.gateDescription}>
            To ensure complete and accurate daily reconciliation, sales can only be entered at the end of the business day starting from <strong>9:00 PM IST</strong>.
          </p>

          <div style={styles.policyPill}>
            <span>Entry window: 9:00 PM – 11:59 PM IST daily</span>
          </div>
        </div>
      ) : (
        /* STATE 3: AFTER 9:00 PM IST & NOT YET SAVED — FORM ACTIVE */
        <div>
          <div style={styles.windowOpenBanner}>
            <div style={styles.openIndicatorDot} />
            <span style={styles.openBannerText}>
              Window Open: Daily sales entry is active until midnight.
            </span>
          </div>

          <div style={styles.lockWarningBox}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>
              <strong>Note:</strong> Please verify your figures carefully. Once submitted, today&apos;s entry is permanently locked and cannot be edited.
            </span>
          </div>

          {saleError && <div style={styles.errorBanner}>{saleError}</div>}

          <form onSubmit={onSaleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>
                Gross Sales Amount (₹) <span style={styles.required}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                name="amount"
                placeholder="e.g. 42500"
                value={saleForm.amount}
                onChange={onSaleChange}
                required
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Shift Notes / Remarks (Optional)</label>
              <input
                type="text"
                name="note"
                placeholder="e.g. UPI ₹30,000 / Cash ₹12,500, evening rush"
                value={saleForm.note}
                onChange={onSaleChange}
                style={styles.input}
              />
            </div>

            <button
              type="submit"
              disabled={saleSubmitting}
              style={{
                ...styles.submitBtn,
                opacity: saleSubmitting ? 0.7 : 1,
                cursor: saleSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {saleSubmitting ? "Locking & Saving Entry..." : "Submit & Lock Today's Sales"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    paddingBottom: "12px",
    borderBottom: "1px solid var(--border)",
  },
  title: {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
  },
  subtitle: {
    fontSize: "12.5px",
    color: "var(--ink-soft)",
    margin: "2px 0 0 0",
  },
  clockPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "20px",
    background: "var(--surface-sunken)",
    border: "1px solid var(--border)",
    fontSize: "11.5px",
    fontFamily: "var(--font-mono)",
    color: "var(--ink)",
    whiteSpace: "nowrap",
  },
  // --- Locked state ---
  lockedBox: {
    background: "var(--surface-sunken)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  lockedHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lockedBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "var(--teal-tint)",
    color: "var(--teal-deep)",
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
  },
  lockDate: {
    fontSize: "11.5px",
    fontFamily: "var(--font-mono)",
    color: "var(--ink-soft)",
  },
  recordedAmountBlock: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "14px 16px",
  },
  recordedLabel: {
    fontSize: "11.5px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--ink-soft)",
    fontWeight: 600,
    marginBottom: "4px",
  },
  recordedAmount: {
    fontSize: "24px",
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
    color: "var(--ink)",
  },
  lockNotice: {
    display: "flex",
    gap: "8px",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "var(--ink-soft)",
  },
  // --- Gate Closed state ---
  gateBox: {
    background: "var(--surface-sunken)",
    border: "1px dashed var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "24px 20px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  gateIconWrap: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "var(--amber-tint)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "12px",
  },
  gateTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--ink)",
    marginBottom: "4px",
  },
  gateCountdown: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--amber)",
    fontFamily: "var(--font-mono)",
    marginBottom: "10px",
  },
  gateDescription: {
    fontSize: "12.5px",
    color: "var(--ink-soft)",
    lineHeight: 1.5,
    maxWidth: "360px",
    margin: "0 0 14px 0",
  },
  policyPill: {
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    color: "var(--ink-soft)",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "3px 10px",
  },
  // --- Active Form state ---
  windowOpenBanner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderRadius: "8px",
    background: "var(--green-tint)",
    color: "var(--green)",
    fontSize: "12px",
    fontWeight: 500,
  },
  openIndicatorDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "var(--green)",
    flexShrink: 0,
  },
  openBannerText: {
    lineHeight: 1.3,
  },
  lockWarningBox: {
    display: "flex",
    gap: "8px",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "var(--amber-tint)",
    color: "#7A4100",
    fontSize: "11.5px",
    lineHeight: 1.4,
    marginTop: "10px",
    marginBottom: "12px",
  },
  errorBanner: {
    padding: "10px 12px",
    borderRadius: "8px",
    background: "var(--red-tint)",
    color: "var(--red)",
    fontSize: "12px",
    marginBottom: "12px",
    border: "1px solid rgba(179, 38, 30, 0.2)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "12.5px",
    fontWeight: 600,
    color: "var(--ink)",
  },
  required: {
    color: "var(--red)",
  },
  input: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--ink)",
    fontSize: "13.5px",
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.15s ease",
  },
  submitBtn: {
    marginTop: "4px",
    padding: "11px 16px",
    borderRadius: "8px",
    border: "none",
    background: "var(--teal)",
    color: "#FFFFFF",
    fontSize: "13px",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxShadow: "0 2px 4px rgba(13, 92, 74, 0.2)",
    transition: "background 0.15s ease",
  },
};
