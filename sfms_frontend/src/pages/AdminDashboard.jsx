import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  getOutlets,
  approveOutlet,
  deleteOutlet,
  getSalesSummary,
  getLowStock,
  getRoyaltyInvoices,
  getRoyaltySummary,
  getStockItems,
  getAnnouncements,
  getTickets,
  getRestockRequests,
} from "../api/api";
import DashboardLayout from "../components/DashboardLayout";
import StatTicket from "../components/StatTicket";
import Badge from "../components/Badge";
import LowStockAlerts from "../components/LowStockAlerts";
import RoyaltyOverview from "../components/RoyaltyOverview";
import AnnouncementsPanel from "../components/AnnouncementsPanel";
import TicketsOverview from "../components/TicketsOverview";
import RestockRequestsOverview from "../components/RestockRequestsOverview";
import AdminForecastSection from "../components/AdminForecastSection";
import BenchmarkPage from "./BenchmarkPage";

export default function AdminDashboard({ initialSection = "overview" }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active section from prop or URL
  const currentSection = location.pathname.includes("/forecast")
    ? "forecast"
    : location.pathname.includes("/benchmarks")
    ? "benchmarks"
    : location.pathname.includes("/outlets")
    ? "outlets"
    : location.pathname.includes("/inventory")
    ? "inventory"
    : location.pathname.includes("/restock")
    ? "restock"
    : location.pathname.includes("/royalty")
    ? "royalty"
    : location.pathname.includes("/announcements")
    ? "announcements"
    : location.pathname.includes("/support")
    ? "support"
    : initialSection;

  const [outlets, setOutlets] = useState([]);
  const [salesSummary, setSalesSummary] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [royaltyInvoices, setRoyaltyInvoices] = useState([]);
  const [royaltySummary, setRoyaltySummary] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [restockRequests, setRestockRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [outletToDelete, setOutletToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Filter states
  const [outletFilter, setOutletFilter] = useState("all");
  const [outletSearch, setOutletSearch] = useState("");
  const [inventoryOutletFilter, setInventoryOutletFilter] = useState("all");
  const [inventorySearch, setInventorySearch] = useState("");

  const loadAll = async () => {
    try {
      const [
        outletRes,
        summaryRes,
        lowStockRes,
        royaltyRes,
        royaltySumRes,
        itemsRes,
        announcementRes,
        ticketRes,
        restockRes,
      ] = await Promise.all([
        getOutlets(),
        getSalesSummary(),
        getLowStock(),
        getRoyaltyInvoices(),
        getRoyaltySummary(),
        getStockItems(),
        getAnnouncements(),
        getTickets(),
        getRestockRequests(),
      ]);
      setOutlets(outletRes.data);
      setSalesSummary(summaryRes.data);
      setLowStock(lowStockRes.data);
      setRoyaltyInvoices(royaltyRes.data);
      setRoyaltySummary(royaltySumRes.data);
      setInventoryItems(itemsRes.data);
      setAnnouncements(announcementRes.data);
      setTickets(ticketRes.data);
      setRestockRequests(restockRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleAction = async (id, status) => {
    setActionLoadingId(id);
    try {
      await approveOutlet(id, status);
      await loadAll();
    } catch (err) {
      alert(err.response?.data?.error || "Action failed. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteOutlet = async () => {
    if (!outletToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteOutlet(outletToDelete.id);
      setOutletToDelete(null);
      await loadAll();
    } catch (err) {
      alert(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          "Could not delete outlet. Please try again."
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const badgeTone = (status) =>
    status === "approved"
      ? "approved"
      : status === "rejected"
      ? "rejected"
      : "pending";

  const pendingCount = outlets.filter((o) => o.status === "pending").length;
  const approvedCount = outlets.filter((o) => o.status === "approved").length;
  const rejectedCount = outlets.filter((o) => o.status === "rejected").length;

  const networkTotal = salesSummary.reduce(
    (sum, s) => sum + parseFloat(s.this_month_total || 0),
    0
  );
  const networkToday = salesSummary.reduce(
    (sum, s) => sum + parseFloat(s.today_sales || 0),
    0
  );

  const chartData = salesSummary
    .map((s) => ({
      name: s.outlet_name,
      thisMonth: parseFloat(s.this_month_total || 0),
    }))
    .sort((a, b) => b.thisMonth - a.thisMonth);

  const pendingRoyaltyAmount = parseFloat(
    royaltySummary?.total_pending_amount || 0
  );
  const pendingRoyaltyCount = royaltySummary?.total_pending_count || 0;
  const openTicketCount = tickets.filter((t) => t.status === "open").length;
  const pendingRestockCount = restockRequests.filter((r) => r.status === "pending").length;

  // Sidebar navigation items with live notification badges
  const navItems = [
    { label: "Overview", to: "/admin-dashboard", icon: "◆" },
    {
      label: "AI Sales Forecast",
      to: "/admin-dashboard/forecast",
      icon: "△",
    },
    {
      label: "Benchmarking",
      to: "/admin-dashboard/benchmarks",
      icon: "◈",
    },
    {
      label: "Outlets",
      to: "/admin-dashboard/outlets",
      icon: "◻",
      badge: pendingCount,
      badgeTone: "amber",
    },
    {
      label: "Inventory",
      to: "/admin-dashboard/inventory",
      icon: "□",
      badge: lowStock.length,
      badgeTone: "red",
    },
    {
      label: "Restock Requests",
      to: "/admin-dashboard/restock",
      icon: "↑",
      badge: pendingRestockCount,
      badgeTone: "amber",
    },
    {
      label: "Royalty & Billing",
      to: "/admin-dashboard/royalty",
      icon: "◇",
      badge: pendingRoyaltyCount,
      badgeTone: "amber",
    },
    {
      label: "Announcements",
      to: "/admin-dashboard/announcements",
      icon: "▷",
    },
    {
      label: "Support Tickets",
      to: "/admin-dashboard/support",
      icon: "▢",
      badge: openTicketCount,
      badgeTone: "amber",
    },
  ];

  const filteredOutlets = outlets.filter((o) => {
    if (outletFilter !== "all" && o.status !== outletFilter) return false;
    if (
      outletSearch.trim() &&
      !o.outlet_name.toLowerCase().includes(outletSearch.toLowerCase()) &&
      !o.city.toLowerCase().includes(outletSearch.toLowerCase()) &&
      !o.owner_name?.toLowerCase().includes(outletSearch.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const filteredInventory = inventoryItems.filter((item) => {
    if (
      inventoryOutletFilter !== "all" &&
      String(item.outlet) !== String(inventoryOutletFilter)
    ) {
      return false;
    }
    if (
      inventorySearch.trim() &&
      !item.name.toLowerCase().includes(inventorySearch.toLowerCase()) &&
      !item.outlet_name?.toLowerCase().includes(inventorySearch.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const uniqueLowStockOutlets = new Set(lowStock.map((item) => item.outlet))
    .size;

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} roleLabel="Admin / HQ">
        <div style={{ color: "var(--ink-soft)", fontSize: 14 }}>
          Loading operations center...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={navItems} roleLabel="Admin / HQ">
      {/* Top Header */}
      <div style={styles.topHeader}>
        <div>
          <h1 style={styles.pageTitle}>
            {currentSection === "overview" && "Network Command Center"}
            {currentSection === "forecast" && "AI Network Sales Forecast & Analytics"}
            {currentSection === "benchmarks" && "Multi-Outlet Benchmarking & Performance Reports"}
            {currentSection === "outlets" && "Outlet & Franchise Management"}
            {currentSection === "inventory" && "Network Inventory Monitoring"}
            {currentSection === "restock" && "Restock Requests — Network View"}
            {currentSection === "royalty" && "Royalty & Revenue Tracking"}
            {currentSection === "announcements" && "Network Announcements & Broadcasts"}
            {currentSection === "support" && "Support & Helpdesk Resolution"}
          </h1>
          <p style={styles.pageSub}>
            {outlets.length} total outlets · {approvedCount} active franchises · ₹
            {networkTotal.toLocaleString("en-IN")} monthly network volume
          </p>
        </div>
      </div>

      {/* ===================== 1. OVERVIEW SECTION ===================== */}
      {currentSection === "overview" && (
        <div>
          <div style={styles.statsGrid}>
            <StatTicket label="Network Sales Today" value={networkToday} />
            <StatTicket
              label="Network Sales — This Month"
              value={networkTotal}
            />
            <StatTicket
              label="Pending Outlet Approvals"
              value={pendingCount}
              prefix=""
              tone={pendingCount > 0 ? "amber" : "default"}
            />
            <StatTicket
              label="Network Royalty Pending"
              value={pendingRoyaltyAmount}
              tone={pendingRoyaltyAmount > 0 ? "amber" : "default"}
            />
          </div>

          <div style={styles.chartCard}>
            <div style={styles.cardHeaderFlex}>
              <div>
                <h3 style={styles.cardHeading}>
                  Sales by Outlet — This Month
                </h3>
                <p style={styles.cardSub}>
                  Comparison of revenue generated by approved outlets
                </p>
              </div>
              <button
                style={styles.linkActionBtn}
                onClick={() => navigate("/admin-dashboard/outlets")}
              >
                View Outlets →
              </button>
            </div>

            {chartData.length === 0 ? (
              <div style={styles.emptyChart}>
                No approved outlets with sales data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={270}>
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
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
                      "This Month",
                    ]}
                    cursor={{ fill: "var(--surface-sunken)" }}
                  />
                  <Bar
                    dataKey="thisMonth"
                    fill="var(--teal)"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Quick Snapshot Action Cards */}
          <div style={styles.quickGrid}>
            {/* Pending Outlets Quick Panel */}
            <div style={styles.quickCard}>
              <div style={styles.quickHeader}>
                <div style={styles.quickTitleWrap}>
                  <span style={styles.quickIcon}></span>
                  <span style={styles.quickTitle}>
                    Pending Franchise Approvals
                  </span>
                </div>
                <button
                  style={styles.smallLinkBtn}
                  onClick={() => navigate("/admin-dashboard/outlets")}
                >
                  Manage →
                </button>
              </div>

              {pendingCount === 0 ? (
                <div style={styles.quickEmpty}>
                  All outlet applications have been processed
                </div>
              ) : (
                <div style={styles.quickList}>
                  {outlets
                    .filter((o) => o.status === "pending")
                    .slice(0, 3)
                    .map((o) => (
                      <div key={o.id} style={styles.quickRow}>
                        <div>
                          <div style={styles.quickItemMain}>
                            {o.outlet_name}
                          </div>
                          <div style={styles.quickItemSub}>
                            {o.city} · Owner: {o.owner_name}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            style={styles.quickApproveBtn}
                            disabled={actionLoadingId === o.id}
                            onClick={() => handleAction(o.id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            style={styles.quickRejectBtn}
                            disabled={actionLoadingId === o.id}
                            onClick={() => handleAction(o.id, "rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Low Stock Alerts Quick Panel */}
            <div style={styles.quickCard}>
              <div style={styles.quickHeader}>
                <div style={styles.quickTitleWrap}>
                  <span style={styles.quickIcon}>!</span>
                  <span style={styles.quickTitle}>
                    Critical Low Stock Alerts
                  </span>
                </div>
                <button
                  style={styles.smallLinkBtn}
                  onClick={() => navigate("/admin-dashboard/inventory")}
                >
                  View All →
                </button>
              </div>

              {lowStock.length === 0 ? (
                <div style={styles.quickEmpty}>
                  No low stock alerts across the network
                </div>
              ) : (
                <div style={styles.quickList}>
                  {lowStock.slice(0, 3).map((item) => (
                    <div key={item.id} style={styles.quickAlertRow}>
                      <div>
                        <div style={styles.quickItemMain}>{item.name}</div>
                        <div style={styles.quickItemSub}>
                          {item.outlet_name}
                        </div>
                      </div>
                      <div style={styles.quickQty} className="mono">
                        {parseFloat(item.current_quantity)} /{" "}
                        {parseFloat(item.low_stock_threshold)} {item.unit}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Support Tickets Quick Panel */}
            <div style={styles.quickCard}>
              <div style={styles.quickHeader}>
                <div style={styles.quickTitleWrap}>
                  <span style={styles.quickIcon}></span>
                  <span style={styles.quickTitle}>
                    Support Tickets Awaiting Action
                  </span>
                </div>
                <button
                  style={styles.smallLinkBtn}
                  onClick={() => navigate("/admin-dashboard/support")}
                >
                  Manage All →
                </button>
              </div>

              {openTicketCount === 0 ? (
                <div style={styles.quickEmpty}>
                  No open support tickets across the network
                </div>
              ) : (
                <div style={styles.quickList}>
                  {tickets
                    .filter((t) => t.status === "open")
                    .slice(0, 3)
                    .map((t) => (
                      <div key={t.id} style={styles.quickRow}>
                        <div>
                          <div style={styles.quickItemMain}>
                            #{t.id} · {t.subject}
                          </div>
                          <div style={styles.quickItemSub}>
                            {t.outlet_name} ({t.outlet_city})
                          </div>
                        </div>
                        <button
                          style={styles.quickActionBtn}
                          onClick={() => navigate("/admin-dashboard/support")}
                        >
                          Respond
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Broadcast Announcements Quick Panel */}
            <div style={styles.quickCard}>
              <div style={styles.quickHeader}>
                <div style={styles.quickTitleWrap}>
                  <span style={styles.quickIcon}></span>
                  <span style={styles.quickTitle}>
                    Network Broadcasts
                  </span>
                </div>
                <button
                  style={styles.smallLinkBtn}
                  onClick={() => navigate("/admin-dashboard/announcements")}
                >
                  Broadcast →
                </button>
              </div>

              {announcements.length === 0 ? (
                <div style={styles.quickEmpty}>
                  No announcements posted yet
                </div>
              ) : (
                <div style={styles.quickList}>
                  {announcements.slice(0, 2).map((a) => (
                    <div key={a.id} style={styles.quickRow}>
                      <div style={{ width: "100%" }}>
                        <div style={styles.quickItemMain}>{a.title}</div>
                        <div
                          style={{
                            ...styles.quickItemSub,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {a.message}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== AI SALES FORECAST SECTION ===================== */}
      {currentSection === "forecast" && (
        <AdminForecastSection outlets={outlets} />
      )}

      {/* ===================== MULTI-OUTLET BENCHMARKING SECTION ===================== */}
      {currentSection === "benchmarks" && (
        <BenchmarkPage />
      )}

      {/* ===================== 2. OUTLETS SECTION ===================== */}
      {currentSection === "outlets" && (
        <div>
          <div style={styles.statsGrid}>
            <StatTicket label="Total Outlets" value={outlets.length} prefix="" />
            <StatTicket
              label="Active & Approved"
              value={approvedCount}
              prefix=""
            />
            <StatTicket
              label="Pending Review"
              value={pendingCount}
              prefix=""
              tone={pendingCount > 0 ? "amber" : "default"}
            />
            <StatTicket
              label="Rejected Applications"
              value={rejectedCount}
              prefix=""
            />
          </div>

          <div style={styles.tableCard}>
            <div style={styles.filterBar}>
              <div>
                <h3 style={styles.cardHeading}>All Outlets Directory</h3>
                <p style={styles.cardSub}>
                  Review applications, verify details, and manage approval status
                </p>
              </div>

              <div style={styles.filterControls}>
                <input
                  style={styles.searchInput}
                  placeholder="Search outlet, city, or owner..."
                  value={outletSearch}
                  onChange={(e) => setOutletSearch(e.target.value)}
                />

                <select
                  style={styles.selectInput}
                  value={outletFilter}
                  onChange={(e) => setOutletFilter(e.target.value)}
                >
                  <option value="all">
                    All Statuses ({outlets.length})
                  </option>
                  <option value="pending">
                    Pending ({pendingCount})
                  </option>
                  <option value="approved">
                    Approved ({approvedCount})
                  </option>
                  <option value="rejected">
                    Rejected ({rejectedCount})
                  </option>
                </select>
              </div>
            </div>

            {filteredOutlets.length === 0 ? (
              <div style={styles.emptyChart}>
                No outlets match your search or filter criteria.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Outlet Name</th>
                      <th style={styles.th}>Owner</th>
                      <th style={styles.th}>City & Address</th>
                      <th style={styles.th}>Royalty %</th>
                      <th style={styles.th}>Status</th>
                      <th style={{ ...styles.th, textAlign: "right" }}>
                        HQ Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOutlets.map((o) => (
                      <tr key={o.id}>
                        <td style={{ ...styles.td, fontWeight: 600 }}>
                          {o.outlet_name}
                        </td>
                        <td style={styles.td}>{o.owner_name}</td>
                        <td style={{ ...styles.td, color: "var(--ink-soft)" }}>
                          {o.city} {o.address ? `· ${o.address}` : ""}
                        </td>
                        <td style={styles.td} className="mono">
                          {o.royalty_percentage}%
                        </td>
                        <td style={styles.td}>
                          <Badge tone={badgeTone(o.status)}>{o.status}</Badge>
                        </td>
                        <td style={{ ...styles.td, textAlign: "right" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              gap: "8px",
                              alignItems: "center",
                              justifyContent: "flex-end",
                            }}
                          >
                            {o.status === "pending" ? (
                              <>
                                <button
                                  style={styles.approveBtn}
                                  disabled={actionLoadingId === o.id || (deleteLoading && outletToDelete?.id === o.id)}
                                  onClick={() => handleAction(o.id, "approved")}
                                >
                                  Approve
                                </button>
                                <button
                                  style={styles.rejectBtn}
                                  disabled={actionLoadingId === o.id || (deleteLoading && outletToDelete?.id === o.id)}
                                  onClick={() => handleAction(o.id, "rejected")}
                                >
                                  Reject
                                </button>
                              </>
                            ) : null}
                            <button
                              style={styles.removeOutletBtn}
                              disabled={actionLoadingId === o.id || (deleteLoading && outletToDelete?.id === o.id)}
                              onClick={() => setOutletToDelete(o)}
                              title={`Remove ${o.outlet_name}`}
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ flexShrink: 0 }}
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                              <span>Remove</span>
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
        </div>
      )}

      {/* ===================== 3. INVENTORY SECTION ===================== */}
      {currentSection === "inventory" && (
        <div>
          <div style={styles.statsGrid}>
            <StatTicket
              label="Low Stock Alerts"
              value={lowStock.length}
              prefix=""
              tone={lowStock.length > 0 ? "amber" : "default"}
            />
            <StatTicket
              label="Outlets with Alerts"
              value={uniqueLowStockOutlets}
              prefix=""
            />
            <StatTicket
              label="Total SKUs Monitored"
              value={inventoryItems.length}
              prefix=""
            />
            <StatTicket
              label="Network Health"
              value={
                lowStock.length === 0
                  ? "100%"
                  : `${Math.max(0, 100 - lowStock.length * 5)}%`
              }
              prefix=""
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <LowStockAlerts items={lowStock} />
          </div>

          <div style={styles.tableCard}>
            <div style={styles.filterBar}>
              <div>
                <h3 style={styles.cardHeading}>Network Stock Explorer</h3>
              </div>

              <div style={styles.filterControls}>
                <input
                  style={styles.searchInput}
                  placeholder="Search item or outlet..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                />

                <select
                  style={styles.selectInput}
                  value={inventoryOutletFilter}
                  onChange={(e) =>
                    setInventoryOutletFilter(e.target.value)
                  }
                >
                  <option value="all">
                    All Outlets ({outlets.length})
                  </option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.outlet_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredInventory.length === 0 ? (
              <div style={styles.emptyChart}>No stock items found.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Item Name</th>
                      <th style={styles.th}>Outlet</th>
                      <th style={styles.th}>Current Stock</th>
                      <th style={styles.th}>Threshold</th>
                      <th style={styles.th}>Unit</th>
                      <th style={{ ...styles.th, textAlign: "right" }}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item) => (
                      <tr
                        key={item.id}
                        style={
                          item.is_low_stock ? styles.lowStockRow : undefined
                        }
                      >
                        <td style={{ ...styles.td, fontWeight: 600 }}>
                          {item.name}
                        </td>
                        <td style={{ ...styles.td, color: "var(--ink-soft)" }}>
                          {item.outlet_name}
                        </td>
                        <td
                          style={{ ...styles.td, fontWeight: 600 }}
                          className="mono"
                        >
                          {parseFloat(item.current_quantity)}
                        </td>
                        <td
                          style={{ ...styles.td, color: "var(--ink-soft)" }}
                          className="mono"
                        >
                          {parseFloat(item.low_stock_threshold)}
                        </td>
                        <td style={styles.td}>{item.unit}</td>
                        <td style={{ ...styles.td, textAlign: "right" }}>
                          <Badge
                            tone={item.is_low_stock ? "rejected" : "approved"}
                          >
                            {item.is_low_stock ? "Low Stock" : "In Stock"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== 3b. RESTOCK REQUESTS SECTION ===================== */}
      {currentSection === "restock" && (
        <div>
          <RestockRequestsOverview
            requests={restockRequests}
            outlets={outlets}
            onReload={loadAll}
          />
        </div>
      )}

      {/* ===================== 4. ROYALTY & BILLING SECTION ===================== */}
      {currentSection === "royalty" && (
        <div>
          <RoyaltyOverview
            invoices={royaltyInvoices}
            summary={royaltySummary}
            outlets={outlets}
          />
        </div>
      )}

      {/* ===================== 5. ANNOUNCEMENTS PAGE ===================== */}
      {currentSection === "announcements" && (
        <div>
          <AnnouncementsPanel
            announcements={announcements}
            isAdmin={true}
            onReload={loadAll}
          />
        </div>
      )}

      {/* ===================== 6. SUPPORT TICKETS PAGE ===================== */}
      {currentSection === "support" && (
        <div>
          <TicketsOverview
            tickets={tickets}
            outlets={outlets}
            onReload={loadAll}
          />
        </div>
      )}

      {/* Confirmation Modal for Outlet Deletion */}
      {outletToDelete && (
        <div style={styles.modalOverlay} onClick={() => !deleteLoading && setOutletToDelete(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalIconWrap}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
            <h3 style={styles.modalTitle}>Remove Franchise Outlet</h3>
            <p style={styles.modalText}>
              Are you sure you want to permanently remove <strong>{outletToDelete.outlet_name}</strong> in {outletToDelete.city}?
            </p>
            <div style={styles.modalWarningBox}>
              <strong>Warning:</strong> Deleting this outlet will permanently erase all linked daily sales entries, inventory items, and royalty invoices. This action cannot be reversed.
            </div>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.modalCancelBtn}
                disabled={deleteLoading}
                onClick={() => setOutletToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  ...styles.modalConfirmBtn,
                  opacity: deleteLoading ? 0.7 : 1,
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                }}
                disabled={deleteLoading}
                onClick={handleDeleteOutlet}
              >
                {deleteLoading ? "Removing Outlet..." : "Yes, Remove Outlet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

const styles = {
  topHeader: {
    marginBottom: "28px",
  },
  pageTitle: { fontSize: "26px", marginBottom: "6px" },
  pageSub: { color: "var(--ink-soft)", fontSize: "13.5px" },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  chartCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
    padding: "24px",
    marginBottom: "24px",
  },
  cardHeaderFlex: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "16px",
  },
  cardHeading: { fontSize: "16px", marginBottom: "3px" },
  cardSub: { color: "var(--ink-soft)", fontSize: "12.5px" },
  linkActionBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--teal)",
    cursor: "pointer",
  },
  emptyChart: {
    color: "var(--ink-soft)",
    fontSize: "13px",
    padding: "40px 0",
    textAlign: "center",
  },
  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: "20px",
    marginBottom: "24px",
  },
  quickCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
    padding: "20px",
  },
  quickHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  quickTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  quickIcon: { fontSize: "16px" },
  quickTitle: { fontWeight: 700, fontSize: "14px" },
  smallLinkBtn: {
    background: "none",
    border: "none",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--teal)",
    cursor: "pointer",
  },
  quickEmpty: {
    fontSize: "13px",
    color: "var(--green)",
    padding: "20px 0",
    textAlign: "center",
    fontWeight: 500,
  },
  quickList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  quickRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "var(--surface-sunken)",
  },
  quickAlertRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "var(--amber-tint)",
    border: "1px solid #F0D4A8",
  },
  quickItemMain: { fontSize: "13px", fontWeight: 600 },
  quickItemSub: { fontSize: "11.5px", color: "var(--ink-soft)" },
  quickQty: { fontSize: "12px", fontWeight: 700, color: "var(--red)" },
  quickApproveBtn: {
    padding: "4px 10px",
    background: "var(--green)",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },
  quickRejectBtn: {
    padding: "4px 10px",
    background: "var(--red)",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },
  quickActionBtn: {
    padding: "4px 10px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },
  tableCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
    padding: "24px",
    marginBottom: "24px",
  },
  filterBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "18px",
    flexWrap: "wrap",
    gap: "12px",
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
    fontSize: "12.5px",
    minWidth: "220px",
    outline: "none",
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
  td: {
    padding: "12px 10px",
    fontSize: "13.5px",
    borderBottom: "1px solid var(--border)",
  },
  lowStockRow: { background: "var(--red-tint)" },
  approveBtn: {
    padding: "6px 14px",
    background: "var(--green)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  rejectBtn: {
    padding: "6px 14px",
    background: "var(--red)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  removeOutletBtn: {
    padding: "6px 12px",
    background: "transparent",
    color: "var(--red)",
    border: "1px solid rgba(179, 38, 30, 0.3)",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    transition: "all 0.15s ease",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(20, 33, 61, 0.45)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modalCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-pop)",
    maxWidth: "440px",
    width: "100%",
    padding: "24px",
  },
  modalIconWrap: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "var(--red-tint)",
    color: "var(--red)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "14px",
  },
  modalTitle: {
    fontSize: "17px",
    fontWeight: 700,
    color: "var(--ink)",
    margin: "0 0 8px 0",
  },
  modalText: {
    fontSize: "13px",
    color: "var(--ink-soft)",
    lineHeight: 1.5,
    margin: "0 0 14px 0",
  },
  modalWarningBox: {
    background: "var(--red-tint)",
    border: "1px solid rgba(179, 38, 30, 0.2)",
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "12px",
    color: "var(--red)",
    lineHeight: 1.45,
    marginBottom: "20px",
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
    color: "var(--ink)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  modalConfirmBtn: {
    padding: "8px 18px",
    background: "var(--red)",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(179, 38, 30, 0.25)",
  },
};
