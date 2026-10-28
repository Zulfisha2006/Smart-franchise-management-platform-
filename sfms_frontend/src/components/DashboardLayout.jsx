import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DashboardLayout({ navItems = [], roleLabel, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    logout();
    navigate("/login");
  };

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandMark}>CH</div>
          <div style={styles.brandName}>Chainhub</div>
        </div>

        <nav style={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact ?? (item.to === "/admin-dashboard" || item.to === "/owner-dashboard")}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              })}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span style={styles.navLabel}>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  style={{
                    ...styles.navBadge,
                    background: item.badgeTone === "red" ? "var(--red)" : "var(--amber)",
                    color: item.badgeTone === "red" ? "#fff" : "var(--charcoal)",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.userChip}>
            <div style={styles.userAvatar}>{user?.username?.[0]?.toUpperCase() || "U"}</div>
            <div style={{ overflow: "hidden" }}>
              <div style={styles.userName}>{user?.username}</div>
              <div style={styles.userRole}>{user?.role?.replace("_", " ")}</div>
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={() => setShowLogoutModal(true)}>
            Log out
          </button>
        </div>
      </aside>

      <main style={styles.main}>{children}</main>

      {/* ─── Logout Confirmation Modal ───────────────────────────────── */}
      {showLogoutModal && (
        <div style={styles.modalOverlay} onClick={() => setShowLogoutModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Confirm Logout</h3>
            <p style={styles.modalMessage}>
              Are you sure you want to log out?
            </p>
            <div style={styles.modalActions}>
              <button
                style={styles.modalCancelBtn}
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                style={styles.modalConfirmBtn}
                onClick={handleConfirmLogout}
              >
                Yes, Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "var(--paper)",
    fontFamily: "var(--font-body)",
  },
  sidebar: {
    width: "248px",
    background: "var(--charcoal)",
    display: "flex",
    flexDirection: "column",
    padding: "24px 16px",
    flexShrink: 0,
    position: "sticky",
    top: 0,
    height: "100vh",
    zIndex: 10,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "0 8px",
    marginBottom: "32px",
  },
  brandMark: {
    width: "34px",
    height: "34px",
    borderRadius: "8px",
    background: "var(--amber)",
    color: "var(--charcoal)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "14px",
  },
  brandName: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "17px",
    color: "#fff",
    lineHeight: 1.2,
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    flex: 1,
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "8px",
    color: "rgba(255,255,255,0.65)",
    textDecoration: "none",
    fontSize: "13.5px",
    fontWeight: 500,
    transition: "all 0.15s ease",
  },
  navItemActive: {
    background: "var(--charcoal-soft)",
    color: "#fff",
    fontWeight: 600,
  },
  navIcon: {
    fontSize: "15px",
    width: "18px",
    textAlign: "center",
  },
  navLabel: {
    flex: 1,
  },
  navBadge: {
    padding: "2px 7px",
    borderRadius: "999px",
    fontSize: "10.5px",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  sidebarFooter: {
    borderTop: "1px solid rgba(255,255,255,0.08)",
    paddingTop: "16px",
    marginTop: "16px",
  },
  userChip: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
    padding: "0 4px",
  },
  userAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "var(--teal)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "13px",
    flexShrink: 0,
  },
  userName: {
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userRole: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "11px",
    textTransform: "capitalize",
  },
  logoutBtn: {
    width: "100%",
    padding: "9px",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    fontSize: "12.5px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s ease",
  },
  main: {
    flex: 1,
    padding: "32px 40px",
    minWidth: 0,
  },

  // Modal Overlay & Box
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.48)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    backdropFilter: "blur(2px)",
  },
  modal: {
    background: "var(--surface)",
    borderRadius: "var(--radius-lg)",
    padding: "24px 28px",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.22)",
    border: "1px solid var(--border)",
  },
  modalTitle: {
    fontSize: "17px",
    fontWeight: 700,
    color: "var(--ink)",
    margin: "0 0 8px 0",
    fontFamily: "var(--font-display)",
  },
  modalMessage: {
    fontSize: "13.5px",
    color: "var(--ink-soft)",
    margin: "0 0 22px 0",
    lineHeight: 1.5,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  modalCancelBtn: {
    padding: "8px 16px",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--ink)",
    cursor: "pointer",
  },
  modalConfirmBtn: {
    padding: "8px 18px",
    background: "var(--red)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
};
