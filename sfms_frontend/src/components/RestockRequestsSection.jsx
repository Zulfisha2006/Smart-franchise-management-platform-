import { useState } from "react";
import { createRestockRequest } from "../api/api";
import Badge from "./Badge";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_TONE = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  fulfilled: "teal",
};

/**
 * RestockRequestsSection — Owner side.
 * Shows all restock requests for this owner's outlet.
 * Owner can raise a new request by picking a stock item and entering a quantity.
 */
export default function RestockRequestsSection({ requests = [], stockItems = [], onReload }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ stock_item: "", requested_qty: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const fulfilledCount = requests.filter((r) => r.status === "fulfilled").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.stock_item) {
      setError("Please select a stock item.");
      return;
    }
    if (!form.requested_qty || parseFloat(form.requested_qty) <= 0) {
      setError("Please enter a valid quantity greater than 0.");
      return;
    }
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await createRestockRequest({
        stock_item: parseInt(form.stock_item),
        requested_qty: form.requested_qty,
        note: form.note.trim(),
      });
      setForm({ stock_item: "", requested_qty: "", note: "" });
      setSuccess("Restock request submitted! HQ will review it shortly.");
      setShowForm(false);
      if (onReload) await onReload();
    } catch (err) {
      const data = err.response?.data;
      const msg =
        data?.detail ||
        (data && typeof data === "object" ? Object.values(data)[0] : null);
      setError((Array.isArray(msg) ? msg[0] : msg) || "Could not submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.headerRow}>
        <div>
          <h3 style={styles.heading}>Restock Requests</h3>
          <p style={styles.subheading}>
            Running low? Request stock replenishment directly from HQ.
          </p>
        </div>
        <button style={styles.raiseBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Close Form" : "+ Request Restock"}
        </button>
      </div>

      {/* Stats Bar */}
      <div style={styles.statusBar}>
        <div style={styles.statusPill}>
          <span style={styles.statusLabel}>Total:</span>
          <span style={styles.statusValue} className="mono">{requests.length}</span>
        </div>
        <div style={styles.statusPill}>
          <span style={styles.statusLabel}>Pending:</span>
          <span style={{ ...styles.statusValue, color: "var(--amber)" }} className="mono">{pendingCount}</span>
        </div>
        <div style={styles.statusPill}>
          <span style={styles.statusLabel}>Approved:</span>
          <span style={{ ...styles.statusValue, color: "var(--teal)" }} className="mono">{approvedCount}</span>
        </div>
        <div style={styles.statusPill}>
          <span style={styles.statusLabel}>Fulfilled:</span>
          <span style={{ ...styles.statusValue, color: "var(--green)" }} className="mono">{fulfilledCount}</span>
        </div>
        <div style={styles.statusPill}>
          <span style={styles.statusLabel}>Rejected:</span>
          <span style={{ ...styles.statusValue, color: "var(--red)" }} className="mono">{rejectedCount}</span>
        </div>
      </div>

      {/* Request Form */}
      {showForm && (
        <div style={styles.formContainer}>
          <div style={styles.formTitle}>New Restock Request</div>
          {error && <div style={styles.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <label style={styles.label}>Stock Item</label>
            {stockItems.length === 0 ? (
              <div style={styles.noItemsNote}>
                No stock items found. Add items in the Inventory section first.
              </div>
            ) : (
              <select
                style={styles.input}
                name="stock_item"
                value={form.stock_item}
                onChange={handleChange}
                required
              >
                <option value="">— Select an item —</option>
                {stockItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {parseFloat(item.current_quantity)} {item.unit} in stock
                    {item.is_low_stock ? " ⚠️ LOW" : ""}
                  </option>
                ))}
              </select>
            )}

            <label style={styles.label}>Quantity Requested</label>
            <input
              style={styles.input}
              type="number"
              step="0.01"
              min="0.01"
              name="requested_qty"
              value={form.requested_qty}
              onChange={handleChange}
              placeholder="e.g. 100"
              required
            />

            <label style={styles.label}>Note to HQ (optional)</label>
            <textarea
              style={styles.textarea}
              name="note"
              value={form.note}
              onChange={handleChange}
              placeholder="e.g. Weekend rush expected, need urgently by Friday"
              rows={3}
            />

            <div style={styles.formActions}>
              <button
                style={styles.cancelBtn}
                type="button"
                onClick={() => { setShowForm(false); setError(""); }}
              >
                Cancel
              </button>
              <button
                style={styles.submitBtn}
                type="submit"
                disabled={submitting || stockItems.length === 0}
              >
                {submitting ? "Submitting..." : "Submit Request to HQ"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Success message */}
      {success && !showForm && <div style={styles.successBox}>{success}</div>}

      {/* Request List */}
      <div style={styles.requestList}>
        {requests.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyTitle}>No restock requests yet</div>
            <div style={styles.emptySub}>
              When stock runs low, click "Request Restock" above to notify HQ.
            </div>
          </div>
        ) : (
          requests.map((r) => (
            <div key={r.id} style={styles.requestItem}>
              <div style={styles.requestHeader}>
                <div style={styles.requestTitleSection}>
                  <div style={styles.requestId} className="mono">#{r.id}</div>
                  <div>
                    <div style={styles.requestItemName}>{r.stock_item_name}</div>
                    <div style={styles.requestQty} className="mono">
                      {parseFloat(r.requested_qty)} {r.stock_item_unit} requested
                    </div>
                  </div>
                </div>
                <div style={styles.requestMeta}>
                  <Badge tone={STATUS_TONE[r.status] || "pending"}>
                    {r.status_display || r.status}
                  </Badge>
                  <span style={styles.dateText} className="mono">
                    {formatDate(r.requested_at)}
                  </span>
                </div>
              </div>

              {r.note ? (
                <div style={styles.noteBox}>
                  <span style={styles.noteLabel}>Your note: </span>{r.note}
                </div>
              ) : null}

              {/* Admin Response */}
              {r.admin_note && r.admin_note.trim() ? (
                <div style={styles.adminReplyBox}>
                  <div style={styles.replyHeader}>
                    <span style={styles.replyBadge}>HQ Response</span>
                    <span style={styles.replyDate} className="mono">
                      Updated {formatDate(r.updated_at)}
                    </span>
                  </div>
                  <div style={styles.replyContent}>{r.admin_note}</div>
                </div>
              ) : r.status === "pending" ? (
                <div style={styles.awaitingBox}>
                  <span style={styles.awaitingDot} />
                  <span>Awaiting HQ review</span>
                </div>
              ) : null}

              {/* Fulfilled banner */}
              {r.status === "fulfilled" && (
                <div style={styles.fulfilledBanner}>
                  ✓ Stock has been replenished — your inventory was automatically updated.
                </div>
              )}
            </div>
          ))
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
    marginBottom: "16px",
    flexWrap: "wrap",
    gap: "12px",
  },
  heading: { fontSize: "16px", fontWeight: 700, margin: 0 },
  subheading: { color: "var(--ink-soft)", fontSize: "13px", marginTop: "2px" },
  raiseBtn: {
    padding: "8px 16px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "12.5px",
    fontWeight: 600,
    cursor: "pointer",
  },
  statusBar: {
    display: "flex",
    gap: "12px",
    padding: "10px 14px",
    background: "var(--surface-sunken)",
    borderRadius: "8px",
    marginBottom: "20px",
    flexWrap: "wrap",
    border: "1px solid var(--border)",
  },
  statusPill: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px" },
  statusLabel: { color: "var(--ink-soft)", fontWeight: 500 },
  statusValue: { fontWeight: 700, color: "var(--ink)" },
  formContainer: {
    background: "var(--surface-sunken)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "18px 20px",
    marginBottom: "22px",
  },
  formTitle: { fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: "12px" },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--ink)",
    marginBottom: "6px",
    marginTop: "12px",
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "6px",
    border: "1.5px solid var(--border)",
    fontSize: "13px",
    outline: "none",
    background: "var(--surface)",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "6px",
    border: "1.5px solid var(--border)",
    fontSize: "13px",
    outline: "none",
    background: "var(--surface)",
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "var(--font-body)",
  },
  noItemsNote: {
    color: "var(--ink-soft)",
    fontSize: "13px",
    padding: "10px 0",
    fontStyle: "italic",
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "14px",
  },
  cancelBtn: {
    padding: "8px 14px",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "12.5px",
    fontWeight: 600,
    color: "var(--ink-soft)",
    cursor: "pointer",
  },
  submitBtn: {
    padding: "8px 18px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12.5px",
    fontWeight: 600,
    cursor: "pointer",
  },
  errorBox: {
    background: "var(--red-tint)",
    color: "var(--red)",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "12.5px",
    marginBottom: "10px",
    fontWeight: 500,
  },
  successBox: {
    background: "var(--green-tint)",
    color: "var(--green)",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 500,
    marginBottom: "18px",
  },
  requestList: { display: "flex", flexDirection: "column", gap: "14px" },
  emptyState: { textAlign: "center", padding: "40px 16px", color: "var(--ink-soft)" },
  emptyTitle: { fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "4px" },
  emptySub: { fontSize: "12.5px" },
  requestItem: {
    padding: "18px 20px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    boxShadow: "0 1px 3px rgba(27,31,29,0.02)",
  },
  requestHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "10px",
    flexWrap: "wrap",
    gap: "10px",
  },
  requestTitleSection: { display: "flex", alignItems: "center", gap: "10px" },
  requestId: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--ink-soft)",
    padding: "2px 6px",
    background: "var(--surface-sunken)",
    borderRadius: "4px",
  },
  requestItemName: { fontSize: "15px", fontWeight: 700, color: "var(--ink)" },
  requestQty: { fontSize: "12px", color: "var(--ink-soft)", marginTop: "2px" },
  requestMeta: { display: "flex", alignItems: "center", gap: "10px" },
  dateText: { fontSize: "11.5px", color: "var(--ink-soft)" },
  noteBox: {
    fontSize: "13px",
    color: "var(--ink-soft)",
    marginBottom: "10px",
    lineHeight: 1.5,
  },
  noteLabel: { fontWeight: 600, color: "var(--ink)" },
  adminReplyBox: {
    background: "var(--teal-tint)",
    border: "1px solid #C4DFD6",
    borderRadius: "8px",
    padding: "12px 16px",
    marginTop: "8px",
  },
  replyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
    flexWrap: "wrap",
    gap: "6px",
  },
  replyBadge: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--teal-deep)",
  },
  replyDate: { fontSize: "11px", color: "var(--teal-deep)", opacity: 0.8 },
  replyContent: {
    fontSize: "13px",
    color: "var(--teal-deep)",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    fontWeight: 500,
  },
  awaitingBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "var(--amber)",
    fontWeight: 600,
    paddingTop: "6px",
  },
  awaitingDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--amber)",
    display: "inline-block",
  },
  fulfilledBanner: {
    marginTop: "10px",
    padding: "8px 12px",
    background: "var(--green-tint)",
    color: "var(--green)",
    borderRadius: "6px",
    fontSize: "12.5px",
    fontWeight: 600,
  },
};
