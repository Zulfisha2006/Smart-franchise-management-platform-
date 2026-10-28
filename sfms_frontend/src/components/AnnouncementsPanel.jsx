import { useState } from "react";
import { createAnnouncement } from "../api/api";

function formatAnnouncementDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24 && d.getDate() === now.getDate()) {
    return `Today at ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * AnnouncementsPanel — Network-wide broadcast feed from HQ Admin.
 * Admin view includes a broadcast composer form.
 * Franchise Owner view shows a clean chronological feed.
 */
export default function AnnouncementsPanel({
  announcements = [],
  isAdmin = false,
  onReload,
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedForm, setExpandedForm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError("Please fill in both title and message.");
      return;
    }
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await createAnnouncement({ title: title.trim(), message: message.trim() });
      setTitle("");
      setMessage("");
      setSuccess("Announcement broadcasted successfully to all franchise owners!");
      setExpandedForm(false);
      if (onReload) await onReload();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not post announcement. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.titleWithIcon}>
            <h3 style={styles.heading}>Network Announcements</h3>
          </div>
          <p style={styles.subheading}>
            {isAdmin
              ? "Broadcast official operational notices, guidelines, and updates to all franchise owners."
              : "Official operational guidelines, maintenance alerts, and updates from Chainhub HQ."}
          </p>
        </div>

        {isAdmin && (
          <button
            style={styles.toggleFormBtn}
            onClick={() => setExpandedForm(!expandedForm)}
          >
            {expandedForm ? "Cancel Broadcast" : "+ New Broadcast"}
          </button>
        )}
      </div>

      {isAdmin && expandedForm && (
        <div style={styles.formContainer}>
          <div style={styles.formTitle}>Broadcast New Announcement</div>
          {error && <div style={styles.errorBox}>{error}</div>}
          {success && <div style={styles.successBox}>{success}</div>}

          <form onSubmit={handleSubmit}>
            <label style={styles.label}>Announcement Title</label>
            <input
              style={styles.input}
              placeholder="e.g. Scheduled Warehouse Maintenance / Holiday Timings"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <label style={styles.label}>Broadcast Message</label>
            <textarea
              style={styles.textarea}
              placeholder="Provide clear, concise details for all franchise owners..."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />

            <div style={styles.formActions}>
              <button
                style={styles.cancelBtn}
                type="button"
                onClick={() => setExpandedForm(false)}
              >
                Cancel
              </button>
              <button
                style={styles.submitBtn}
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Broadcasting..." : "Broadcast to All Outlets"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcements Feed */}
      <div style={styles.feedList}>
        {announcements.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyTitle}>No announcements posted yet</div>
            <div style={styles.emptySub}>
              Important alerts and operational updates from HQ will appear here.
            </div>
          </div>
        ) : (
          announcements.map((item) => (
            <div key={item.id} style={styles.itemCard}>
              <div style={styles.itemHeader}>
                <div style={styles.itemTitleWrap}>
                  <span style={styles.itemDot} />
                  <h4 style={styles.itemTitle}>{item.title}</h4>
                  {item.report_type === "benchmarking" && (
                    <span style={styles.reportBadge}>Benchmarking Report</span>
                  )}
                </div>
                <div style={styles.itemMeta}>
                  <span style={styles.hqBadge}>HQ Broadcast</span>
                  <span style={styles.itemDate} className="mono">
                    {formatAnnouncementDate(item.created_at)}
                  </span>
                </div>
              </div>
              <div style={styles.itemBody}>{item.message}</div>
              {(item.attachment_pdf_url || item.attachment_excel_url) && (
                <div style={styles.attachmentRow}>
                  <span style={styles.attachmentLabel}>Attached Reports:</span>
                  {item.attachment_pdf_url && (
                    <a
                      href={item.attachment_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      style={styles.attachmentBtn}
                    >
                      Download PDF
                    </a>
                  )}
                  {item.attachment_excel_url && (
                    <a
                      href={item.attachment_excel_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      style={styles.attachmentBtn}
                    >
                      Download Excel
                    </a>
                  )}
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
    marginBottom: "20px",
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
  toggleFormBtn: {
    padding: "7px 14px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "12.5px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s ease",
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
  feedList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  emptyState: {
    textAlign: "center",
    padding: "36px 16px",
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
  itemCard: {
    padding: "16px 18px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    boxShadow: "0 1px 3px rgba(27, 31, 29, 0.02)",
  },
  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "8px",
    flexWrap: "wrap",
    gap: "8px",
  },
  itemTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  itemDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "var(--teal)",
    flexShrink: 0,
  },
  itemTitle: {
    fontSize: "14.5px",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
  },
  itemMeta: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  hqBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "10.5px",
    fontWeight: 700,
    background: "var(--teal-tint)",
    color: "var(--teal-deep)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  itemDate: {
    fontSize: "11.5px",
    color: "var(--ink-soft)",
  },
  itemBody: {
    fontSize: "13.5px",
    color: "var(--ink)",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    paddingLeft: "15px",
  },
  reportBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "10.5px",
    fontWeight: 700,
    background: "var(--amber-tint, #fdf6ec)",
    color: "var(--amber, #d4842a)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  attachmentRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "12px",
    paddingLeft: "15px",
    flexWrap: "wrap",
  },
  attachmentLabel: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--ink-soft)",
  },
  attachmentBtn: {
    display: "inline-block",
    padding: "5px 12px",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    background: "var(--paper)",
    color: "var(--ink)",
    fontSize: "12px",
    fontWeight: 600,
    textDecoration: "none",
    transition: "background 0.15s ease",
  },
};
