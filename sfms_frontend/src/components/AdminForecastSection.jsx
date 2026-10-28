import { useState, useEffect } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getNetworkSalesForecast, getSalesPrediction } from "../api/api";

export default function AdminForecastSection({ outlets = [] }) {
  const [days, setDays] = useState(7);
  const [selectedOutletId, setSelectedOutletId] = useState("all");
  const [networkData, setNetworkData] = useState(null);
  const [outletData, setOutletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const approvedOutlets = outlets.filter((o) => o.status === "approved");

  const fetchData = async (targetDays = days, outletId = selectedOutletId) => {
    setLoading(true);
    setError("");
    try {
      if (outletId === "all") {
        const res = await getNetworkSalesForecast({ days: targetDays });
        setNetworkData(res.data);
        setOutletData(null);
      } else {
        const res = await getSalesPrediction({ days: targetDays, outlet: outletId });
        setOutletData(res.data);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
          "Could not load AI sales forecast. Verify franchise outlets have sales data logged."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(days, selectedOutletId);
  }, [days, selectedOutletId]);

  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "₹0.00";
    return `₹${parseFloat(val).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Build chart points
  const buildChartData = () => {
    if (selectedOutletId === "all" && networkData?.daily_network_forecast) {
      return networkData.daily_network_forecast.map((d) => ({
        displayDate: new Date(d.date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
        }),
        dayName: d.day_name,
        forecast: parseFloat(d.predicted_amount),
        lower: parseFloat(d.lower_bound),
        upper: parseFloat(d.upper_bound),
      }));
    } else if (outletData) {
      const points = [];
      if (outletData.historical) {
        outletData.historical.forEach((h) => {
          points.push({
            displayDate: new Date(h.date).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
            }),
            dayName: h.day_name,
            actual: parseFloat(h.amount),
            forecast: null,
            lower: null,
            upper: null,
          });
        });
      }
      if (outletData.forecast) {
        const last = points[points.length - 1];
        if (last) {
          last.forecast = last.actual;
          last.lower = last.actual;
          last.upper = last.actual;
        }
        outletData.forecast.forEach((f) => {
          points.push({
            displayDate: new Date(f.date).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
            }),
            dayName: f.day_name,
            actual: null,
            forecast: parseFloat(f.predicted_amount),
            lower: parseFloat(f.lower_bound),
            upper: parseFloat(f.upper_bound),
          });
        });
      }
      return points;
    }
    return [];
  };

  const chartData = buildChartData();
  const isAll = selectedOutletId === "all";

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0]?.payload;
    if (!item) return null;

    return (
      <div style={styles.tooltipBox}>
        <div style={styles.tooltipHeader}>
          <span style={styles.tooltipDate}>{item.displayDate}</span>
          <span style={styles.tooltipDayName}>{item.dayName}</span>
        </div>
        <div style={styles.tooltipBody}>
          {item.actual !== undefined && item.actual !== null && (
            <div style={styles.tooltipRow}>
              <span style={{ ...styles.tooltipDot, background: "var(--teal)" }} />
              <span>Actual:</span>
              <strong style={styles.tooltipVal}>{formatCurrency(item.actual)}</strong>
            </div>
          )}
          {item.forecast !== undefined && item.forecast !== null && (
            <>
              <div style={styles.tooltipRow}>
                <span style={{ ...styles.tooltipDot, background: "var(--amber)" }} />
                <span>{isAll ? "Network Forecast:" : "Projected Sales:"}</span>
                <strong style={{ ...styles.tooltipVal, color: "var(--amber)" }}>
                  {formatCurrency(item.forecast)}
                </strong>
              </div>
              <div style={styles.tooltipRange}>
                80% Band: {formatCurrency(item.lower)} – {formatCurrency(item.upper)}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* Header Banner */}
      <div style={styles.headerCard}>
        <div style={styles.headerLeft}>
          <div style={styles.badgeRow}>
            <span style={styles.aiBadge}>Corporate Revenue Planning</span>
          </div>
          <h2 style={styles.pageTitle}>Network Sales Forecasting &amp; Royalty Planning</h2>
          <p style={styles.pageSubtitle}>
            Aggregated corporate projections across all franchise locations. Forecast collective revenue,
            project monthly royalty collections, and identify high-growth hubs.
          </p>
        </div>

        <div style={styles.headerControls}>
          {/* Outlet Filter Dropdown */}
          <div style={styles.controlField}>
            <label style={styles.controlLabel}>View Scope:</label>
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              style={styles.select}
            >
              <option value="all">Entire Network ({approvedOutlets.length} Outlets)</option>
              {approvedOutlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.outlet_name} ({o.city})
                </option>
              ))}
            </select>
          </div>

          {/* Horizon Selector */}
          <div style={styles.horizonGroup}>
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                style={{
                  ...styles.horizonBtn,
                  ...(days === d ? styles.horizonBtnActive : {}),
                }}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchData(days, selectedOutletId)}
            disabled={loading}
            style={styles.refreshBtn}
          >
            {loading ? "Forecasting..." : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div style={styles.errorBox}>
          <div>
            <div style={{ fontWeight: 600, color: "var(--red)" }}>Forecasting Notice</div>
            <div style={{ fontSize: "13px", color: "var(--ink-soft)", marginTop: "2px" }}>{error}</div>
          </div>
        </div>
      ) : loading && !networkData && !outletData ? (
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <div style={styles.loadingText}>Compiling Multi-Outlet Machine Learning Models...</div>
          <div style={styles.loadingSub}>Synthesizing network time-series trends and royalty liabilities</div>
        </div>
      ) : (
        <>
          {/* Top KPI Deck */}
          <div style={styles.kpiGrid}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>
                  {isAll ? `Network Revenue (${days}d)` : `Outlet Revenue (${days}d)`}
                </span>
                <span style={styles.kpiPill}>
                  {isAll ? `${approvedOutlets.length} Outlets` : outletData?.city}
                </span>
              </div>
              <div style={styles.kpiValue}>
                {formatCurrency(
                  isAll
                    ? networkData?.network_projected_total
                    : outletData?.summary?.projected_total
                )}
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Projected Royalty Inflow</span>
                <span style={{ ...styles.kpiPill, background: "var(--teal-tint)", color: "var(--teal-deep)" }}>
                  HQ Revenue
                </span>
              </div>
              <div style={{ ...styles.kpiValue, color: "var(--teal)" }}>
                {formatCurrency(
                  isAll
                    ? networkData?.network_projected_royalty
                    : outletData?.summary?.projected_royalty
                )}
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Forecast Reliability</span>
                <span style={styles.confidenceScore}>
                  {isAll
                    ? `${networkData?.network_avg_confidence || 85}% Avg`
                    : `${outletData?.summary?.confidence_score || 85}%`}
                </span>
              </div>
              <div style={styles.confidenceBarWrap}>
                <div
                  style={{
                    ...styles.confidenceBarFill,
                    width: `${Math.min(
                      100,
                      isAll
                        ? networkData?.network_avg_confidence || 85
                        : outletData?.summary?.confidence_score || 85
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Daily Network Avg</span>
                <span style={styles.kpiPill}>Pacing</span>
              </div>
              <div style={styles.kpiValue}>
                {formatCurrency(
                  isAll
                    ? (networkData?.network_projected_total || 0) / days
                    : outletData?.summary?.projected_daily_avg
                )}
              </div>
            </div>
          </div>

          {/* Interactive Chart */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <div>
                <h3 style={styles.chartTitle}>
                  {isAll
                    ? `Network Aggregate Revenue Projection (${days} Days)`
                    : `${outletData?.outlet_name} Historical vs Forecast`}
                </h3>
              </div>

              <div style={styles.chartLegend}>
                {!isAll && (
                  <div style={styles.legendItem}>
                    <span style={{ ...styles.legendLine, background: "var(--teal)" }} />
                    <span>Actual Logged</span>
                  </div>
                )}
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendDashed, borderColor: "var(--amber)" }} />
                  <span>{isAll ? "Network Forecast" : "AI Forecast"}</span>
                </div>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendBox, background: "rgba(226, 139, 38, 0.15)" }} />
                  <span>Uncertainty Range</span>
                </div>
              </div>
            </div>

            <div style={{ width: "100%", height: 320, marginTop: "16px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="adminBandGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--amber)" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="displayDate"
                    stroke="var(--ink-soft)"
                    fontSize={11.5}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--ink-soft)"
                    fontSize={11.5}
                    tickLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />

                  <Area
                    type="monotone"
                    dataKey="upper"
                    stroke="transparent"
                    fill="url(#adminBandGradient)"
                    name="Upper Bound"
                  />

                  {!isAll && (
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="var(--teal)"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: "var(--teal)", stroke: "#fff", strokeWidth: 1.5 }}
                      connectNulls={false}
                      name="Actual Sales"
                    />
                  )}

                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="var(--amber)"
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={{ r: 4, fill: "var(--amber)", stroke: "#fff", strokeWidth: 1.5 }}
                    connectNulls={true}
                    name="Forecast"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Leaderboard Table (When Viewing All Network) */}
          {isAll && networkData?.outlet_forecasts && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>Franchise Outlets Forecast Leaderboard</h3>
                  <p style={styles.cardSubtitle}>
                    Projected performance breakdown, growth momentum &amp; royalty contribution by outlet.
                  </p>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Outlet Name</th>
                      <th style={styles.th}>City</th>
                      <th style={styles.th}>Projected Sales ({days}d)</th>
                      <th style={styles.th}>Daily Run Rate</th>
                      <th style={styles.th}>Projected Royalty</th>
                      <th style={styles.th}>Growth Trend</th>
                      <th style={styles.th}>Confidence</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {networkData.outlet_forecasts.map((o) => {
                      const isUp = o.projected_growth_pct > 2.0;
                      const isDown = o.projected_growth_pct < -2.0;

                      return (
                        <tr key={o.outlet_id} style={styles.tr}>
                          <td style={styles.tdName}>
                            <strong>{o.outlet_name}</strong>
                          </td>
                          <td style={styles.td}>{o.city}</td>
                          <td style={styles.tdAmount}>
                            {formatCurrency(o.projected_total)}
                          </td>
                          <td style={styles.tdMono}>
                            {formatCurrency(o.projected_daily_avg)}/day
                          </td>
                          <td style={{ ...styles.tdAmount, color: "var(--teal)" }}>
                            {formatCurrency(o.projected_royalty)}
                          </td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.trendPill,
                                background: isUp
                                  ? "var(--green-tint)"
                                  : isDown
                                  ? "var(--red-tint)"
                                  : "var(--surface-sunken)",
                                color: isUp
                                  ? "var(--green)"
                                  : isDown
                                  ? "var(--red)"
                                  : "var(--ink-soft)",
                              }}
                            >
                              {isUp ? "+" : ""}
                              {o.projected_growth_pct}%
                            </span>
                          </td>
                          <td style={styles.tdMono}>{o.confidence_score}%</td>
                          <td style={styles.td}>
                            <button
                              type="button"
                              onClick={() => setSelectedOutletId(String(o.outlet_id))}
                              style={styles.drillDownBtn}
                            >
                              Inspect Outlet
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

          {/* Strategic HQ Directives */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h3 style={styles.cardTitle}>HQ Corporate Directives &amp; Market Insights</h3>
                <p style={styles.cardSubtitle}>
                  Algorithmic takeaways for franchise expansion, commissary supply, and cash collections.
                </p>
              </div>
            </div>

            <div style={styles.insightsGrid}>
              {(isAll ? networkData?.insights : outletData?.insights)?.map((ins, idx) => (
                <div key={idx} style={styles.insightCard}>
                  <div style={styles.insightHeader}>
                    <span style={styles.insightCategory}>{ins.category?.toUpperCase() || "STRATEGIC"}</span>
                    <h4 style={styles.insightTitle}>{ins.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
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
  headerCard: {
    background: "var(--charcoal)",
    borderRadius: "var(--radius-lg)",
    padding: "24px 28px",
    color: "#FFFFFF",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "20px",
    boxShadow: "var(--shadow-card)",
  },
  headerLeft: {
    maxWidth: "680px",
  },
  badgeRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px",
    flexWrap: "wrap",
  },
  aiBadge: {
    display: "inline-flex",
    alignItems: "center",
    background: "rgba(255, 255, 255, 0.12)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    color: "#FFFFFF",
    padding: "3px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  modelTag: {
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    color: "rgba(255, 255, 255, 0.65)",
    background: "rgba(255, 255, 255, 0.08)",
    padding: "3px 8px",
    borderRadius: "6px",
  },
  pageTitle: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#FFFFFF",
    margin: "0 0 6px 0",
    letterSpacing: "-0.01em",
  },
  pageSubtitle: {
    fontSize: "13.5px",
    color: "rgba(255, 255, 255, 0.75)",
    margin: 0,
    lineHeight: 1.5,
  },
  headerControls: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  controlField: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.18)",
    borderRadius: "6px",
    padding: "4px 8px",
  },
  controlLabel: {
    fontSize: "11.5px",
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: 500,
  },
  select: {
    background: "transparent",
    border: "none",
    color: "#FFFFFF",
    fontSize: "12.5px",
    fontWeight: 600,
    outline: "none",
    cursor: "pointer",
  },
  horizonGroup: {
    display: "inline-flex",
    alignItems: "center",
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: "6px",
    padding: "3px",
    gap: "2px",
  },
  horizonBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: "12px",
    fontWeight: 600,
    padding: "6px 10px",
    borderRadius: "4px",
    cursor: "pointer",
  },
  horizonBtnActive: {
    background: "var(--amber)",
    color: "var(--charcoal)",
  },
  refreshBtn: {
    display: "inline-flex",
    alignItems: "center",
    background: "rgba(255, 255, 255, 0.12)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    color: "#FFFFFF",
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "12.5px",
    fontWeight: 600,
    cursor: "pointer",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  kpiCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "18px 20px",
    boxShadow: "var(--shadow-card)",
    display: "flex",
    flexDirection: "column",
  },
  kpiHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  kpiLabel: {
    fontSize: "12px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--ink-soft)",
  },
  kpiPill: {
    fontSize: "11px",
    background: "var(--surface-sunken)",
    color: "var(--ink-soft)",
    padding: "2px 7px",
    borderRadius: "4px",
    fontFamily: "var(--font-mono)",
  },
  kpiValue: {
    fontSize: "24px",
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
    color: "var(--ink)",
    margin: "0 0 8px 0",
    letterSpacing: "-0.02em",
  },
  confidenceScore: {
    fontSize: "11.5px",
    fontWeight: 700,
    color: "var(--teal)",
    fontFamily: "var(--font-mono)",
  },
  confidenceBarWrap: {
    width: "100%",
    height: "6px",
    background: "var(--surface-sunken)",
    borderRadius: "3px",
    overflow: "hidden",
    margin: "8px 0",
  },
  confidenceBarFill: {
    height: "100%",
    background: "var(--teal)",
    borderRadius: "3px",
  },
  kpiFootnote: {
    fontSize: "11.5px",
    color: "var(--ink-soft)",
    lineHeight: 1.4,
  },
  chartCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "22px 24px",
    boxShadow: "var(--shadow-card)",
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "14px",
  },
  chartTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--ink)",
    margin: "0 0 4px 0",
  },
  chartSubtitle: {
    fontSize: "12.5px",
    color: "var(--ink-soft)",
    margin: 0,
  },
  chartLegend: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    fontSize: "12px",
    color: "var(--ink-soft)",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  legendLine: {
    width: "14px",
    height: "3px",
    borderRadius: "2px",
  },
  legendDashed: {
    width: "14px",
    height: "0px",
    borderTop: "2px dashed",
  },
  legendBox: {
    width: "12px",
    height: "12px",
    borderRadius: "2px",
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "20px 22px",
    boxShadow: "var(--shadow-card)",
  },
  cardHeader: {
    marginBottom: "16px",
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--ink)",
    margin: "0 0 3px 0",
  },
  cardSubtitle: {
    fontSize: "12px",
    color: "var(--ink-soft)",
    margin: 0,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12.5px",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "2px solid var(--border)",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--ink-soft)",
    fontWeight: 600,
  },
  tr: {
    borderBottom: "1px solid var(--border)",
  },
  td: {
    padding: "12px",
    color: "var(--ink)",
  },
  tdName: {
    padding: "12px",
    color: "var(--ink)",
  },
  tdAmount: {
    padding: "12px",
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  tdMono: {
    padding: "12px",
    fontFamily: "var(--font-mono)",
    color: "var(--ink-soft)",
  },
  trendPill: {
    fontSize: "11px",
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: "4px",
    fontFamily: "var(--font-mono)",
  },
  drillDownBtn: {
    background: "var(--surface-sunken)",
    border: "1px solid var(--border)",
    color: "var(--teal)",
    fontSize: "12px",
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  insightsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "14px",
  },
  insightCard: {
    background: "var(--surface-sunken)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "14px 16px",
  },
  insightHeader: {
    marginBottom: "8px",
  },
  insightCategory: {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: 700,
    color: "var(--teal)",
  },
  insightTitle: {
    fontSize: "13.5px",
    fontWeight: 700,
    color: "var(--ink)",
    margin: "4px 0 0 0",
  },
  insightBody: {
    fontSize: "12px",
    color: "var(--ink-soft)",
    lineHeight: 1.45,
    margin: 0,
  },
  loadingBox: {
    padding: "60px 20px",
    textAlign: "center",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
  },
  spinner: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    border: "3px solid var(--border)",
    borderTopColor: "var(--teal)",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--ink)",
  },
  loadingSub: {
    fontSize: "12.5px",
    color: "var(--ink-soft)",
  },
  errorBox: {
    padding: "16px 20px",
    background: "var(--red-tint)",
    border: "1px solid rgba(179, 38, 30, 0.25)",
    borderRadius: "var(--radius-md)",
  },
  tooltipBox: {
    background: "#14213D",
    color: "#FFFFFF",
    padding: "10px 14px",
    borderRadius: "8px",
    boxShadow: "var(--shadow-pop)",
    fontSize: "12px",
    border: "1px solid rgba(255, 255, 255, 0.15)",
  },
  tooltipHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
    paddingBottom: "6px",
    marginBottom: "6px",
  },
  tooltipDate: {
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
  },
  tooltipDayName: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  tooltipBody: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  tooltipRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  tooltipDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  tooltipVal: {
    marginLeft: "auto",
    fontFamily: "var(--font-mono)",
  },
  tooltipRange: {
    fontSize: "11px",
    color: "rgba(255, 255, 255, 0.65)",
    paddingLeft: "14px",
    fontFamily: "var(--font-mono)",
  },
};
