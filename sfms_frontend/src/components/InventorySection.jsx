import { useState, useEffect } from "react";
import {
  createStockItem,
  adjustStock,
  getInventoryDepletion,
  submitDraftRestock,
} from "../api/api";
import Badge from "./Badge";

/**
 * InventorySection — Franchise Owner Inventory Management with Predictive Depletion.
 * Estimates when items run out using daily consumption rates and predicted sales demand.
 * Provides automated draft restock request generation for owner review.
 */
export default function InventorySection({
  items = [],
  outlet,
  onReload,
  onRestockSubmitted,
}) {
  const [form, setForm] = useState({
    name: "",
    unit: "pieces",
    current_quantity: "",
    low_stock_threshold: "",
  });
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [adjustingId, setAdjustingId] = useState(null);

  // Predictive Depletion State
  const [depletionData, setDepletionData] = useState(null);
  const [loadingDepletion, setLoadingDepletion] = useState(false);

  // Draft Restock Review Modal State
  const [activeDraft, setActiveDraft] = useState(null);
  const [draftQty, setDraftQty] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [submittingDraft, setSubmittingDraft] = useState(false);
  const [draftModalError, setDraftModalError] = useState("");

  const loadDepletion = async () => {
    setLoadingDepletion(true);
    try {
      const res = await getInventoryDepletion(outlet?.id);
      setDepletionData(res.data);
    } catch {
      // Graceful fallback to item serializer data if endpoint fails
    } finally {
      setLoadingDepletion(false);
    }
  };

  useEffect(() => {
    loadDepletion();
  }, [items.length, outlet?.id]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setSubmitting(true);
    try {
      await createStockItem(form);
      setForm({
        name: "",
        unit: "pieces",
        current_quantity: "",
        low_stock_threshold: "",
      });
      if (onReload) await onReload();
      loadDepletion();
    } catch (err) {
      const data = err.response?.data;
      setError(data ? Object.values(data)[0] : "Could not add item.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjust = async (id, delta) => {
    setError("");
    setAdjustingId(id);
    try {
      await adjustStock(id, delta);
      if (onReload) await onReload();
      loadDepletion();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not adjust stock quantity.");
    } finally {
      setAdjustingId(null);
    }
  };

  const openDraftModal = (draft) => {
    setActiveDraft(draft);
    setDraftQty(draft.suggested_qty || draft.suggested_restock_qty || 50);
    setDraftNote(
      draft.note ||
        draft.advisory ||
        `${draft.item_name || draft.stock_item_name} may run out soon. Suggested restock quantity: ${
          draft.suggested_qty || draft.suggested_restock_qty || 50
        } ${draft.unit}.`
    );
    setDraftModalError("");
  };

  const closeDraftModal = () => {
    setActiveDraft(null);
    setDraftQty("");
    setDraftNote("");
    setDraftModalError("");
  };

  const handleConfirmRestock = async (e) => {
    e.preventDefault();
    if (!activeDraft) return;
    setSubmittingDraft(true);
    setDraftModalError("");

    const stockItemId = activeDraft.stock_item_id || activeDraft.item_id || activeDraft.id;

    try {
      await submitDraftRestock({
        stock_item: stockItemId,
        requested_qty: draftQty,
        note: draftNote,
      });

      const itemName = activeDraft.stock_item_name || activeDraft.item_name || activeDraft.name;
      setSuccessMsg(
        `Restock request for ${itemName} (${draftQty} ${activeDraft.unit}) submitted to HQ Admin.`
      );
      closeDraftModal();
      if (onRestockSubmitted) await onRestockSubmitted();
      loadDepletion();
    } catch (err) {
      setDraftModalError(
        err.response?.data?.detail || "Could not submit restock request. Please try again."
      );
    } finally {
      setSubmittingDraft(false);
    }
  };

  // Merge items with depletion info
  const enrichedItems = items.map((item) => {
    const depletionItem = depletionData?.items?.find((di) => di.item_id === item.id);
    return {
      ...item,
      daily_rate: depletionItem?.daily_consumption_rate ?? (parseFloat(item.low_stock_threshold) / 10),
      days_to_depletion: depletionItem?.days_until_depletion ?? item.days_until_depletion,
      suggested_qty: depletionItem?.suggested_restock_qty ?? item.suggested_restock_qty ?? 0,
      advisory: depletionItem?.advisory || item.depletion_advisory || "",
      urgency: depletionItem?.urgency || (item.is_low_stock ? "critical" : "adequate"),
    };
  });

  // Filter items that need restock or have active depletion alerts
  const itemsNeedingRestock = enrichedItems.filter(
    (it) =>
      it.is_low_stock ||
      (it.days_to_depletion !== null && it.days_to_depletion !== undefined && it.days_to_depletion <= 7) ||
      it.suggested_qty > 0
  );

  const formatDaysText = (days) => {
    if (days === null || days === undefined || days >= 999) return "Stable";
    if (days <= 1) return "Runs out today";
    if (days <= 2) return "Runs out in 2 days";
    return `Runs out in ${Math.ceil(days)} days`;
  };

  return (
    <div style={styles.container}>
      {/* ─── Predictive Depletion & Demand Estimates ──────────────────── */}
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h3 style={styles.heading}>Stock Depletion &amp; Demand Estimates</h3>
          </div>
          {depletionData?.demand_note && (
            <span style={styles.demandPill}>
              {depletionData.demand_note}
            </span>
          )}
        </div>

        {successMsg && <div style={styles.successBox}>{successMsg}</div>}
        {error && <div style={styles.errorBox}>{error}</div>}

        {itemsNeedingRestock.length === 0 ? (
          <div style={styles.adequateBox}>
            All inventory items have adequate stock based on recent consumption rates and predicted demand.
          </div>
        ) : (
          <div style={styles.advisoryGrid}>
            {itemsNeedingRestock.map((it) => {
              const days = it.days_to_depletion;
              const isUrgent = it.is_low_stock || (days !== null && days <= 2);
              const advisoryMsg =
                it.advisory ||
                (days && days <= 2
                  ? `${it.name} may run out in two days. Suggested restock quantity: ${it.suggested_qty || parseFloat(it.low_stock_threshold) * 2} ${it.unit}.`
                  : `${it.name} will run out soon based on current consumption.`);

              return (
                <div
                  key={it.id}
                  style={{
                    ...styles.advisoryCard,
                    borderColor: isUrgent ? "rgba(179,38,30,0.3)" : "var(--border)",
                    background: isUrgent ? "var(--red-tint)" : "var(--paper)",
                  }}
                >
                  <div style={styles.advisoryTop}>
                    <div>
                      <div style={styles.advisoryItemName}>{it.name}</div>
                      <div style={styles.advisoryText}>{advisoryMsg}</div>
                    </div>
                    <span
                      style={{
                        ...styles.statusTag,
                        background: isUrgent ? "var(--red)" : "var(--amber)",
                        color: "#fff",
                      }}
                    >
                      {formatDaysText(days)}
                    </span>
                  </div>

                  <div style={styles.advisoryMetrics}>
                    <div style={styles.metricCol}>
                      <span style={styles.metricLabel}>Current Stock</span>
                      <span style={styles.metricValue} className="mono">
                        {parseFloat(it.current_quantity)} {it.unit}
                      </span>
                    </div>
                    <div style={styles.metricCol}>
                      <span style={styles.metricLabel}>Consumption Rate</span>
                      <span style={styles.metricValue} className="mono">
                        {it.daily_rate ? `${parseFloat(it.daily_rate).toFixed(1)} ${it.unit}/day` : "—"}
                      </span>
                    </div>
                    <div style={styles.metricCol}>
                      <span style={styles.metricLabel}>Suggested Restock</span>
                      <span
                        style={{ ...styles.metricValue, color: "var(--teal)", fontWeight: 700 }}
                        className="mono"
                      >
                        {it.suggested_qty > 0 ? `${it.suggested_qty} ${it.unit}` : "—"}
                      </span>
                    </div>
                    <div style={{ marginLeft: "auto" }}>
                      <button
                        style={styles.actionBtn}
                        onClick={() =>
                          openDraftModal({
                            stock_item_id: it.id,
                            stock_item_name: it.name,
                            unit: it.unit,
                            suggested_qty: it.suggested_qty || Math.ceil(parseFloat(it.low_stock_threshold) * 1.5),
                            days_until_depletion: it.days_to_depletion,
                            advisory: advisoryMsg,
                            note: advisoryMsg,
                          })
                        }
                      >
                        Review Restock
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Inventory Management Table ───────────────────────────────── */}
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h3 style={styles.heading}>Current Inventory Stock</h3>
          </div>
        </div>

        {/* Quick Add Item Form */}
        <form onSubmit={handleAdd} style={styles.addForm}>
          <input
            style={{ ...styles.input, flex: 1.5 }}
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Item name (e.g. Burger Buns)"
            required
          />
          <select style={styles.input} name="unit" value={form.unit} onChange={handleChange}>
            <option value="pieces">Pieces</option>
            <option value="kg">Kg</option>
            <option value="litre">Litre</option>
            <option value="packs">Packs</option>
          </select>
          <input
            style={styles.input}
            type="number"
            step="0.01"
            name="current_quantity"
            value={form.current_quantity}
            onChange={handleChange}
            placeholder="Initial Quantity"
            required
          />
          <input
            style={styles.input}
            type="number"
            step="0.01"
            name="low_stock_threshold"
            value={form.low_stock_threshold}
            onChange={handleChange}
            placeholder="Low Stock Alert At"
            required
          />
          <button style={styles.primaryBtn} type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "+ Add Item"}
          </button>
        </form>

        {enrichedItems.length === 0 ? (
          <div style={styles.empty}>No inventory items registered yet. Use the form above to add your first stock item.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Item</th>
                  <th style={styles.th}>Current Stock</th>
                  <th style={styles.th}>Daily Consumption</th>
                  <th style={styles.th}>Estimated Run-Out</th>
                  <th style={styles.th}>Suggested Restock</th>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Adjust / Action</th>
                </tr>
              </thead>
              <tbody>
                {enrichedItems.map((item) => {
                  const days = item.days_to_depletion;
                  const isDepletingSoon = days !== null && days !== undefined && days <= 2;
                  const isLow = item.is_low_stock;

                  return (
                    <tr
                      key={item.id}
                      style={{
                        background: isLow
                          ? "var(--red-tint)"
                          : isDepletingSoon
                          ? "rgba(212,132,42,0.06)"
                          : undefined,
                      }}
                    >
                      <td style={{ ...styles.td, fontWeight: 700 }}>{item.name}</td>
                      <td style={styles.td} className="mono">
                        {parseFloat(item.current_quantity)} {item.unit}
                      </td>
                      <td style={styles.td} className="mono">
                        {item.daily_rate ? `${parseFloat(item.daily_rate).toFixed(1)} ${item.unit}/day` : "—"}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          fontWeight: 600,
                          color: isDepletingSoon ? "var(--red)" : days && days <= 5 ? "var(--amber)" : "var(--ink)",
                        }}
                      >
                        {formatDaysText(days)}
                      </td>
                      <td style={styles.td} className="mono">
                        {item.suggested_qty > 0 ? (
                          <span style={{ color: "var(--teal)", fontWeight: 700 }}>
                            {item.suggested_qty} {item.unit}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={styles.td}>
                        <Badge tone={item.is_low_stock ? "rejected" : "approved"}>
                          {item.is_low_stock ? "Low Stock" : "In Stock"}
                        </Badge>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <div style={styles.actionGroup}>
                          <div style={styles.adjustBtns}>
                            <button
                              style={styles.adjustBtn}
                              disabled={adjustingId === item.id || parseFloat(item.current_quantity) <= 0}
                              onClick={() => handleAdjust(item.id, -1)}
                              title="Reduce by 1"
                            >
                              −
                            </button>
                            <button
                              style={styles.adjustBtn}
                              disabled={adjustingId === item.id}
                              onClick={() => handleAdjust(item.id, 1)}
                              title="Add 1"
                            >
                              +
                            </button>
                          </div>
                          {(item.suggested_qty > 0 || isLow || isDepletingSoon) && (
                            <button
                              style={styles.tableRestockBtn}
                              onClick={() =>
                                openDraftModal({
                                  stock_item_id: item.id,
                                  stock_item_name: item.name,
                                  unit: item.unit,
                                  suggested_qty: item.suggested_qty || Math.ceil(parseFloat(item.low_stock_threshold) * 1.5),
                                  days_until_depletion: item.days_to_depletion,
                                  advisory: item.advisory,
                                  note: item.advisory,
                                })
                              }
                            >
                              Restock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Draft Restock Request Modal ──────────────────────────────── */}
      {activeDraft && (
        <div style={styles.modalOverlay} onClick={closeDraftModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalHeading}>Review Restock Request</h3>

            {draftModalError && <div style={styles.errorBox}>{draftModalError}</div>}

            <form onSubmit={handleConfirmRestock}>
              <div style={styles.formRow}>
                <label style={styles.formLabel}>Item</label>
                <div style={styles.staticField}>
                  {activeDraft.stock_item_name || activeDraft.item_name} ({activeDraft.unit})
                </div>
              </div>

              <div style={styles.formRow}>
                <label style={styles.formLabel}>Suggested Restock Quantity ({activeDraft.unit})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  style={styles.modalInput}
                  value={draftQty}
                  onChange={(e) => setDraftQty(e.target.value)}
                  required
                />
              </div>

              <div style={styles.formRow}>
                <label style={styles.formLabel}>Estimated Depletion Advisory</label>
                <div style={styles.advisoryNotice}>
                  {activeDraft.advisory || `${activeDraft.stock_item_name} may run out based on consumption velocity.`}
                </div>
              </div>

              <div style={styles.formRow}>
                <label style={styles.formLabel}>Note for HQ Admin</label>
                <textarea
                  style={styles.modalTextarea}
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  rows={3}
                  required
                />
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={closeDraftModal}
                  disabled={submittingDraft}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.primaryBtn}
                  disabled={submittingDraft}
                >
                  {submittingDraft ? "Submitting..." : "Submit to HQ Admin"}
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
    marginBottom: "16px",
    flexWrap: "wrap",
    gap: "8px",
  },
  heading: {
    fontSize: "15px",
    fontWeight: 700,
    margin: 0,
    color: "var(--ink)",
  },
  demandPill: {
    fontSize: "11.5px",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: "6px",
    background: "var(--paper)",
    border: "1px solid var(--border)",
    color: "var(--ink-soft)",
  },
  adequateBox: {
    padding: "16px 18px",
    borderRadius: "8px",
    background: "var(--paper)",
    border: "1px solid var(--border)",
    fontSize: "13px",
    color: "var(--ink-soft)",
  },
  advisoryGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  advisoryCard: {
    padding: "16px 18px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  advisoryTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  advisoryItemName: {
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--ink)",
    marginBottom: "3px",
  },
  advisoryText: {
    fontSize: "13px",
    color: "var(--ink)",
    fontWeight: 500,
    lineHeight: 1.45,
  },
  statusTag: {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  advisoryMetrics: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
    flexWrap: "wrap",
    borderTop: "1px solid rgba(0,0,0,0.06)",
    paddingTop: "10px",
  },
  metricCol: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  metricLabel: {
    fontSize: "10.5px",
    fontWeight: 600,
    color: "var(--ink-soft)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  metricValue: {
    fontSize: "13px",
    color: "var(--ink)",
  },
  actionBtn: {
    padding: "7px 14px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  addForm: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
  input: {
    padding: "9px 12px",
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
  errorBox: {
    background: "var(--red-tint)",
    color: "var(--red)",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "12px",
    fontWeight: 500,
    border: "1px solid rgba(179,38,30,0.2)",
  },
  successBox: {
    background: "rgba(26,127,106,0.08)",
    color: "var(--teal)",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "12px",
    fontWeight: 600,
    border: "1px solid rgba(26,127,106,0.25)",
  },
  empty: {
    color: "var(--ink-soft)",
    fontSize: "13px",
    padding: "30px 0",
    textAlign: "center",
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
    padding: "12px 12px",
    fontSize: "13px",
    borderBottom: "1px solid var(--border)",
  },
  actionGroup: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    justifyContent: "flex-end",
  },
  adjustBtns: {
    display: "flex",
    gap: "4px",
  },
  adjustBtn: {
    width: "26px",
    height: "26px",
    borderRadius: "6px",
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--ink)",
  },
  tableRestockBtn: {
    padding: "5px 10px",
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    fontSize: "11.5px",
    fontWeight: 600,
    cursor: "pointer",
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
    padding: "24px",
    width: "100%",
    maxWidth: "480px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  },
  modalHeading: {
    fontSize: "16px",
    fontWeight: 800,
    color: "var(--ink)",
    margin: "0 0 16px 0",
  },
  formRow: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "14px",
  },
  formLabel: {
    fontSize: "11.5px",
    fontWeight: 600,
    color: "var(--ink-soft)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  staticField: {
    padding: "9px 12px",
    borderRadius: "6px",
    background: "var(--paper)",
    border: "1px solid var(--border)",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--ink)",
  },
  advisoryNotice: {
    padding: "10px 12px",
    borderRadius: "6px",
    background: "var(--paper)",
    border: "1px solid var(--border)",
    fontSize: "12.5px",
    color: "var(--ink)",
    lineHeight: 1.45,
  },
  modalInput: {
    padding: "9px 12px",
    borderRadius: "6px",
    border: "1.5px solid var(--border)",
    fontSize: "13px",
    outline: "none",
    background: "var(--paper)",
    color: "var(--ink)",
  },
  modalTextarea: {
    padding: "9px 12px",
    borderRadius: "6px",
    border: "1.5px solid var(--border)",
    fontSize: "13px",
    outline: "none",
    background: "var(--paper)",
    color: "var(--ink)",
    fontFamily: "var(--font-body)",
    resize: "vertical",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "20px",
  },
};
