import { useState } from "react";
import { createTicket } from "../api/api";
import Badge from "./Badge";

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
 * SupportTickets — Support ticketing system for Franchise Owners.
 * Features:
 *   - "Raise New Ticket" modal/form with validation
 *   - Chronological ticket list with live status Badges (Open, In Progress, Resolved)
 *   - Prominent HQ Official Reply box for tickets that have been reviewed/answered
 */
export default function SupportTickets({ tickets = [], onReload }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setError("Please enter a subject and detailed description.");
      return;
    }
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await createTicket({
        subject: subject.trim(),
        description: description.trim(),
      });
      setSubject("");
      setDescription("");
      setSuccess("Support ticket submitted! HQ team has been notified.");
      setShowForm(false);
      if (onReload) await onReload();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not submit ticket. Please check details and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.titleWithIcon}>
            <h3 style={styles.heading}>Support & Helpdesk</h3>
          </div>
          <p style={styles.subheading}>
            Raise operational issues, maintenance requests, or supply queries directly to HQ.
          </p>
        </div>

        <button
          style={styles.raiseBtn}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Close Form" : "+ Raise New Ticket"}
        </button>
      </div>

      {/* Quick Summary Pill Bar */}
      <div style={styles.statusBar}>
        <div style={styles.statusPill}>
          <span style={styles.statusLabel}>Total Tickets:</span>
          <span style={styles.statusValue} className="mono">{tickets.length}</span>
        </div>
        <div style={styles.statusPill}>
          <span style={styles.statusLabel}>Open:</span>
          <span style={{ ...styles.statusValue, color: "var(--amber)" }} className="mono">{openCount}</span>
        </div>
        <div style={styles.statusPill}>
          <span style={styles.statusLabel}>In Progress:</span>
          <span style={{ ...styles.statusValue, color: "var(--teal)" }} className="mono">{inProgressCount}</span>
        </div>
        <div style={styles.statusPill}>
          <span style={styles.statusLabel}>Resolved:</span>
          <span style={{ ...styles.statusValue, color: "var(--green)" }} className="mono">{resolvedCount}</span>
        </div>
      </div>

      {/* Raise Ticket Form */}
      {showForm && (
        <div style={styles.formContainer}>
          <div style={styles.formTitle}>Raise a New Support Ticket</div>
          {error && <div style={styles.errorBox}>{error}</div>}
          {success && <div style={styles.successBox}>{success}</div>}

          <form onSubmit={handleSubmit}>
            <label style={styles.label}>Subject / Issue Title</label>
            <input
              style={styles.input}
              placeholder="e.g. Broken POS Terminal, Delayed Dough Delivery, Billing Query"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />

            <label style={styles.label}>Detailed Description</label>
            <textarea
              style={styles.textarea}
              placeholder="Explain the issue in detail (timings, impact, error messages, equipment affected)..."
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />

            <div style={styles.formActions}>
              <button
                style={styles.cancelBtn}
                type="button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                style={styles.submitBtn}
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Submitting Ticket..." : "Submit Ticket to HQ"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ticket History */}
      <div style={styles.ticketList}>
        {tickets.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyTitle}>No support tickets raised yet</div>
            <div style={styles.emptySub}>
              Have an issue at your outlet? Click "Raise New Ticket" above to connect directly with HQ.
            </div>
          </div>
        ) : (
          tickets.map((t) => {
            const hasReply = Boolean(t.admin_reply && t.admin_reply.trim());
            return (
              <div key={t.id} style={styles.ticketItem}>
                <div style={styles.ticketHeader}>
                  <div style={styles.ticketTitleSection}>
                    <div style={styles.ticketId} className="mono">#{t.id}</div>
                    <h4 style={styles.ticketSubject}>{t.subject}</h4>
                  </div>
                  <div style={styles.ticketMeta}>
                    <Badge tone={t.status}>{t.status_display || t.status.replace("_", " ")}</Badge>
                    <span style={styles.dateText} className="mono">
                      {formatDate(t.created_at)}
                    </span>
                  </div>
                </div>

                <div style={styles.ticketDescription}>
                  {t.description}
                </div>

                {/* HQ Admin Reply Section */}
                {hasReply ? (
                  <div style={styles.adminReplyBox}>
                    <div style={styles.replyHeader}>
                      <div style={styles.replyBadge}>
                        HQ Official Response
                      </div>
                      <span style={styles.replyDate} className="mono">
                        Updated {formatDate(t.updated_at)}
                      </span>
                    </div>
                    <div style={styles.replyContent}>
                      {t.admin_reply}
                    </div>
                  </div>
                ) : (
                  <div style={styles.awaitingBox}>
                    <span style={styles.awaitingDot} />
                    <span>Awaiting HQ review & resolution</span>
                  </div>
                )}
              </div>
            );
          })
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
  titleWithIcon: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
  },
  headerIcon: {
    fontSize: "18px",
  },
  heading: {
    fontSize: "16px",
    fontWeight: 700,
    margin: 0,
  },
  subheading: {
    color: "var(--ink-soft)",
    fontSize: "13px",
  },
  raiseBtn: {
    padding: "8px 16px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "12.5px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s ease",
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
  statusPill: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12.5px",
  },
  statusLabel: {
    color: "var(--ink-soft)",
    fontWeight: 500,
  },
  statusValue: {
    fontWeight: 700,
    color: "var(--ink)",
  },
  formContainer: {
    background: "var(--surface-sunken)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "18px 20px",
    marginBottom: "22px",
  },
  formTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--ink)",
    marginBottom: "12px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--ink)",
    marginBottom: "6px",
    marginTop: "10px",
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
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "12.5px",
    marginBottom: "10px",
    fontWeight: 500,
  },
  ticketList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 16px",
    color: "var(--ink-soft)",
  },
  emptyIcon: {
    fontSize: "32px",
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
  ticketItem: {
    padding: "18px 20px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    boxShadow: "0 1px 3px rgba(27, 31, 29, 0.02)",
  },
  ticketHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "10px",
    flexWrap: "wrap",
    gap: "10px",
  },
  ticketTitleSection: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  ticketId: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--ink-soft)",
    padding: "2px 6px",
    background: "var(--surface-sunken)",
    borderRadius: "4px",
  },
  ticketSubject: {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
  },
  ticketMeta: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  dateText: {
    fontSize: "11.5px",
    color: "var(--ink-soft)",
  },
  ticketDescription: {
    fontSize: "13.5px",
    color: "var(--ink)",
    lineHeight: 1.55,
    marginBottom: "14px",
    whiteSpace: "pre-wrap",
  },
  adminReplyBox: {
    background: "var(--teal-tint)",
    border: "1px solid #C4DFD6",
    borderRadius: "8px",
    padding: "14px 16px",
    marginTop: "10px",
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
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--teal-deep)",
  },
  replyIcon: {
    fontSize: "13px",
  },
  replyDate: {
    fontSize: "11px",
    color: "var(--teal-deep)",
    opacity: 0.8,
  },
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
  },
};
