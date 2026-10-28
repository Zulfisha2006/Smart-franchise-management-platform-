import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  createOutlet,
  getOutlets,
  logSale,
  getSales,
  getSalesSummary,
  getStockItems,
  getRoyaltyInvoices,
  getRoyaltySummary,
  getAnnouncements,
  getTickets,
  getRestockRequests,
} from "../api/api";
import DashboardLayout from "../components/DashboardLayout";
import StatTicket from "../components/StatTicket";
import Badge from "../components/Badge";
import InventorySection from "../components/InventorySection";
import RoyaltySection from "../components/RoyaltySection";
import AnnouncementsPanel from "../components/AnnouncementsPanel";
import SupportTickets from "../components/SupportTickets";
import SaleEntryPanel from "../components/SaleEntryPanel";
import RestockRequestsSection from "../components/RestockRequestsSection";
import AIForecastSection from "../components/AIForecastSection";
import StaffSection from "../components/StaffSection";

export default function OwnerDashboard({ initialSection = "overview" }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active section from URL or prop
  const currentSection = location.pathname.includes("/forecast")
    ? "forecast"
    : location.pathname.includes("/staff") || location.pathname.includes("/employees")
    ? "staff"
    : location.pathname.includes("/restock")
    ? "restock"
    : location.pathname.includes("/inventory")
    ? "inventory"
    : location.pathname.includes("/royalty")
    ? "royalty"
    : location.pathname.includes("/announcements")
    ? "announcements"
    : location.pathname.includes("/support")
    ? "support"
    : initialSection;

  const [outlet, setOutlet] = useState(null);
  const [form, setForm] = useState({ outlet_name: "", city: "", address: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [saleForm, setSaleForm] = useState({ amount: "", note: "" });
  const [saleError, setSaleError] = useState("");
  const [saleSubmitting, setSaleSubmitting] = useState(false);

  const [stockItems, setStockItems] = useState([]);
  const [restockRequests, setRestockRequests] = useState([]);
  const [royaltyInvoices, setRoyaltyInvoices] = useState([]);
  const [royaltySummary, setRoyaltySummary] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [tickets, setTickets] = useState([]);

  const loadOutlet = async () => {
    try {
      const res = await getOutlets();
      setOutlet(res.data.length > 0 ? res.data[0] : null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAnnouncements = async () => {
    try {
      const res = await getAnnouncements();
      setAnnouncements(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadTickets = async () => {
    try {
      const res = await getTickets();
      setTickets(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSalesData = async () => {
    try {
      const [salesRes, summaryRes] = await Promise.all([
        getSales(),
        getSalesSummary(),
      ]);
      setSales(salesRes.data.slice().reverse());
      setSummary(summaryRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadInventory = async () => {
    try {
      const res = await getStockItems();
      setStockItems(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRestockRequests = async () => {
    try {
      const res = await getRestockRequests();
      setRestockRequests(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRoyaltyData = async () => {
    try {
      const [invRes, sumRes] = await Promise.all([
        getRoyaltyInvoices(),
        getRoyaltySummary(),
      ]);
      setRoyaltyInvoices(invRes.data);
      setRoyaltySummary(sumRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadOutlet();
    loadAnnouncements();
  }, []);

  useEffect(() => {
    if (outlet?.status === "approved") {
      loadSalesData();
      loadInventory();
      loadRoyaltyData();
      loadTickets();
      loadRestockRequests();
    }
  }, [outlet]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await createOutlet(form);
      await loadOutlet();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data ? (typeof data === "object" ? Object.values(data)[0] : data) : null;
      setError(
        (Array.isArray(firstError) ? firstError[0] : firstError) ||
          "Could not submit outlet. Please check your details and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaleChange = (e) =>
    setSaleForm({ ...saleForm, [e.target.name]: e.target.value });

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    setSaleError("");
    setSaleSubmitting(true);
    try {
      await logSale(saleForm);
      setSaleForm({ amount: "", note: "" });
      await loadSalesData();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data?.detail || (data && typeof data === "object" ? Object.values(data)[0] : data);
      setSaleError(
        (Array.isArray(firstError) ? firstError[0] : firstError) ||
          "Could not log sale. Please check the amount and try again."
      );
    } finally {
      setSaleSubmitting(false);
    }
  };

  const badgeTone =
    outlet?.status === "approved"
      ? "approved"
      : outlet?.status === "rejected"
      ? "rejected"
      : "pending";

  const chartData = sales.map((s) => ({
    date: new Date(s.date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    }),
    amount: parseFloat(s.amount),
  }));

  const pendingInvoicesCount = royaltyInvoices.filter(
    (i) => i.status === "pending"
  ).length;
  const openTicketsCount = tickets.filter((t) => t.status === "open").length;
  const pendingRestockCount = restockRequests.filter((r) => r.status === "pending").length;

  const navItems = [
    { label: "Overview", to: "/owner-dashboard", icon: "◆" },
    {
      label: "AI Sales Forecast",
      to: "/owner-dashboard/forecast",
      icon: "△",
    },
    {
      label: "Inventory",
      to: "/owner-dashboard/inventory",
      icon: "□",
    },
    {
      label: "Restock Requests",
      to: "/owner-dashboard/restock",
      icon: "↑",
      badge: pendingRestockCount,
      badgeTone: "amber",
    },
    {
      label: "Staff & Employees",
      to: "/owner-dashboard/staff",
      icon: "◎",
    },
    {
      label: "Royalty & Billing",
      to: "/owner-dashboard/royalty",
      icon: "◇",
      badge: pendingInvoicesCount,
      badgeTone: "amber",
    },
    {
      label: "Announcements",
      to: "/owner-dashboard/announcements",
      icon: "▷",
      badge: announcements.length,
      badgeTone: "teal",
    },
    {
      label: "Support & Helpdesk",
      to: "/owner-dashboard/support",
      icon: "▢",
      badge: openTicketsCount,
      badgeTone: "amber",
    },
  ];

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} roleLabel="Franchise Owner">
        <div style={styles.loadingText}>Loading your outlet...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={navItems} roleLabel="Franchise Owner">
      {!outlet ? (
        <div style={styles.onboardWrap}>
          <div style={styles.pageHeader}>
            <h1 style={styles.pageTitle}>Onboard your outlet</h1>
            <p style={styles.pageSub}>
              You haven't registered an outlet yet. Submit your details for HQ approval.
            </p>
          </div>
          <div style={styles.formCard}>
            {error && <div style={styles.errorBox}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <label style={styles.label}>Outlet Name</label>
              <input
                style={styles.input}
                name="outlet_name"
                value={form.outlet_name}
                onChange={handleChange}
                placeholder="e.g. QuickBite - Ludhiana"
                required
              />
              <label style={styles.label}>City</label>
              <input
                style={styles.input}
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="e.g. Ludhiana"
                required
              />
              <label style={styles.label}>Address</label>
              <input
                style={styles.input}
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="e.g. Model Town Market"
              />
              <button
                style={styles.primaryBtn}
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit for Approval"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <>
          {/* Top Header */}
          <div style={styles.topHeader}>
            <div>
              <h1 style={styles.pageTitle}>{outlet.outlet_name}</h1>
              <p style={styles.pageSub}>
                {outlet.city} · Royalty {outlet.royalty_percentage}% ·{" "}
                <Badge tone={badgeTone}>{outlet.status}</Badge>
              </p>
            </div>
          </div>

          {outlet.status !== "approved" ? (
            <div style={styles.pendingCard}>
              <div style={styles.pendingIcon}></div>
              <div>
                <div style={styles.pendingTitle}>Awaiting Admin Approval</div>
                <div style={styles.pendingText}>
                  Your outlet request is under review. You'll be able to log sales and manage operations once HQ approves it.
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 1. OVERVIEW PAGE */}
              {currentSection === "overview" && (
                <div>
                  <div style={styles.statsGrid}>
                    <StatTicket
                      label="Today's Sales"
                      value={parseFloat(summary?.today_sales || 0)}
                    />
                    <StatTicket
                      label="This Month"
                      value={parseFloat(summary?.this_month_total || 0)}
                    />
                    <StatTicket
                      label="Avg. Daily"
                      value={parseFloat(summary?.average_daily || 0)}
                    />
                    <StatTicket
                      label="Growth vs Last Month"
                      value={
                        summary?.growth_percent !== null &&
                        summary?.growth_percent !== undefined
                          ? `${summary.growth_percent}%`
                          : "—"
                      }
                      trend={summary?.growth_percent}
                      tone="amber"
                    />
                  </div>

                  <div style={styles.contentGrid}>
                    <div style={styles.chartCard}>
                      <h3 style={styles.cardHeading}>Sales Trend</h3>
                      {chartData.length === 0 ? (
                        <div style={styles.emptyChart}>
                          No sales logged yet — enter your first entry to see the trend.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={260}>
                          <LineChart
                            data={chartData}
                            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              stroke="var(--border)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                              axisLine={{ stroke: "var(--border)" }}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                              axisLine={false}
                              tickLine={false}
                              width={50}
                            />
                            <Tooltip
                              contentStyle={{
                                borderRadius: 8,
                                border: "1px solid var(--border)",
                                fontSize: 12,
                                fontFamily: "var(--font-mono)",
                              }}
                              formatter={(v) => [
                                `₹${v.toLocaleString("en-IN")}`,
                                "Sales",
                              ]}
                            />
                            <Line
                              type="monotone"
                              dataKey="amount"
                              stroke="var(--teal)"
                              strokeWidth={2.5}
                              dot={{ r: 3, fill: "var(--teal)" }}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    <div style={styles.entryCard}>
                      <SaleEntryPanel
                        summary={summary}
                        saleForm={saleForm}
                        saleError={saleError}
                        saleSubmitting={saleSubmitting}
                        onSaleChange={handleSaleChange}
                        onSaleSubmit={handleSaleSubmit}
                      />
                    </div>
                  </div>

                  <div style={styles.tableCard}>
                    <h3 style={styles.cardHeading}>Recent Sales Entries</h3>
                    {sales.length === 0 ? (
                      <div style={styles.emptyChart}>No entries yet.</div>
                    ) : (
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Date</th>
                            <th style={styles.th}>Amount</th>
                            <th style={styles.th}>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sales.slice(0, 8).map((s) => (
                            <tr key={s.id}>
                              <td style={styles.td} className="mono">
                                {s.date}
                              </td>
                              <td style={styles.td} className="mono">
                                ₹{parseFloat(s.amount).toLocaleString("en-IN")}
                              </td>
                              <td style={{ ...styles.td, color: "var(--ink-soft)" }}>
                                {s.note || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {/* AI SALES FORECAST PAGE */}
              {currentSection === "forecast" && (
                <div>
                  <AIForecastSection
                    outlet={outlet}
                    onNavigateTab={(tab) => navigate(`/owner-dashboard/${tab}`)}
                  />
                </div>
              )}

              {/* 2. INVENTORY PAGE */}
              {currentSection === "inventory" && (
                <div>
                  <InventorySection
                    items={stockItems}
                    outlet={outlet}
                    onReload={loadInventory}
                    onRestockSubmitted={loadRestockRequests}
                  />
                </div>
              )}

              {/* 3. RESTOCK REQUESTS PAGE */}
              {currentSection === "restock" && (
                <div>
                  <RestockRequestsSection
                    requests={restockRequests}
                    stockItems={stockItems}
                    onReload={loadRestockRequests}
                  />
                </div>
              )}

              {/* 3. ROYALTY & BILLING PAGE */}
              {currentSection === "royalty" && (
                <div>
                  <RoyaltySection
                    invoices={royaltyInvoices}
                    summary={royaltySummary}
                    onReload={loadRoyaltyData}
                  />
                </div>
              )}

              {/* 4. ANNOUNCEMENTS PAGE */}
              {currentSection === "announcements" && (
                <div>
                  <AnnouncementsPanel
                    announcements={announcements}
                    isAdmin={false}
                    onReload={loadAnnouncements}
                  />
                </div>
              )}

              {/* 5. SUPPORT & HELPDESK PAGE */}
              {currentSection === "support" && (
                <div>
                  <SupportTickets
                    tickets={tickets}
                    onReload={loadTickets}
                  />
                </div>
              )}

              {/* 6. STAFF & EMPLOYEES PAGE */}
              {currentSection === "staff" && (
                <div>
                  <StaffSection outlet={outlet} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

const styles = {
  loadingText: { color: "var(--ink-soft)", fontSize: "14px" },
  onboardWrap: { maxWidth: "480px" },
  topHeader: {
    marginBottom: "28px",
  },
  pageHeader: { marginBottom: "24px" },
  pageTitle: { fontSize: "26px", marginBottom: "6px" },
  pageSub: {
    color: "var(--ink-soft)",
    fontSize: "13.5px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  formCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
    padding: "28px",
  },
  label: {
    display: "block",
    fontSize: "12.5px",
    fontWeight: 600,
    color: "var(--ink)",
    marginBottom: "6px",
    marginTop: "16px",
  },
  input: {
    width: "100%",
    padding: "10px 13px",
    borderRadius: "8px",
    border: "1.5px solid var(--border)",
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none",
  },
  primaryBtn: {
    width: "100%",
    marginTop: "22px",
    padding: "12px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  errorBox: {
    background: "var(--red-tint)",
    color: "var(--red)",
    padding: "10px 12px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "10px",
    fontWeight: 500,
  },
  pendingCard: {
    background: "var(--amber-tint)",
    border: "1px solid #F0D4A8",
    borderRadius: "var(--radius-lg)",
    padding: "22px 26px",
    display: "flex",
    alignItems: "center",
    gap: "18px",
    maxWidth: "560px",
  },
  pendingIcon: { fontSize: "28px" },
  pendingTitle: { fontWeight: 700, fontSize: "15px", marginBottom: "4px" },
  pendingText: { fontSize: "13px", color: "var(--ink-soft)", lineHeight: 1.5 },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1.6fr 1fr",
    gap: "20px",
    marginBottom: "24px",
    alignItems: "start",
  },
  chartCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
    padding: "24px",
  },
  entryCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
    padding: "24px",
  },
  cardHeading: { fontSize: "15px", marginBottom: "16px" },
  emptyChart: {
    color: "var(--ink-soft)",
    fontSize: "13px",
    padding: "40px 0",
    textAlign: "center",
  },
  tableCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
    padding: "24px",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "8px 10px",
    fontSize: "11.5px",
    color: "var(--ink-soft)",
    borderBottom: "2px solid var(--border)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  td: {
    padding: "11px 10px",
    fontSize: "13.5px",
    borderBottom: "1px solid var(--border)",
  },
};
