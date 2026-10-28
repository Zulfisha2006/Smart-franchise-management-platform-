import { useState } from "react";
import { updateTicket } from "../api/api";
import Badge from "./Badge";
import StatTicket from "./StatTicket";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * TicketsOverview — Admin ticket management interface.
 * Features:
 *   - Aggregated network ticket stats
 *   - Multi-parameter filtering (status, outlet, search query)
 *   - Interactive management modal to transition ticket status & compose official replies
 */
export default function TicketsOverview({
  tickets = [],
  outlets = [],
  onReload,
}) {
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminReply, setAdminReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Filter states
  const [statusFilter, setStatusFilter] = useState("all");
  const [outletFilter, setOutletFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;

  const handleOpenTicketModal = (ticket) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status);
    setAdminReply(ticket.admin_reply || "");
    setSaveError("");
    setSaveSuccess("");
  };

  const handleCloseModal = () => {
    setSelectedTicket(null);
    setSaveError("");
    setSaveSuccess("");
  };

  const handleSaveTicket = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      await updateTicket(selectedTicket.id, {
        status: newStatus,
        admin_reply: adminReply.trim(),
      });
      setSaveSuccess("Ticket updated and response saved!");
      if (onReload) await onReload();
      setTimeout(() => {
        handleCloseModal();
      }, 900);
    } catch (err) {
      setSaveError(
        err.response?.data?.detail || "Could not update ticket. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (outletFilter !== "all" && String(t.outlet) !== String(outletFilter)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSubject = t.subject?.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchOutlet = t.outlet_name?.toLowerCase().includes(q);
      const matchCity = t.outlet_city?.toLowerCase().includes(q);
      const matchOwner = t.owner_username?.toLowerCase().includes(q);
      if (!matchSubject && !matchDesc && !matchOutlet && !matchCity && !matchOwner) {
        return false;
      }
    }
    return true;
  });

  return (
    <div style={styles.container}>
      {/* Stat Ticket summary grid */}
      <div style={styles.statsGrid}>
        <StatTicket
          label="Total Support Tickets"
          value={tickets.length}
          prefix=""
        />
        <StatTicket
          label="Open / Unassigned"
          value={openCount}
          prefix=""
          tone={openCount > 0 ? "amber" : "default"}
        />
        <StatTicket
          label="In Progress / In Resolution"
          value={inProgressCount}
          prefix=""
          tone="default"
        />
        <StatTicket
          label="Resolved Tickets"
          value={resolvedCount}
          prefix=""
        />
      </div>

      {/* Main Table Card */}
      <div style={styles.card}>
        <div style={styles.filterBar}>
          <div>
            <h3 style={styles.cardHeading}>Franchise Support Tickets</h3>
            <p style={styles.cardSub}>
              Review tickets raised by franchise owners, assign status, and provide official resolution.
            </p>
          </div>

          <div style={styles.filterControls}>
            <input
              style={styles.searchInput}
              placeholder="Search subject, outlet, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              style={styles.selectInput}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses ({tickets.length})</option>
              <option value="open">Open ({openCount})</option>
              <option value="in_progress">In Progress ({inProgressCount})</option>
              <option value="resolved">Resolved ({resolvedCount})</option>
            </select>

            {outlets.length > 0 && (
              <select
                style={styles.selectInput}
                value={outletFilter}
                onChange={(e) => setOutletFilter(e.target.value)}
              >
                <option value="all">All Outlets</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.outlet_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {filteredTickets.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyTitle}>No matching support tickets</div>
            <div style={styles.emptySub}>
              Tickets raised by franchise owners will appear here for HQ resolution.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Outlet & Owner</th>
                  <th style={styles.th}>Subject & Snippet</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Raised At</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => {
                  const hasReply = Boolean(ticket.admin_reply && ticket.admin_reply.trim());
                  return (
                    <tr
                      key={ticket.id}
                      style={ticket.status === "open" ? styles.openRow : undefined}
                    >
                      <td style={styles.td} className="mono">
                        <span style={styles.idBadge}>#{ticket.id}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.outletName}>{ticket.outlet_name}</div>
                        <div style={styles.outletCity}>
                          {ticket.outlet_city} · {ticket.owner_username}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.subjectText}>{ticket.subject}</div>
                        <div style={styles.descSnippet}>
                          {ticket.description?.length > 85
                            ? `${ticket.description.substring(0, 85)}...`
                            : ticket.description}
                        </div>
                        {hasReply && (
                          <span style={styles.repliedTag}>HQ Replied</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <Badge tone={ticket.status}>
                          {ticket.status_display || ticket.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td style={{ ...styles.td, color: "var(--ink-soft)" }} className="mono">
                        {formatDate(ticket.created_at)}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <button
                          style={styles.actionBtn}
                          onClick={() => handleOpenTicketModal(ticket)}
                        >
                          Manage & Reply →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Response & Status Update Modal */}
      {selectedTicket && (
        <div style={styles.modalOverlay} onClick={handleCloseModal}>
          <div
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTag}>
                  Ticket #{selectedTicket.id} · {selectedTicket.outlet_name} ({selectedTicket.outlet_city})
                </div>
                <h3 style={styles.modalHeading}>{selectedTicket.subject}</h3>
              </div>
              <button style={styles.closeBtn} onClick={handleCloseModal}>
                Close
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.ticketDetailSection}>
                <div style={styles.detailLabel}>Outlet Owner Details</div>
                <div style={styles.detailText}>
                  <strong>{selectedTicket.owner_username}</strong> · Raised on{" "}
                  <span className="mono">{formatDate(selectedTicket.created_at)}</span>
                </div>

                <div style={{ ...styles.detailLabel, marginTop: "14px" }}>Issue Description</div>
                <div style={styles.descriptionBox}>
                  {selectedTicket.description}
                </div>
              </div>

              {saveError && <div style={styles.errorBox}>{saveError}</div>}
              {saveSuccess && <div style={styles.successBox}>{saveSuccess}</div>}

              <form onSubmit={handleSaveTicket} style={styles.updateForm}>
                <label style={styles.formLabel}>Update Ticket Status</label>
                <select
                  style={styles.modalSelect}
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  required
                >
                  <option value="open">Open (Awaiting Action)</option>
                  <option value="in_progress">In Progress (Under Resolution)</option>
                  <option value="resolved">Resolved (Issue Addressed)</option>
                </select>

                <label style={styles.formLabel}>
                  HQ Admin Reply / Resolution Notes
                </label>
                <textarea
                  style={styles.modalTextarea}
                  placeholder="Type an official reply visible to the franchise owner..."
                  rows={4}
                  value={adminReply}
                  onChange={(e) => setAdminReply(e.target.value)}
                />

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    style={styles.cancelBtn}
                    onClick={handleCloseModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={styles.saveBtn}
                    disabled={saving}
                  >
                    {saving ? "Saving Changes..." : "Save Status & Reply"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
    padding: "24px",
  },
  filterBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "18px",
    flexWrap: "wrap",
    gap: "12px",
  },
  cardHeading: { fontSize: "16px", marginBottom: "3px" },
  cardSub: { color: "var(--ink-soft)", fontSize: "12.5px" },
  filterControls: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  searchInput: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1.5px solid var(--border)",
    fontSize: "12.5px",
    minWidth: "240px",
    outline: "none",
    background: "var(--surface)",
  },
  selectInput: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1.5px solid var(--border)",
    fontSize: "12.5px",
    background: "var(--surface)",
    outline: "none",
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "48px 16px",
    color: "var(--ink-soft)",
  },
  emptyIcon: {
    fontSize: "36px",
    display: "block",
    marginBottom: "8px",
  },
  emptyTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--ink)",
    marginBottom: "4px",
  },
  emptySub: {
    fontSize: "12.5px",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "9px 10px",
    fontSize: "11.5px",
    color: "var(--ink-soft)",
    borderBottom: "2px solid var(--border)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    fontWeight: 600,
  },
  td: { padding: "13px 10px", fontSize: "13.5px", borderBottom: "1px solid var(--border)" },
  openRow: {
    background: "rgba(226, 139, 38, 0.02)",
  },
  idBadge: {
    fontWeight: 700,
    color: "var(--ink-soft)",
    fontSize: "12px",
  },
  outletName: {
    fontWeight: 600,
    color: "var(--ink)",
  },
  outletCity: {
    fontSize: "12px",
    color: "var(--ink-soft)",
    marginTop: "2px",
  },
  subjectText: {
    fontWeight: 600,
    color: "var(--ink)",
  },
  descSnippet: {
    fontSize: "12px",
    color: "var(--ink-soft)",
    marginTop: "2px",
    lineHeight: 1.4,
  },
  repliedTag: {
    display: "inline-block",
    marginTop: "4px",
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--teal)",
  },
  actionBtn: {
    padding: "6px 14px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s ease",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(20, 33, 61, 0.5)",
    backdropFilter: "blur(2px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modalContent: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-pop)",
    width: "100%",
    maxWidth: "580px",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "20px 24px",
    borderBottom: "1px solid var(--border)",
  },
  modalTag: {
    fontSize: "12px",
    color: "var(--teal)",
    fontWeight: 600,
    marginBottom: "4px",
  },
  modalHeading: {
    fontSize: "17px",
    margin: 0,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    fontSize: "16px",
    color: "var(--ink-soft)",
    cursor: "pointer",
    padding: "4px 8px",
  },
  modalBody: {
    padding: "20px 24px",
  },
  ticketDetailSection: {
    background: "var(--surface-sunken)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "14px 16px",
    marginBottom: "20px",
  },
  detailLabel: {
    fontSize: "11.5px",
    textTransform: "uppercase",
    fontWeight: 700,
    letterSpacing: "0.03em",
    color: "var(--ink-soft)",
    marginBottom: "4px",
  },
  detailText: {
    fontSize: "13px",
    color: "var(--ink)",
  },
  descriptionBox: {
    fontSize: "13.5px",
    color: "var(--ink)",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
  },
  updateForm: {
    display: "flex",
    flexDirection: "column",
  },
  formLabel: {
    display: "block",
    fontSize: "12.5px",
    fontWeight: 600,
    color: "var(--ink)",
    marginBottom: "6px",
    marginTop: "12px",
  },
  modalSelect: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1.5px solid var(--border)",
    fontSize: "13.5px",
    background: "var(--surface)",
    outline: "none",
    boxSizing: "border-box",
  },
  modalTextarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1.5px solid var(--border)",
    fontSize: "13.5px",
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
    marginTop: "20px",
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
    padding: "10px 12px",
    borderRadius: "6px",
    fontSize: "13px",
    marginBottom: "12px",
    fontWeight: 500,
  },
  successBox: {
    background: "var(--green-tint)",
    color: "var(--green)",
    padding: "10px 12px",
    borderRadius: "6px",
    fontSize: "13px",
    marginBottom: "12px",
    fontWeight: 500,
  },
};
