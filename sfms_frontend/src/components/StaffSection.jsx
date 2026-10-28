import { useState, useEffect } from "react";
import {
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffSummary,
} from "../api/api";
import Badge from "./Badge";

const INR = (val) =>
  `₹${parseFloat(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const ROLE_OPTIONS = [
  { value: "head_chef", label: "Head Chef" },
  { value: "line_cook", label: "Line Cook" },
  { value: "kitchen_staff", label: "Kitchen Staff" },
  { value: "cashier", label: "Cashier" },
  { value: "barista", label: "Barista" },
  { value: "delivery_rider", label: "Delivery Rider" },
  { value: "floor_manager", label: "Floor Manager" },
];

const SHIFT_OPTIONS = [
  { value: "morning", label: "Morning Shift (8 AM - 4 PM)" },
  { value: "evening", label: "Evening Shift (4 PM - 12 AM)" },
  { value: "full_day", label: "Full Day (10 AM - 10 PM)" },
  { value: "night", label: "Night Shift (10 PM - 6 AM)" },
  { value: "off", label: "Off Duty" },
];

export default function StaffSection({ outlet }) {
  const [activeTab, setActiveTab] = useState("directory"); // directory | shifts | payroll | compliance
  const [staff, setStaff] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Add / Edit Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    role: "kitchen_staff",
    phone: "",
    email: "",
    emergency_contact: "",
    date_joined: new Date().toISOString().split("T")[0],
    shift: "morning",
    is_on_duty_today: true,
    monthly_salary: "18000",
    certificate_name: "Food Handler Health Fitness Card",
    certificate_number: "",
    certificate_expiry: "",
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [staffRes, summaryRes] = await Promise.all([
        getStaff(outlet?.id),
        getStaffSummary(outlet?.id),
      ]);
      setStaff(staffRes.data);
      setSummary(summaryRes.data);
    } catch {
      setError("Could not load employee details. Please verify outlet connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [outlet?.id]);

  const showToast = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleToggleDuty = async (emp) => {
    try {
      await updateStaff(emp.id, { is_on_duty_today: !emp.is_on_duty_today });
      showToast(`${emp.full_name} marked as ${!emp.is_on_duty_today ? "On Duty" : "Off Duty"}.`);
      loadData();
    } catch {
      setError("Failed to update duty status.");
    }
  };

  const handleMarkPaid = async (emp) => {
    try {
      await updateStaff(emp.id, { payroll_status: "paid" });
      showToast(`Payroll marked as Paid for ${emp.full_name}.`);
      loadData();
    } catch {
      setError("Failed to update payroll status.");
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from your outlet staff roster?`)) return;
    try {
      await deleteStaff(id);
      showToast(`${name} removed successfully.`);
      loadData();
    } catch {
      setError("Could not remove staff member.");
    }
  };

  const handleFormChange = (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: val });
  };

  const openAddModal = (empToEdit = null) => {
    if (empToEdit) {
      setEditingStaff(empToEdit);
      setForm({
        full_name: empToEdit.full_name || "",
        role: empToEdit.role || "kitchen_staff",
        phone: empToEdit.phone || "",
        email: empToEdit.email || "",
        emergency_contact: empToEdit.emergency_contact || "",
        date_joined: empToEdit.date_joined || new Date().toISOString().split("T")[0],
        shift: empToEdit.shift || "morning",
        is_on_duty_today: empToEdit.is_on_duty_today ?? true,
        monthly_salary: empToEdit.monthly_salary || "18000",
        certificate_name: empToEdit.certificate_name || "Food Handler Health Fitness Card",
        certificate_number: empToEdit.certificate_number || "",
        certificate_expiry: empToEdit.certificate_expiry || "",
      });
    } else {
      setEditingStaff(null);
      setForm({
        full_name: "",
        role: "kitchen_staff",
        phone: "",
        email: "",
        emergency_contact: "",
        date_joined: new Date().toISOString().split("T")[0],
        shift: "morning",
        is_on_duty_today: true,
        monthly_salary: "18000",
        certificate_name: "Food Handler Health Fitness Card",
        certificate_number: "",
        certificate_expiry: "",
      });
    }
    setModalError("");
    setShowAddModal(true);
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError("");

    const payload = { ...form };
    if (!payload.certificate_expiry) delete payload.certificate_expiry;
    if (!payload.email) delete payload.email;

    try {
      if (editingStaff) {
        await updateStaff(editingStaff.id, payload);
        showToast(`Staff profile for ${payload.full_name} updated successfully.`);
      } else {
        await createStaff(payload);
        showToast(`${payload.full_name} added to outlet team.`);
      }
      setShowAddModal(false);
      loadData();
    } catch (err) {
      const data = err.response?.data;
      setModalError(
        data?.detail || (typeof data === "object" ? Object.values(data)[0] : "Could not save employee.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStaff = staff.filter((emp) => {
    if (roleFilter !== "all" && emp.role !== roleFilter) return false;
    if (
      searchTerm.trim() &&
      !emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !emp.phone.includes(searchTerm)
    ) {
      return false;
    }
    return true;
  });

  return (
    <div style={styles.container}>
      {/* ─── Top KPI Stat Cards ────────────────────────────────────────── */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Staff</div>
          <div style={styles.statVal}>{summary?.total_staff ?? "—"}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>On Duty Today</div>
          <div style={{ ...styles.statVal, color: "var(--teal)" }}>
            {summary?.on_duty_today ?? "—"}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Monthly Payroll</div>
          <div style={styles.statVal}>{INR(summary?.total_payroll)}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Labor Cost Ratio</div>
          <div style={{ ...styles.statVal, color: summary?.labor_cost_pct > 25 ? "var(--amber)" : "var(--ink)" }}>
            {summary?.labor_cost_pct ? `${summary.labor_cost_pct}%` : "—"}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Compliance Alerts</div>
          <div
            style={{
              ...styles.statVal,
              color: summary?.compliance_alerts > 0 ? "var(--red)" : "var(--teal)",
            }}
          >
            {summary?.compliance_alerts ?? 0}
          </div>
        </div>
      </div>

      {successMsg && <div style={styles.successToast}>{successMsg}</div>}
      {error && <div style={styles.errorBox}>{error}</div>}

      {/* ─── Sub-Tab Navigation Bar ───────────────────────────────────── */}
      <div style={styles.tabBar}>
        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === "directory" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("directory")}
        >
          Staff Directory
        </button>
        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === "shifts" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("shifts")}
        >
          Shifts &amp; Roster
        </button>
        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === "payroll" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("payroll")}
        >
          Payroll &amp; Wages
        </button>
        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === "compliance" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("compliance")}
        >
          Health &amp; Compliance
          {summary?.compliance_alerts > 0 && (
            <span style={styles.tabBadge}>{summary.compliance_alerts}</span>
          )}
        </button>
      </div>

      {/* ─── TAB 1: STAFF DIRECTORY ────────────────────────────────────── */}
      {activeTab === "directory" && (
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <div style={styles.filterControls}>
              <input
                style={styles.searchInput}
                placeholder="Search staff by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                style={styles.selectInput}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <button style={styles.primaryBtn} onClick={() => openAddModal()}>
              + Add Staff Member
            </button>
          </div>

          {filteredStaff.length === 0 ? (
            <div style={styles.emptyState}>No staff members found matching criteria.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Employee</th>
                    <th style={styles.th}>Designation</th>
                    <th style={styles.th}>Contact</th>
                    <th style={styles.th}>Shift</th>
                    <th style={styles.th}>Joined Date</th>
                    <th style={styles.th}>Status</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((emp) => (
                    <tr key={emp.id}>
                      <td style={{ ...styles.td, fontWeight: 700 }}>
                        <div>{emp.full_name}</div>
                        {emp.email && <div style={styles.subText}>{emp.email}</div>}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.roleTag}>{emp.role_display}</span>
                      </td>
                      <td style={styles.td} className="mono">{emp.phone}</td>
                      <td style={styles.td}>{emp.shift_display}</td>
                      <td style={styles.td} className="mono">{emp.date_joined}</td>
                      <td style={styles.td}>
                        <Badge tone={emp.status === "active" ? "approved" : "pending"}>
                          {emp.status_display}
                        </Badge>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <div style={styles.actionGroup}>
                          <button
                            style={styles.smallOutlineBtn}
                            onClick={() => openAddModal(emp)}
                          >
                            Edit
                          </button>
                          <button
                            style={styles.smallDangerBtn}
                            onClick={() => handleDelete(emp.id, emp.full_name)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: SHIFTS & DUTY ROSTER ──────────────────────────────── */}
      {activeTab === "shifts" && (
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <div style={styles.subCardTitle}>Today's Operational Roster</div>
            <div style={styles.shiftPillsGroup}>
              <span style={styles.shiftPill}>Morning: {summary?.shift_breakdown?.morning || 0}</span>
              <span style={styles.shiftPill}>Evening: {summary?.shift_breakdown?.evening || 0}</span>
              <span style={styles.shiftPill}>Full Day: {summary?.shift_breakdown?.full_day || 0}</span>
              <span style={styles.shiftPill}>Night: {summary?.shift_breakdown?.night || 0}</span>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Employee</th>
                  <th style={styles.th}>Station</th>
                  <th style={styles.th}>Assigned Shift</th>
                  <th style={styles.th}>Duty Status</th>
                  <th style={styles.th}>Emergency Contact</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Quick Attendance</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((emp) => (
                  <tr key={emp.id}>
                    <td style={{ ...styles.td, fontWeight: 700 }}>{emp.full_name}</td>
                    <td style={styles.td}>{emp.role_display}</td>
                    <td style={styles.td}>
                      <span style={styles.shiftBadge}>{emp.shift_display}</span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.dutyTag,
                          background: emp.is_on_duty_today
                            ? "rgba(26,127,106,0.12)"
                            : "var(--paper)",
                          color: emp.is_on_duty_today
                            ? "var(--teal)"
                            : "var(--ink-soft)",
                        }}
                      >
                        {emp.is_on_duty_today ? "On Duty Today" : "Off Duty"}
                      </span>
                    </td>
                    <td style={styles.td} className="mono">
                      {emp.emergency_contact || emp.phone}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <button
                        style={emp.is_on_duty_today ? styles.offDutyBtn : styles.onDutyBtn}
                        onClick={() => handleToggleDuty(emp)}
                      >
                        {emp.is_on_duty_today ? "Mark Off Duty" : "Mark On Duty"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 3: PAYROLL & COMPENSATION ────────────────────────────── */}
      {activeTab === "payroll" && (
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <div>
              <div style={styles.subCardTitle}>Monthly Wage Disbursements</div>
            </div>
            <div style={styles.payrollSummaryBox}>
              <span style={styles.payrollStatText}>
                Disbursed: <strong>{INR(summary?.paid_payroll)}</strong> · Pending:{" "}
                <strong style={{ color: "var(--amber)" }}>{INR(summary?.pending_payroll)}</strong>
              </span>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Employee</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Monthly Base Salary</th>
                  <th style={styles.th}>Disbursement Status</th>
                  <th style={styles.th}>Last Paid</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Payroll Action</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((emp) => (
                  <tr key={emp.id}>
                    <td style={{ ...styles.td, fontWeight: 700 }}>{emp.full_name}</td>
                    <td style={styles.td}>{emp.role_display}</td>
                    <td style={styles.td} className="mono">
                      {INR(emp.monthly_salary)}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.payrollTag,
                          background:
                            emp.payroll_status === "paid"
                              ? "rgba(26,127,106,0.12)"
                              : "var(--amber-tint)",
                          color:
                            emp.payroll_status === "paid"
                              ? "var(--teal)"
                              : "var(--amber)",
                        }}
                      >
                        {emp.payroll_status === "paid" ? "Paid" : "Pending"}
                      </span>
                    </td>
                    <td style={styles.td} className="mono">
                      {emp.last_paid_at
                        ? new Date(emp.last_paid_at).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      {emp.payroll_status === "paid" ? (
                        <span style={styles.settledText}>Disbursed</span>
                      ) : (
                        <button
                          style={styles.markPaidBtn}
                          onClick={() => handleMarkPaid(emp)}
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 4: FOOD SAFETY & COMPLIANCE ──────────────────────────── */}
      {activeTab === "compliance" && (
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <div>
              <div style={styles.subCardTitle}>Staff Food Safety &amp; Health Cards</div>
            </div>
            <div style={styles.complianceNotice}>
              Food franchise standards require active health fitness certificates for all kitchen and counter staff.
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Staff Member</th>
                  <th style={styles.th}>Station</th>
                  <th style={styles.th}>Certificate / Health Card</th>
                  <th style={styles.th}>Certificate No.</th>
                  <th style={styles.th}>Expiry Date</th>
                  <th style={styles.th}>Audit Status</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((emp) => {
                  const compStatus = emp.compliance_status;
                  const days = emp.days_until_expiry;

                  return (
                    <tr
                      key={emp.id}
                      style={{
                        background:
                          compStatus === "expired"
                            ? "var(--red-tint)"
                            : compStatus === "expiring_soon"
                            ? "var(--amber-tint)"
                            : undefined,
                      }}
                    >
                      <td style={{ ...styles.td, fontWeight: 700 }}>{emp.full_name}</td>
                      <td style={styles.td}>{emp.role_display}</td>
                      <td style={styles.td}>{emp.certificate_name || "Food Handler Card"}</td>
                      <td style={styles.td} className="mono">
                        {emp.certificate_number || "—"}
                      </td>
                      <td style={styles.td} className="mono">
                        {emp.certificate_expiry || "Not Registered"}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusTag,
                            background:
                              compStatus === "valid"
                                ? "rgba(26,127,106,0.12)"
                                : compStatus === "expiring_soon"
                                ? "var(--amber)"
                                : "var(--red)",
                            color:
                              compStatus === "valid" ? "var(--teal)" : "#fff",
                          }}
                        >
                          {compStatus === "valid"
                            ? "Valid"
                            : compStatus === "expiring_soon"
                            ? `Expires in ${days} days`
                            : compStatus === "expired"
                            ? "Expired"
                            : "Missing"}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <button
                          style={styles.smallOutlineBtn}
                          onClick={() => openAddModal(emp)}
                        >
                          Update Card
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Add / Edit Employee Modal ─────────────────────────────────── */}
      {showAddModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalHeading}>
              {editingStaff ? "Edit Employee Profile" : "Register Outlet Staff Member"}
            </h3>

            {modalError && <div style={styles.errorBox}>{modalError}</div>}

            <form onSubmit={handleSaveEmployee}>
              <div style={styles.formGrid}>
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Full Name</label>
                  <input
                    style={styles.modalInput}
                    name="full_name"
                    value={form.full_name}
                    onChange={handleFormChange}
                    placeholder="e.g. Vikram Sharma"
                    required
                  />
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Role / Designation</label>
                  <select
                    style={styles.modalInput}
                    name="role"
                    value={form.role}
                    onChange={handleFormChange}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Phone Number</label>
                  <input
                    style={styles.modalInput}
                    name="phone"
                    value={form.phone}
                    onChange={handleFormChange}
                    placeholder="+91 98765 43210"
                    required
                  />
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Email (Optional)</label>
                  <input
                    type="email"
                    style={styles.modalInput}
                    name="email"
                    value={form.email}
                    onChange={handleFormChange}
                    placeholder="vikram@example.com"
                  />
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Assigned Shift</label>
                  <select
                    style={styles.modalInput}
                    name="shift"
                    value={form.shift}
                    onChange={handleFormChange}
                  >
                    {SHIFT_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Monthly Salary (₹)</label>
                  <input
                    type="number"
                    style={styles.modalInput}
                    name="monthly_salary"
                    value={form.monthly_salary}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Health Certificate / Card Name</label>
                  <input
                    style={styles.modalInput}
                    name="certificate_name"
                    value={form.certificate_name}
                    onChange={handleFormChange}
                  />
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Certificate Expiry Date</label>
                  <input
                    type="date"
                    style={styles.modalInput}
                    name="certificate_expiry"
                    value={form.certificate_expiry}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.primaryBtn}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : editingStaff ? "Update Employee" : "Save Employee"}
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
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
  },
  statCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
    padding: "16px 20px",
  },
  statLabel: {
    fontSize: "11px",
    color: "var(--ink-soft)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    marginBottom: "6px",
  },
  statVal: {
    fontSize: "22px",
    fontWeight: 800,
    fontFamily: "var(--font-display)",
    color: "var(--ink)",
  },

  tabBar: {
    display: "flex",
    gap: "8px",
    background: "var(--surface)",
    padding: "6px",
    borderRadius: "10px",
    border: "1px solid var(--border)",
    flexWrap: "wrap",
  },
  tabBtn: {
    padding: "8px 18px",
    borderRadius: "7px",
    border: "none",
    background: "transparent",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--ink-soft)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.15s ease",
  },
  tabBtnActive: {
    background: "var(--charcoal)",
    color: "#fff",
  },
  tabBadge: {
    background: "var(--amber)",
    color: "var(--charcoal)",
    padding: "1px 6px",
    borderRadius: "10px",
    fontSize: "10.5px",
    fontWeight: 700,
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
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "12px",
  },
  subCardTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--ink)",
  },
  filterControls: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  searchInput: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1.5px solid var(--border)",
    fontSize: "13px",
    outline: "none",
    background: "var(--paper)",
    color: "var(--ink)",
    minWidth: "260px",
  },
  selectInput: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1.5px solid var(--border)",
    fontSize: "13px",
    outline: "none",
    background: "var(--paper)",
    color: "var(--ink)",
  },

  primaryBtn: {
    padding: "9px 18px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  secondaryBtn: {
    padding: "9px 16px",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--ink)",
    cursor: "pointer",
  },
  smallOutlineBtn: {
    padding: "5px 12px",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--ink)",
    cursor: "pointer",
  },
  smallDangerBtn: {
    padding: "5px 12px",
    background: "transparent",
    border: "1px solid rgba(179,38,30,0.3)",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--red)",
    cursor: "pointer",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: "11px",
    color: "var(--ink-soft)",
    borderBottom: "2px solid var(--border)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "13px 12px",
    fontSize: "13px",
    borderBottom: "1px solid var(--border)",
  },
  actionGroup: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    justifyContent: "flex-end",
  },
  roleTag: {
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "11.5px",
    fontWeight: 600,
    background: "var(--paper)",
    border: "1px solid var(--border)",
    color: "var(--ink)",
  },
  shiftBadge: {
    fontSize: "12px",
    color: "var(--ink)",
    fontWeight: 500,
  },
  shiftPillsGroup: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  shiftPill: {
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    background: "var(--paper)",
    border: "1px solid var(--border)",
    color: "var(--ink)",
  },
  dutyTag: {
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  onDutyBtn: {
    padding: "5px 12px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  offDutyBtn: {
    padding: "5px 12px",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--ink-soft)",
    cursor: "pointer",
  },
  payrollSummaryBox: {
    fontSize: "12.5px",
    color: "var(--ink)",
  },
  payrollStatText: {
    fontSize: "12.5px",
  },
  payrollTag: {
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  markPaidBtn: {
    padding: "5px 12px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  settledText: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--teal)",
  },
  statusTag: {
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  complianceNotice: {
    fontSize: "12px",
    color: "var(--ink-soft)",
  },
  subText: {
    fontSize: "11px",
    color: "var(--ink-soft)",
    marginTop: "2px",
  },
  emptyState: {
    textAlign: "center",
    padding: "36px",
    color: "var(--ink-soft)",
    fontSize: "13px",
  },
  successToast: {
    padding: "10px 16px",
    borderRadius: "8px",
    background: "rgba(26,127,106,0.1)",
    border: "1px solid rgba(26,127,106,0.25)",
    color: "var(--teal)",
    fontSize: "13px",
    fontWeight: 600,
  },
  errorBox: {
    padding: "10px 16px",
    borderRadius: "8px",
    background: "var(--red-tint)",
    border: "1px solid rgba(179,38,30,0.25)",
    color: "var(--red)",
    fontSize: "13px",
    fontWeight: 500,
  },

  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  modal: {
    background: "var(--surface)",
    borderRadius: "var(--radius-lg)",
    padding: "24px 28px",
    width: "100%",
    maxWidth: "580px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalHeading: {
    fontSize: "17px",
    fontWeight: 800,
    color: "var(--ink)",
    margin: "0 0 18px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },
  formField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  formLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--ink-soft)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  modalInput: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1.5px solid var(--border)",
    fontSize: "13px",
    outline: "none",
    background: "var(--paper)",
    color: "var(--ink)",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "22px",
  },
};
