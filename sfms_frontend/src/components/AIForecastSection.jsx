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
import { getSalesPrediction } from "../api/api";

export default function AIForecastSection({ outlet, onNavigateTab }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchForecast = async (forecastDays = days) => {
    setLoading(true);
    setError("");
    try {
      const res = await getSalesPrediction({ days: forecastDays });
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
          "Could not generate AI forecast. Please ensure your outlet is approved and has sales history."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast(days);
  }, [days]);

  // Transform historical and forecast into a unified chart timeline
  const buildChartData = () => {
    if (!data) return [];
    const points = [];

    // Historical records (up to last 14 days)
    if (data.historical && data.historical.length > 0) {
      data.historical.forEach((h) => {
        points.push({
          date: h.date,
          displayDate: new Date(h.date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          }),
          actual: parseFloat(h.amount),
          forecast: null,
          lower: null,
          upper: null,
          isForecast: false,
          dayName: h.day_name,
        });
      });
    }

    // Connect the last historical point with the forecast start for visual continuity
    const lastHist = points[points.length - 1];
    if (lastHist && data.forecast && data.forecast.length > 0) {
      lastHist.forecast = lastHist.actual;
      lastHist.lower = lastHist.actual;
      lastHist.upper = lastHist.actual;
    }

    // Forecast records
    if (data.forecast && data.forecast.length > 0) {
      data.forecast.forEach((f) => {
        const pred = parseFloat(f.predicted_amount);
        const low = parseFloat(f.lower_bound);
        const up = parseFloat(f.upper_bound);
        points.push({
          date: f.date,
          displayDate: new Date(f.date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          }),
          actual: null,
          forecast: pred,
          lower: low,
          upper: up,
          isForecast: true,
          dayName: f.day_name,
        });
      });
    }

    return points;
  };

  const chartData = buildChartData();
  const summary = data?.summary;
  const insights = data?.insights || [];
  const dowPatterns = data?.day_of_week_pattern || [];

  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "₹0.00";
    return `₹${parseFloat(val).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

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
          {item.actual !== null && (
            <div style={styles.tooltipRow}>
              <span style={{ ...styles.tooltipDot, background: "var(--teal)" }} />
              <span style={styles.tooltipLabel}>Actual Sales:</span>
              <strong style={styles.tooltipVal}>{formatCurrency(item.actual)}</strong>
            </div>
          )}
          {item.forecast !== null && item.isForecast && (
            <>
              <div style={styles.tooltipRow}>
                <span style={{ ...styles.tooltipDot, background: "var(--amber)" }} />
                <span style={styles.tooltipLabel}>Forecast:</span>
                <strong style={{ ...styles.tooltipVal, color: "var(--amber)" }}>
                  {formatCurrency(item.forecast)}
                </strong>
              </div>
              <div style={styles.tooltipSubRow}>
                <span style={styles.tooltipRangeLabel}>80% Confidence Band:</span>
                <span style={styles.tooltipRangeVal}>
                  {formatCurrency(item.lower)} – {formatCurrency(item.upper)}
                </span>
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
            <span style={styles.aiBadge}>Sales Forecasting</span>
          </div>
          <h2 style={styles.pageTitle}>Revenue &amp; Demand Forecasting</h2>
          <p style={styles.pageSubtitle}>
            Sales projections and demand planning for {outlet?.outlet_name || "your outlet"}.
          </p>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.horizonGroup}>
            <span style={styles.horizonLabel}>Horizon:</span>
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
                {d} Days
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchForecast(days)}
            disabled={loading}
            style={styles.refreshBtn}
          >
            {loading ? "Computing..." : "Recalculate"}
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
      ) : loading && !data ? (
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <div style={styles.loadingText}>Training Models &amp; Generating Projections...</div>
          <div style={styles.loadingSub}>Analyzing weekday seasonality, moving averages, and variance bounds</div>
        </div>
      ) : (
        <>
          {/* KPI Summary Grid */}
          <div style={styles.kpiGrid}>
            {/* 1. Projected Total Revenue */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Projected Revenue ({days}d)</span>
                <span
                  style={{
                    ...styles.trendPill,
                    background:
                      summary?.projected_growth_pct >= 0
                        ? "var(--green-tint)"
                        : "var(--red-tint)",
                    color:
                      summary?.projected_growth_pct >= 0
                        ? "var(--green)"
                        : "var(--red)",
                  }}
                >
                  {summary?.projected_growth_pct >= 0 ? "+" : ""}
                  {summary?.projected_growth_pct || 0}%
                </span>
              </div>
              <div style={styles.kpiValue}>
                {formatCurrency(summary?.projected_total)}
              </div>
            </div>

            {/* 2. Projected Daily Average */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Projected Daily Avg</span>
                <span style={styles.kpiTag}>Run Rate</span>
              </div>
              <div style={styles.kpiValue}>
                {formatCurrency(summary?.projected_daily_avg)}
              </div>
            </div>

            {/* 3. Forecast Reliability */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Forecast Reliability</span>
                <span style={styles.confidenceScore}>
                  {summary?.confidence_score || 85}%
                </span>
              </div>
              <div style={styles.confidenceBarWrap}>
                <div
                  style={{
                    ...styles.confidenceBarFill,
                    width: `${Math.min(100, Math.max(10, summary?.confidence_score || 85))}%`,
                  }}
                />
              </div>
            </div>

            {/* 4. Projected Royalty Reserve */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Est. Royalty Liability</span>
                <span style={styles.royaltyRateBadge}>
                  {summary?.royalty_percentage || 5.0}% rate
                </span>
              </div>
              <div style={{ ...styles.kpiValue, color: "var(--teal)" }}>
                {formatCurrency(summary?.projected_royalty)}
              </div>
            </div>
          </div>

          {/* Interactive Chart Container */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <div>
                <h3 style={styles.chartTitle}>Historical Sales vs Forecast Trajectory</h3>
              </div>
              <div style={styles.chartLegendCustom}>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendLine, background: "var(--teal)" }} />
                  <span>Actual Logged</span>
                </div>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendDashed, borderColor: "var(--amber)" }} />
                  <span>Forecast</span>
                </div>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendBox, background: "rgba(226, 139, 38, 0.15)" }} />
                  <span>Confidence Range</span>
                </div>
              </div>
            </div>

            <div style={{ width: "100%", height: 340, marginTop: "16px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--teal)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--teal)" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="confidenceBandGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--amber)" stopOpacity={0.06} />
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

                  {/* Confidence Interval Area */}
                  <Area
                    type="monotone"
                    dataKey="upper"
                    stroke="transparent"
                    fill="url(#confidenceBandGradient)"
                    name="Upper Bound"
                    isAnimationActive={true}
                  />

                  {/* Actual Historical Line */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="var(--teal)"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "var(--teal)", stroke: "#fff", strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: "var(--teal)" }}
                    connectNulls={false}
                    name="Actual Sales"
                  />

                  {/* Forecast Line */}
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="var(--amber)"
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={{ r: 4, fill: "var(--amber)", stroke: "#fff", strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: "var(--amber)" }}
                    connectNulls={true}
                    name="AI Forecast"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Two-Column Analytics: Seasonality & Strategic AI Recommendations */}
          <div style={styles.twoCol}>
            {/* Left: Day-of-Week Seasonality */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>Weekday Seasonality Profile</h3>
                  <p style={styles.cardSubtitle}>
                    Weekly demand patterns calculated from historical performance.
                  </p>
                </div>
              </div>

              <div style={styles.seasonalityList}>
                {dowPatterns.map((dp) => {
                  const mult = parseFloat(dp.multiplier || 1.0);
                  const isPeak = mult >= 1.2;
                  const isSlow = mult <= 0.9;
                  const pct = Math.min(100, Math.round((mult / 1.5) * 100));

                  return (
                    <div key={dp.day} style={styles.dowRow}>
                      <div style={styles.dowNameCol}>
                        <span style={styles.dowDay}>{dp.day}</span>
                        {isPeak && <span style={styles.peakPill}>Peak Rush</span>}
                        {isSlow && <span style={styles.slowPill}>Low Flow</span>}
                      </div>

                      <div style={styles.dowBarCol}>
                        <div style={styles.dowBarBg}>
                          <div
                            style={{
                              ...styles.dowBarFill,
                              width: `${pct}%`,
                              background: isPeak
                                ? "var(--amber)"
                                : isSlow
                                ? "var(--ink-soft)"
                                : "var(--teal)",
                            }}
                          />
                        </div>
                      </div>

                      <div style={styles.dowStatCol}>
                        <span style={styles.dowMult}>{mult.toFixed(2)}x</span>
                        <span style={styles.dowAvg}>{formatCurrency(dp.avg_sales)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Operational Insights */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>Operational Directives</h3>
                  <p style={styles.cardSubtitle}>
                    Actionable recommendations generated for this forecast window.
                  </p>
                </div>
              </div>

              <div style={styles.insightsList}>
                {insights.map((ins, idx) => (
                  <div key={idx} style={styles.insightItem}>
                    <div style={styles.insightContent}>
                      <div style={styles.insightCategoryTag}>{ins.category?.toUpperCase() || "DIRECTIVE"}</div>
                      <div style={styles.insightTitle}>{ins.title}</div>
                      {ins.category === "inventory" && onNavigateTab && (
                        <button
                          type="button"
                          onClick={() => onNavigateTab("restock")}
                          style={styles.actionBtn}
                        >
                          Open Restock Portal
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  horizonGroup: {
    display: "inline-flex",
    alignItems: "center",
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: "8px",
    padding: "3px",
    gap: "2px",
  },
  horizonLabel: {
    fontSize: "11.5px",
    color: "rgba(255, 255, 255, 0.6)",
    padding: "0 8px",
    fontWeight: 500,
  },
  horizonBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: "12px",
    fontWeight: 600,
    padding: "6px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.15s ease",
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
    borderRadius: "8px",
    fontSize: "12.5px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s ease",
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
  trendPill: {
    fontSize: "11.5px",
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: "4px",
    fontFamily: "var(--font-mono)",
  },
  kpiTag: {
    fontSize: "11px",
    background: "var(--surface-sunken)",
    color: "var(--ink-soft)",
    padding: "2px 6px",
    borderRadius: "4px",
    fontFamily: "var(--font-mono)",
  },
  confidenceScore: {
    fontSize: "11.5px",
    fontWeight: 700,
    color: "var(--teal)",
    fontFamily: "var(--font-mono)",
  },
  royaltyRateBadge: {
    fontSize: "11px",
    background: "var(--teal-tint)",
    color: "var(--teal-deep)",
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: "4px",
  },
  kpiValue: {
    fontSize: "24px",
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
    color: "var(--ink)",
    margin: "0 0 8px 0",
    letterSpacing: "-0.02em",
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
  chartLegendCustom: {
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
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: "20px",
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
  seasonalityList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "16px",
  },
  dowRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  dowNameCol: {
    width: "85px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  dowDay: {
    fontSize: "12.5px",
    fontWeight: 600,
    color: "var(--ink)",
  },
  peakPill: {
    fontSize: "9.5px",
    fontWeight: 700,
    background: "var(--amber-tint)",
    color: "#7A4100",
    padding: "1px 5px",
    borderRadius: "4px",
    textTransform: "uppercase",
  },
  slowPill: {
    fontSize: "9.5px",
    fontWeight: 600,
    background: "var(--surface-sunken)",
    color: "var(--ink-soft)",
    padding: "1px 5px",
    borderRadius: "4px",
  },
  dowBarCol: {
    flex: 1,
  },
  dowBarBg: {
    width: "100%",
    height: "8px",
    background: "var(--surface-sunken)",
    borderRadius: "4px",
    overflow: "hidden",
  },
  dowBarFill: {
    height: "100%",
    borderRadius: "4px",
    transition: "width 0.3s ease",
  },
  dowStatCol: {
    width: "110px",
    textAlign: "right",
    display: "flex",
    flexDirection: "column",
  },
  dowMult: {
    fontSize: "12px",
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    color: "var(--ink)",
  },
  dowAvg: {
    fontSize: "11px",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-mono)",
  },
  seasonalityAdvice: {
    padding: "12px 14px",
    background: "var(--surface-sunken)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "var(--ink-soft)",
    lineHeight: 1.45,
    borderLeft: "3px solid var(--teal)",
  },
  insightsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  insightItem: {
    padding: "12px 14px",
    borderRadius: "8px",
    background: "var(--surface-sunken)",
    border: "1px solid var(--border)",
  },
  insightContent: {
    flex: 1,
  },
  insightCategoryTag: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: "var(--teal)",
    marginBottom: "4px",
  },
  insightTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--ink)",
    marginBottom: "3px",
  },
  insightText: {
    fontSize: "12px",
    color: "var(--ink-soft)",
    lineHeight: 1.45,
  },
  actionBtn: {
    marginTop: "8px",
    display: "inline-block",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--teal)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    padding: "4px 10px",
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
  tooltipLabel: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  tooltipVal: {
    marginLeft: "auto",
    fontFamily: "var(--font-mono)",
  },
  tooltipSubRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    paddingLeft: "14px",
    fontSize: "11px",
    color: "rgba(255, 255, 255, 0.65)",
    fontFamily: "var(--font-mono)",
  },
  tooltipRangeLabel: {},
  tooltipRangeVal: {},
};
