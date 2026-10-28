import { useState } from "react";
import { updateRestockRequest } from "../api/api";
import Badge from "./Badge";
import StatTicket from "./StatTicket";

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
 * RestockRequestsOverview — Admin side.
 * Shows all network-wide restock requests with filtering.
 * Admin can approve, reject, or fulfill each request via an action modal.
 */
export default function RestockRequestsOverview({
  requests = [],
  outlets = [],
  onReload,
}) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Filter states
  const [statusFilter, setStatusFilter] = useState("all");
  const [outletFilter, setOutletFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const fulfilledCount = requests.filter((r) => r.status === "fulfilled").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  const handleOpenModal = (req) => {
    setSelectedRequest(req);
    setNewStatus(req.status === "pending" ? "approved" : req.status);
    setAdminNote(req.admin_note || "");
    setSaveError("");
    setSaveSuccess("");
  };

  const handleCloseModal = () => {
    setSelectedRequest(null);
    setSaveError("");
    setSaveSuccess("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");
    try {
      await updateRestockRequest(selectedRequest.id, {
        status: newStatus,
        admin_note: adminNote.trim(),
      });
      const actionLabel =
        newStatus === "fulfilled"
          ? "Request fulfilled — stock automatically updated!"
          : newStatus === "approved"
          ? "Request approved and owner notified."
          : "Request rejected.";
      setSaveSuccess(actionLabel);
      if (onReload) await onReload();
      setTimeout(() => handleCloseModal(), 900);
    } catch (err) {
      setSaveError(
        err.response?.data?.detail || "Could not update request. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // Filtered list
  const filtered = requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (outletFilter !== "all" && String(r.outlet) !== String(outletFilter)) return false;
    if (
      searchQuery.trim() &&
      !r.stock_item_name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !r.outlet_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div style={styles.wrapper}>
      {/* Stats Row */}
      <div style={styles.statsGrid}>
        <StatTicket
          label="Pending Requests"
          value={pendingCount}
          prefix=""
          tone={pendingCount > 0 ? "amber" : "default"}
        />
        <StatTicket label="Approved" value={approvedCount} prefix="" />
        <StatTicket label="Fulfilled" value={fulfilledCount} prefix="" />
        <StatTicket
          label="Rejected"
          value={rejectedCount}
          prefix=""
          tone={rejectedCount > 0 ? "red" : "default"}
        />
      </div>

      <div style={styles.card}>
        {/* Header */}
        <div style={styles.headerRow}>
          <div>
            <h3 style={styles.heading}>Restock Requests — Network View</h3>
            <p style={styles.subheading}>
              Review, approve, reject, or fulfill stock replenishment requests from franchise owners.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={styles.filterBar}>
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search by item or outlet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            style={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            style={styles.filterSelect}
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
          >
            <option value="all">All Outlets</option>
            {outlets
              .filter((o) => o.status === "approved")
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.outlet_name}
                </option>
              ))}
          </select>
        </div>

        {/* Request Table / List */}
        {filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyTitle}>
              {requests.length === 0
                ? "No restock requests yet across the network"
                : "No requests match the current filters"}
            </div>
            <div style={styles.emptySub}>
              {requests.length === 0
                ? "Franchise owners will appear here when they request stock replenishment."
                : "Try adjusting the status or outlet filter."}
            </div>
          </div>
        ) : (
          <div style={styles.requestList}>
            {filtered.map((r) => (
              <div key={r.id} style={styles.requestItem}>
                <div style={styles.requestHeader}>
                  <div style={styles.requestTitleSection}>
                    <div style={styles.requestId} className="mono">#{r.id}</div>
                    <div>
                      <div style={styles.requestItemName}>{r.stock_item_name}</div>
                      <div style={styles.requestMeta2}>
                        <span style={styles.outletTag}>{r.outlet_name}</span>
                        <span style={styles.cityTag}>{r.outlet_city}</span>
                        <span style={styles.qtyTag} className="mono">
                          {parseFloat(r.requested_qty)} {r.stock_item_unit} requested
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={styles.requestRightCol}>
                    <Badge tone={STATUS_TONE[r.status] || "pending"}>
                      {r.status_display || r.status}
                    </Badge>
                    <span style={styles.dateText} className="mono">
                      {formatDate(r.requested_at)}
                    </span>
                    {r.status !== "fulfilled" && (
                      <button
                        style={styles.actionBtn}
                        onClick={() => handleOpenModal(r)}
                      >
                        {r.status === "pending" ? "Review" : "Update"}
                      </button>
                    )}
                  </div>
                </div>

                {r.note ? (
                  <div style={styles.noteBox}>
                    <span style={styles.noteLabel}>Owner note: </span>{r.note}
                  </div>
                ) : null}

                {r.admin_note ? (
                  <div style={styles.adminNoteBox}>
                    <span style={styles.noteLabel}>HQ note: </span>{r.admin_note}
                  </div>
                ) : null}

                {r.status === "fulfilled" && (
                  <div style={styles.fulfilledBanner}>
                    ✓ Stock was replenished — inventory auto-updated by {parseFloat(r.requested_qty)} {r.stock_item_unit}.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {selectedRequest && (
        <div style={styles.modalOverlay} onClick={handleCloseModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>
                  Review Restock Request #{selectedRequest.id}
                </div>
                <div style={styles.modalSub}>
                  {selectedRequest.outlet_name} · {selectedRequest.stock_item_name} ·{" "}
                  <span className="mono">
                    {parseFloat(selectedRequest.requested_qty)} {selectedRequest.stock_item_unit}
                  </span>
                </div>
              </div>
              <button style={styles.modalCloseBtn} onClick={handleCloseModal}>✕</button>
            </div>

            {selectedRequest.note && (
              <div style={styles.modalOwnerNote}>
                <span style={styles.noteLabel}>Owner's note: </span>
                {selectedRequest.note}
              </div>
            )}

            {saveError && <div style={styles.errorBox}>{saveError}</div>}
            {saveSuccess && <div style={styles.successBox}>{saveSuccess}</div>}

            <form onSubmit={handleSave}>
              <label style={styles.label}>Action</label>
              <div style={styles.actionButtonGroup}>
                {["approved", "rejected", "fulfilled"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    style={{
                      ...styles.actionToggle,
                      ...(newStatus === s ? styles.actionToggleActive[s] : {}),
                    }}
                    onClick={() => setNewStatus(s)}
                  >
                    {s === "approved" ? "✅ Approve" : s === "rejected" ? "❌ Reject" : "📦 Fulfill"}
                  </button>
                ))}
              </div>

              {newStatus === "fulfilled" && (
                <div style={styles.fulfillNote}>
                  Marking as fulfilled will automatically add{" "}
                  <strong>{parseFloat(selectedRequest.requested_qty)} {selectedRequest.stock_item_unit}</strong>{" "}
                  to the outlet's inventory.
                </div>
              )}

              <label style={styles.label}>Note to Owner (optional)</label>
              <textarea
                style={styles.textarea}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="e.g. Stock dispatched, expected delivery in 2–3 days. / Item currently out of season."
                rows={3}
              />

              <div style={styles.modalActions}>
                <button
                  style={styles.cancelBtn}
                  type="button"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button
                  style={styles.saveBtn}
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save & Notify Owner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {},
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
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
  filterBar: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
  searchInput: {
    flex: 1,
    minWidth: "180px",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1.5px solid var(--border)",
    fontSize: "13px",
    outline: "none",
    background: "var(--surface)",
  },
  filterSelect: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1.5px solid var(--border)",
    fontSize: "13px",
    outline: "none",
    background: "var(--surface)",
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 16px",
    color: "var(--ink-soft)",
  },
  emptyTitle: { fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "4px" },
  emptySub: { fontSize: "12.5px" },
  requestList: { display: "flex", flexDirection: "column", gap: "14px" },
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
    marginBottom: "8px",
    flexWrap: "wrap",
    gap: "10px",
  },
  requestTitleSection: { display: "flex", alignItems: "flex-start", gap: "10px" },
  requestId: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--ink-soft)",
    padding: "2px 6px",
    background: "var(--surface-sunken)",
    borderRadius: "4px",
    marginTop: "2px",
  },
  requestItemName: { fontSize: "15px", fontWeight: 700, color: "var(--ink)" },
  requestMeta2: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginTop: "4px",
    flexWrap: "wrap",
  },
  outletTag: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--ink-soft)",
    background: "var(--surface-sunken)",
    padding: "2px 7px",
    borderRadius: "4px",
  },
  cityTag: {
    fontSize: "12px",
    color: "var(--ink-soft)",
  },
  qtyTag: {
    fontSize: "12px",
    color: "var(--teal-deep)",
    fontWeight: 600,
  },
  requestRightCol: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  dateText: { fontSize: "11.5px", color: "var(--ink-soft)" },
  actionBtn: {
    padding: "6px 14px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  noteBox: {
    fontSize: "13px",
    color: "var(--ink-soft)",
    marginTop: "6px",
    lineHeight: 1.5,
  },
  adminNoteBox: {
    fontSize: "13px",
    color: "var(--teal-deep)",
    marginTop: "6px",
    lineHeight: 1.5,
  },
  noteLabel: { fontWeight: 600, color: "var(--ink)" },
  fulfilledBanner: {
    marginTop: "10px",
    padding: "8px 12px",
    background: "var(--green-tint)",
    color: "var(--green)",
    borderRadius: "6px",
    fontSize: "12.5px",
    fontWeight: 600,
  },
  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modal: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    padding: "28px",
    width: "100%",
    maxWidth: "520px",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "18px",
    gap: "10px",
  },
  modalTitle: { fontSize: "16px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" },
  modalSub: { fontSize: "13px", color: "var(--ink-soft)" },
  modalCloseBtn: {
    background: "none",
    border: "none",
    fontSize: "16px",
    cursor: "pointer",
    color: "var(--ink-soft)",
    padding: "4px",
    lineHeight: 1,
  },
  modalOwnerNote: {
    background: "var(--surface-sunken)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    color: "var(--ink-soft)",
    marginBottom: "16px",
    lineHeight: 1.5,
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--ink)",
    marginBottom: "8px",
    marginTop: "14px",
  },
  actionButtonGroup: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  actionToggle: {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "1.5px solid var(--border)",
    background: "var(--surface-sunken)",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    color: "var(--ink-soft)",
  },
  actionToggleActive: {
    approved: {
      background: "var(--teal-tint)",
      borderColor: "var(--teal)",
      color: "var(--teal-deep)",
    },
    rejected: {
      background: "var(--red-tint)",
      borderColor: "var(--red)",
      color: "var(--red)",
    },
    fulfilled: {
      background: "var(--green-tint)",
      borderColor: "var(--green)",
      color: "var(--green)",
    },
  },
  fulfillNote: {
    marginTop: "10px",
    padding: "10px 12px",
    background: "var(--green-tint)",
    color: "var(--green)",
    borderRadius: "6px",
    fontSize: "12.5px",
    fontWeight: 500,
    lineHeight: 1.5,
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
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "18px",
  },
  cancelBtn: {
    padding: "9px 16px",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--ink-soft)",
    cursor: "pointer",
  },
  saveBtn: {
    padding: "9px 20px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
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
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "12.5px",
    marginBottom: "10px",
    fontWeight: 500,
  },
};
