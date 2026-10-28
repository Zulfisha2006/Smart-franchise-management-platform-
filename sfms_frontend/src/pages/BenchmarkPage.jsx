import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  getBenchmarkData,
  exportBenchmarkPDF,
  exportBenchmarkExcel,
  publishBenchmarkReport,
  getOutlets,
} from "../api/api";

const INR = (val) =>
  `₹${parseFloat(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const PCT = (val) => `${val > 0 ? "+" : ""}${val}%`;

const today = () => new Date().toISOString().split("T")[0];
const daysAgo = (n) =>
  new Date(Date.now() - n * 86400000).toISOString().split("T")[0];

// ─── Helper to trigger file download from blob ────────────────────────────────
function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ─── Small Stat Card ─────────────────────────────────────────────────────────
function StatCard({ label, value, accent }) {
  return (
    <div style={s.statCard}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statVal, color: accent || "var(--ink)" }}>{value}</div>
    </div>
  );
}

// ─── Rank Badge ──────────────────────────────────────────────────────────────
function RankBadge({ rank }) {
  const colors = { 1: "#D4842A", 2: "#8B8C8E", 3: "#1A7F6A" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: colors[rank] || "var(--border)",
        color: rank <= 3 ? "#fff" : "var(--ink)",
        fontWeight: 700,
        fontSize: 11,
      }}
    >
      {rank}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BenchmarkPage() {
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(today());
  const [cityFilter, setCityFilter] = useState("");
  const [selectedOutlets, setSelectedOutlets] = useState([]); // outlet IDs
  const [sortBy, setSortBy] = useState("rank");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [allOutlets, setAllOutlets] = useState([]);
  const [error, setError] = useState("");

  // Publish modal state
  const [showPublish, setShowPublish] = useState(false);
  const [pubTitle, setPubTitle] = useState("Network Performance Report");
  const [pubMessage, setPubMessage] = useState("");
  const [pubTargetAll, setPubTargetAll] = useState(true);
  const [pubTargetIds, setPubTargetIds] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [pubSuccess, setPubSuccess] = useState("");
  const [pubError, setPubError] = useState("");

  const [exporting, setExporting] = useState("");   // "pdf" | "excel" | ""
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  useEffect(() => {
    getOutlets().then((r) => setAllOutlets(r.data)).catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        city: cityFilter,
      };
      if (selectedOutlets.length) params.outlet_ids = selectedOutlets.join(",");
      const res = await getBenchmarkData(params);
      setData(res.data);
    } catch {
      setError("Could not load benchmarking data. Make sure outlets are approved and have sales records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filterPayload = () => ({
    date_from: dateFrom,
    date_to: dateTo,
    city: cityFilter,
    outlet_ids: selectedOutlets,
  });

  const handleExportPDF = async () => {
    setExporting("pdf");
    try {
      const res = await exportBenchmarkPDF(filterPayload());
      downloadBlob(new Blob([res.data]), `Chainhub_Report_${dateFrom}_${dateTo}.pdf`);
      showToast("PDF downloaded successfully.");
    } catch {
      showToast("PDF export failed. Please try again.");
    } finally {
      setExporting("");
    }
  };

  const handleExportExcel = async () => {
    setExporting("excel");
    try {
      const res = await exportBenchmarkExcel(filterPayload());
      downloadBlob(
        new Blob([res.data]),
        `Chainhub_Report_${dateFrom}_${dateTo}.xlsx`
      );
      showToast("Excel downloaded successfully.");
    } catch {
      showToast("Excel export failed. Please try again.");
    } finally {
      setExporting("");
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    setPublishing(true);
    setPubError("");
    setPubSuccess("");
    try {
      await publishBenchmarkReport({
        ...filterPayload(),
        title: pubTitle,
        message: pubMessage,
        target_all: pubTargetAll,
        target_outlet_ids: pubTargetIds,
      });
      setPubSuccess("Report published as a network announcement. Franchise owners will see it in their Announcements feed.");
      setShowPublish(false);
      showToast("Report published as announcement.");
    } catch {
      setPubError("Could not publish report. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const sortedOutlets = useMemo(() => {
    if (!data?.outlets) return [];
    const list = [...data.outlets];
    switch (sortBy) {
      case "sales": return list.sort((a, b) => b.total_sales - a.total_sales);
      case "growth": return list.sort((a, b) => b.growth_pct - a.growth_pct);
      case "health": return list.sort((a, b) => b.inventory_health - a.inventory_health);
      default: return list.sort((a, b) => a.rank - b.rank);
    }
  }, [data, sortBy]);

  const nt = data?.network_totals || {};
  const cities = data?.cities || [];
  const chartData = sortedOutlets.slice(0, 10).map((o) => ({
    name: o.outlet_name.length > 14 ? o.outlet_name.slice(0, 14) + "…" : o.outlet_name,
    sales: o.total_sales,
    growth: o.growth_pct,
  }));

  return (
    <div style={s.page}>
      {/* Toast */}
      {toast && <div style={s.toast}>{toast}</div>}
      {pubSuccess && <div style={{ ...s.toast, background: "var(--teal)" }}>{pubSuccess}</div>}

      {/* ─── Page Header ───────────────────────────────────────────────── */}
      <div style={s.pageHeader}>
        <div>
          <h2 style={s.pageTitle}>Multi-Outlet Benchmarking</h2>
        </div>
        <div style={s.headerActions}>
          <button
            style={s.btnOutline}
            disabled={exporting === "excel" || loading}
            onClick={handleExportExcel}
          >
            {exporting === "excel" ? "Exporting..." : "Download Excel"}
          </button>
          <button
            style={s.btnOutline}
            disabled={exporting === "pdf" || loading}
            onClick={handleExportPDF}
          >
            {exporting === "pdf" ? "Exporting..." : "Download PDF"}
          </button>
          <button style={s.btnPrimary} onClick={() => setShowPublish(true)}>
            Publish Report
          </button>
        </div>
      </div>

      {/* ─── Filters ───────────────────────────────────────────────────── */}
      <div style={s.filterCard}>
        <div style={s.filterRow}>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>From</label>
            <input
              type="date"
              style={s.input}
              value={dateFrom}
              max={dateTo}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>To</label>
            <input
              type="date"
              style={s.input}
              value={dateTo}
              min={dateFrom}
              max={today()}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>City</label>
            <select style={s.input} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="">All Cities</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Sort By</label>
            <select style={s.input} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="rank">Performance Rank</option>
              <option value="sales">Total Sales</option>
              <option value="growth">Growth %</option>
              <option value="health">Inventory Health</option>
            </select>
          </div>
          <button style={s.btnPrimary} onClick={fetchData} disabled={loading}>
            {loading ? "Loading..." : "Apply Filters"}
          </button>
        </div>
      </div>

      {/* ─── Error ─────────────────────────────────────────────────────── */}
      {error && <div style={s.errorBox}>{error}</div>}

      {/* ─── Network Summary Cards ──────────────────────────────────────── */}
      {nt.outlet_count !== undefined && (
        <div style={s.statsGrid}>
          <StatCard label="Total Network Sales" value={INR(nt.total_sales)} accent="var(--teal)" />
          <StatCard label="Avg Daily Sales" value={INR(nt.avg_daily_sales)} />
          <StatCard label="Active Outlets" value={nt.outlet_count} />
          <StatCard label="Avg Inventory Health" value={`${nt.avg_inventory_health}%`} accent="var(--teal)" />
          <StatCard label="Top Performer" value={nt.top_outlet || "—"} accent="var(--amber)" />
        </div>
      )}

      {/* ─── Chart + Table Layout ────────────────────────────────────────── */}
      {sortedOutlets.length > 0 && (
        <>
          {/* Sales Bar Chart */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>Sales Comparison by Outlet</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v) => INR(v)}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
                />
                <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "var(--amber)" : i === 1 ? "var(--teal)" : "var(--charcoal)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Outlet Comparison Table */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>Outlet Performance Rankings</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {["Rank", "Outlet", "City", "Total Sales", "Avg Daily", "Growth", "Inv. Health", "Pending Royalty"].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedOutlets.map((o) => (
                    <tr key={o.outlet_id} style={s.tr}>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        <RankBadge rank={o.rank} />
                      </td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{o.outlet_name}</td>
                      <td style={{ ...s.td, color: "var(--ink-soft)" }}>{o.city}</td>
                      <td style={{ ...s.td, fontWeight: 600 }} className="mono">{INR(o.total_sales)}</td>
                      <td style={s.td} className="mono">{INR(o.avg_daily_sales)}</td>
                      <td
                        style={{
                          ...s.td, fontWeight: 700,
                          color: o.growth_pct > 0 ? "var(--teal)" : o.growth_pct < 0 ? "var(--red)" : "var(--ink-soft)",
                        }}
                        className="mono"
                      >
                        {PCT(o.growth_pct)}
                      </td>
                      <td
                        style={{
                          ...s.td,
                          color: o.inventory_health < 70 ? "var(--amber)" : "var(--teal)",
                          fontWeight: 600,
                        }}
                        className="mono"
                      >
                        {o.inventory_health}%
                      </td>
                      <td
                        style={{
                          ...s.td,
                          color: o.pending_royalty > 0 ? "var(--red)" : "var(--teal)",
                          fontWeight: 600,
                        }}
                        className="mono"
                      >
                        {INR(o.pending_royalty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ─── Empty State ─────────────────────────────────────────────────── */}
      {!loading && sortedOutlets.length === 0 && !error && (
        <div style={s.emptyCard}>
          No approved outlets found for the selected filters. Adjust the date range or city filter.
        </div>
      )}

      {/* ─── Publish Report Modal ──────────────────────────────────────── */}
      {showPublish && (
        <div style={s.modalOverlay} onClick={() => setShowPublish(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Publish Report as Announcement</h3>

            {pubError && <div style={s.errorBox}>{pubError}</div>}

            <form onSubmit={handlePublish}>
              <label style={s.filterLabel}>Announcement Title</label>
              <input
                style={s.inputFull}
                value={pubTitle}
                onChange={(e) => setPubTitle(e.target.value)}
                required
              />

              <label style={s.filterLabel}>Message to Franchise Owners</label>
              <textarea
                style={{ ...s.inputFull, height: 90, resize: "vertical" }}
                value={pubMessage}
                onChange={(e) => setPubMessage(e.target.value)}
                placeholder="Brief summary of this period's performance..."
                required
              />

              <div style={{ marginBottom: 14 }}>
                <label style={{ ...s.filterLabel, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={pubTargetAll}
                    onChange={(e) => setPubTargetAll(e.target.checked)}
                  />
                  Broadcast to all approved outlets
                </label>
              </div>

              {!pubTargetAll && (
                <div style={{ marginBottom: 14 }}>
                  <label style={s.filterLabel}>Select Target Outlets</label>
                  <select
                    multiple
                    style={{ ...s.input, height: 100, width: "100%" }}
                    value={pubTargetIds.map(String)}
                    onChange={(e) =>
                      setPubTargetIds(
                        Array.from(e.target.selectedOptions, (opt) => parseInt(opt.value))
                      )
                    }
                  >
                    {allOutlets
                      .filter((o) => o.status === "approved")
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.outlet_name} — {o.city}
                        </option>
                      ))}
                  </select>
                  <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>
                    Hold Ctrl / Cmd to select multiple outlets.
                  </div>
                </div>
              )}

              <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 16 }}>
                A PDF and Excel version of this report will be auto-generated and attached to the announcement.
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" style={s.btnOutline} onClick={() => setShowPublish(false)}>
                  Cancel
                </button>
                <button type="submit" style={s.btnPrimary} disabled={publishing}>
                  {publishing ? "Publishing..." : "Publish Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    padding: "28px 28px 40px",
    maxWidth: 1200,
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "var(--ink)",
    margin: 0,
    fontFamily: "var(--font-display)",
  },
  headerActions: { display: "flex", gap: 10, flexWrap: "wrap" },

  filterCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "16px 20px",
    boxShadow: "var(--shadow-card)",
  },
  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 14,
    alignItems: "flex-end",
  },
  filterGroup: { display: "flex", flexDirection: "column", gap: 4 },
  filterLabel: { fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.03em" },

  input: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1.5px solid var(--border)",
    fontSize: 13,
    background: "var(--paper)",
    color: "var(--ink)",
    outline: "none",
  },
  inputFull: {
    padding: "9px 12px",
    borderRadius: 8,
    border: "1.5px solid var(--border)",
    fontSize: 13,
    background: "var(--paper)",
    color: "var(--ink)",
    outline: "none",
    width: "100%",
    marginBottom: 14,
    boxSizing: "border-box",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
  },
  statCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
    padding: "16px 20px",
  },
  statLabel: { fontSize: 11, color: "var(--ink-soft)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 },
  statVal: { fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" },

  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
    padding: "20px 24px",
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 16, marginTop: 0 },

  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "9px 12px",
    fontSize: "11.5px",
    color: "var(--ink-soft)",
    borderBottom: "2px solid var(--border)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "13px 12px",
    fontSize: 13.5,
    borderBottom: "1px solid var(--border)",
  },
  tr: { transition: "background 0.1s" },

  emptyCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "40px 24px",
    textAlign: "center",
    color: "var(--ink-soft)",
    fontSize: 13,
  },
  errorBox: {
    background: "var(--red-tint)",
    color: "var(--red)",
    border: "1px solid rgba(179,38,30,0.2)",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 13,
    fontWeight: 500,
  },
  toast: {
    position: "fixed",
    bottom: 28,
    right: 28,
    background: "var(--charcoal)",
    color: "#fff",
    borderRadius: 8,
    padding: "12px 20px",
    fontSize: 13,
    fontWeight: 600,
    zIndex: 9999,
    boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
  },

  // Buttons
  btnPrimary: {
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "9px 18px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnOutline: {
    background: "transparent",
    color: "var(--ink)",
    border: "1.5px solid var(--border)",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    background: "var(--surface)",
    borderRadius: "var(--radius-lg)",
    padding: "28px 28px 24px",
    width: "100%",
    maxWidth: 560,
    boxShadow: "0 8px 48px rgba(0,0,0,0.24)",
    zIndex: 1000,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "var(--ink)",
    margin: "0 0 20px",
    fontFamily: "var(--font-display)",
  },
};
