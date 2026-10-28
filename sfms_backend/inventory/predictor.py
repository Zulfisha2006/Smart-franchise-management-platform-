"""
Inventory Depletion Predictor
─────────────────────────────
Estimates when each stock item will run out by analysing:
  1. Historical consumption (negative stock adjustments over time)
  2. Restock history (fulfilled requests → interval + qty patterns)
  3. AI-predicted demand from the sales forecasting engine

Outputs:
  • Days-to-depletion estimate per item
  • Suggested restock quantity (configurable buffer, default = 7 days supply)
  • Urgency classification (Critical / Warning / Adequate)
  • Draft restock request payloads ready for owner review
"""

import math
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from accounts.models import Outlet
from .models import StockItem, RestockRequest, StockConsumptionLog


# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

# Default daily consumption rate when we have no data (units/day)
FALLBACK_DAILY_RATE = 5.0

# Number of days of buffer stock the system recommends
RESTOCK_BUFFER_DAYS = 7

# Urgency thresholds (days until depletion)
CRITICAL_THRESHOLD = 2
WARNING_THRESHOLD = 5


_DEMAND_CACHE = {}


class InventoryDepletionPredictor:
    """
    Per-outlet inventory depletion analysis.
    Calculates consumption velocity for every stock item and projects
    the date on which each item will be fully consumed.
    """

    def __init__(self, outlet):
        self.outlet = outlet
        self.demand_factor, self.demand_trend, self.demand_note = self._get_sales_demand_factor()

    def _get_sales_demand_factor(self):
        """Fetch predicted demand growth factor from the sales forecasting engine."""
        cache_key = (self.outlet.id, timezone.localdate().isoformat())
        if cache_key in _DEMAND_CACHE:
            return _DEMAND_CACHE[cache_key]

        try:
            from sales.predictor import SalesPredictor
            sales_pred = SalesPredictor(self.outlet, forecast_days=7)
            res = sales_pred.predict()
            growth_pct = res.get("summary", {}).get("projected_growth_pct", 0.0)
            trend = res.get("summary", {}).get("trend", "steady")

            if growth_pct > 0:
                factor = 1.0 + min(0.5, growth_pct / 100.0)
                note = f"Demand adjusted (+{growth_pct:.1f}% expected footfall surge)"
            elif growth_pct < 0:
                factor = max(0.7, 1.0 + (growth_pct / 100.0))
                note = f"Demand adjusted ({growth_pct:.1f}% projected demand contraction)"
            else:
                factor = 1.0
                note = "Standard baseline demand velocity"
            result = (round(factor, 2), trend, note)
            _DEMAND_CACHE[cache_key] = result
            return result
        except Exception:
            return 1.0, "steady", "Standard baseline demand"

    # ── Public API ────────────────────────────────────────────────────────────

    def analyse(self):
        """
        Main entry point. Returns a complete depletion report for the outlet.
        """
        items = list(
            StockItem.objects.filter(outlet=self.outlet).order_by("name")
        )
        if not items:
            return self._empty_report()

        today = timezone.localdate()
        results = []

        for item in items:
            analysis = self._analyse_item(item, today)
            results.append(analysis)

        # Sort by urgency — critical items first
        results.sort(key=lambda r: r["days_until_depletion"])

        # Summary counts
        critical_count = sum(1 for r in results if r["urgency"] == "critical")
        warning_count = sum(1 for r in results if r["urgency"] == "warning")
        adequate_count = sum(1 for r in results if r["urgency"] == "adequate")

        # Draft restock requests for all items needing attention
        draft_restocks = [
            self._build_draft_restock(r)
            for r in results
            if (r["urgency"] in ("critical", "warning") or r["is_low_stock"] or r["suggested_restock_qty"] > 0)
            and r["suggested_restock_qty"] > 0
        ]

        return {
            "outlet_id": self.outlet.id,
            "outlet_name": self.outlet.outlet_name,
            "city": self.outlet.city,
            "analysis_date": today.isoformat(),
            "total_items": len(results),
            "critical_count": critical_count,
            "warning_count": warning_count,
            "adequate_count": adequate_count,
            "demand_factor": self.demand_factor,
            "demand_trend": self.demand_trend,
            "demand_note": self.demand_note,
            "items": results,
            "draft_restocks": draft_restocks,
        }

    # ── Item-level analysis ───────────────────────────────────────────────────

    def _analyse_item(self, item, today):
        """Compute depletion metrics for a single stock item."""
        current_qty = float(item.current_quantity)
        threshold = float(item.low_stock_threshold)

        # 1. Calculate consumption rate
        rate_info = self._calculate_consumption_rate(item, today)
        daily_rate = rate_info["daily_rate"]
        rate_source = rate_info["source"]
        data_points = rate_info["data_points"]

        # 2. Days until complete depletion
        if daily_rate <= 0:
            days_to_depletion = 999  # effectively infinite
        else:
            days_to_depletion = round(current_qty / daily_rate, 1)

        # 3. Projected depletion date
        if days_to_depletion >= 999:
            depletion_date = None
        else:
            depletion_date = (
                today + timedelta(days=int(math.ceil(days_to_depletion)))
            ).isoformat()

        # 4. Days until hits low-stock threshold
        if daily_rate <= 0:
            days_to_threshold = 999
        else:
            qty_above_threshold = max(0, current_qty - threshold)
            days_to_threshold = round(qty_above_threshold / daily_rate, 1)

        # 5. Urgency classification
        if days_to_depletion <= CRITICAL_THRESHOLD:
            urgency = "critical"
        elif days_to_depletion <= WARNING_THRESHOLD:
            urgency = "warning"
        else:
            urgency = "adequate"

        # 6. Suggested restock quantity
        suggested_qty = self._calculate_restock_qty(
            daily_rate, current_qty, threshold
        )

        # 7. Build the advisory message
        advisory = self._build_advisory(
            item, days_to_depletion, daily_rate, suggested_qty
        )

        return {
            "item_id": item.id,
            "item_name": item.name,
            "unit": item.unit,
            "current_quantity": current_qty,
            "low_stock_threshold": threshold,
            "is_low_stock": item.is_low_stock,
            "daily_consumption_rate": round(daily_rate, 2),
            "rate_source": rate_source,
            "rate_data_points": data_points,
            "days_until_depletion": round(min(days_to_depletion, 999), 1),
            "days_until_threshold": round(min(days_to_threshold, 999), 1),
            "projected_depletion_date": depletion_date,
            "urgency": urgency,
            "suggested_restock_qty": suggested_qty,
            "advisory": advisory,
        }

    def _calculate_consumption_rate(self, item, today):
        """
        Determine the daily consumption rate using the best available data:
        Priority 1: Consumption log entries (direct measurement)
        Priority 2: Restock fulfillment history (inferred consumption)
        Priority 3: Heuristic fallback
        """

        # ─── Priority 1: Consumption logs ────────────────────────────────
        logs = list(
            StockConsumptionLog.objects.filter(stock_item=item)
            .order_by("-recorded_at")[:60]
        )

        if len(logs) >= 3:
            total_consumed = sum(float(log.quantity_change) for log in logs)
            earliest = logs[-1].recorded_at.date()
            latest = logs[0].recorded_at.date()
            span_days = max(1, (latest - earliest).days)
            daily_rate = abs(total_consumed) / span_days
            return {
                "daily_rate": max(0.01, daily_rate),
                "source": "consumption_log",
                "data_points": len(logs),
            }

        # ─── Priority 2: Fulfilled restock history ───────────────────────
        fulfilled = list(
            RestockRequest.objects.filter(
                stock_item=item,
                status=RestockRequest.Status.FULFILLED,
            ).order_by("updated_at")
        )

        if len(fulfilled) >= 2:
            # Infer consumption: between two restocks, the stock was consumed
            total_consumed_est = sum(
                float(r.requested_qty) for r in fulfilled[:-1]
            )
            first_restock = fulfilled[0].updated_at.date()
            last_restock = fulfilled[-1].updated_at.date()
            span_days = max(1, (last_restock - first_restock).days)
            daily_rate = total_consumed_est / span_days
            return {
                "daily_rate": max(0.01, daily_rate),
                "source": "restock_history",
                "data_points": len(fulfilled),
            }

        # Single fulfilled restock — rough estimate
        if len(fulfilled) == 1:
            r = fulfilled[0]
            days_since = max(1, (today - r.updated_at.date()).days)
            consumed = float(r.requested_qty) - float(item.current_quantity)
            consumed = max(0, consumed)
            daily_rate = consumed / days_since if consumed > 0 else FALLBACK_DAILY_RATE * 0.5
            return {
                "daily_rate": max(0.01, daily_rate),
                "source": "single_restock_estimate",
                "data_points": 1,
            }

        # ─── Priority 3: Fallback heuristic ──────────────────────────────
        # Use threshold as a proxy: if threshold=50, assume ~threshold/10 per day
        if float(item.low_stock_threshold) > 0:
            estimated_rate = float(item.low_stock_threshold) / 10.0
        else:
            estimated_rate = FALLBACK_DAILY_RATE

        # Apply predicted demand factor
        effective_rate = max(0.01, round(estimated_rate * self.demand_factor, 2))
        return {
            "daily_rate": effective_rate,
            "base_rate": max(0.01, estimated_rate),
            "source": "heuristic_estimate",
            "data_points": 0,
        }

    def _calculate_restock_qty(self, daily_rate, current_qty, threshold):
        """
        Suggest a restock quantity that provides RESTOCK_BUFFER_DAYS of supply
        above the low-stock threshold.
        """
        if daily_rate <= 0:
            return 0

        # Target: enough to last buffer days above threshold
        target_qty = (daily_rate * RESTOCK_BUFFER_DAYS) + threshold
        needed = max(0, target_qty - current_qty)

        # If item is at or below threshold or running out in <= 5 days, guarantee safety stock
        if (needed <= 0 and current_qty <= threshold) or (needed <= 0 and (current_qty / max(daily_rate, 0.01)) <= WARNING_THRESHOLD):
            needed = max(daily_rate * RESTOCK_BUFFER_DAYS, threshold * 0.75, 10.0)

        # Round up to a sensible quantity
        if needed <= 0:
            return 0
        if needed < 10:
            return round(math.ceil(needed))
        elif needed < 100:
            return round(math.ceil(needed / 5) * 5)
        else:
            return round(math.ceil(needed / 10) * 10)

    def _build_advisory(self, item, days_to_depletion, daily_rate, suggested_qty):
        """Generate a human-readable advisory string for the item."""
        name = item.name
        unit = item.unit

        if days_to_depletion >= 999:
            return f"{name} stock levels are stable with minimal consumption detected."

        if days_to_depletion <= 1:
            msg = f"{name} may run out today."
        elif days_to_depletion <= 2:
            msg = f"{name} may run out in two days."
        else:
            msg = f"{name} may run out in {int(math.ceil(days_to_depletion))} days."

        if suggested_qty > 0:
            msg += f" Suggested restock quantity: {suggested_qty} {unit}."

        return msg

    def _build_draft_restock(self, item_analysis):
        """Build a draft restock request payload from the analysis."""
        urgency = item_analysis["urgency"]
        note_prefix = "URGENT: " if urgency == "critical" else ""
        note = (
            f"{note_prefix}Estimated depletion in "
            f"{item_analysis['days_until_depletion']} days. "
            f"Avg daily consumption: {item_analysis['daily_consumption_rate']} "
            f"{item_analysis['unit']}/day. "
            f"Current stock: {item_analysis['current_quantity']} {item_analysis['unit']}."
        )

        return {
            "stock_item_id": item_analysis["item_id"],
            "stock_item_name": item_analysis["item_name"],
            "unit": item_analysis["unit"],
            "suggested_qty": item_analysis["suggested_restock_qty"],
            "urgency": urgency,
            "days_until_depletion": item_analysis["days_until_depletion"],
            "daily_consumption_rate": item_analysis["daily_consumption_rate"],
            "current_quantity": item_analysis["current_quantity"],
            "advisory": item_analysis["advisory"],
            "note": note,
        }

    def _empty_report(self):
        """Return an empty report when the outlet has no stock items."""
        return {
            "outlet_id": self.outlet.id,
            "outlet_name": self.outlet.outlet_name,
            "city": self.outlet.city,
            "analysis_date": timezone.localdate().isoformat(),
            "total_items": 0,
            "critical_count": 0,
            "warning_count": 0,
            "adequate_count": 0,
            "items": [],
            "draft_restocks": [],
        }


# ──────────────────────────────────────────────────────────────────────────────
# Network-wide analysis (Admin/HQ view)
# ──────────────────────────────────────────────────────────────────────────────

def get_network_depletion_report():
    """
    Aggregate depletion analysis across all approved outlets.
    Returns a network-level summary with per-outlet breakdowns.
    """
    approved_outlets = list(
        Outlet.objects.filter(status=Outlet.Status.APPROVED)
    )

    if not approved_outlets:
        return {
            "analysis_date": timezone.localdate().isoformat(),
            "outlets_count": 0,
            "total_critical": 0,
            "total_warning": 0,
            "total_adequate": 0,
            "total_items": 0,
            "outlet_reports": [],
            "network_draft_restocks": [],
        }

    outlet_reports = []
    all_draft_restocks = []
    total_critical = 0
    total_warning = 0
    total_adequate = 0
    total_items = 0

    for outlet in approved_outlets:
        predictor = InventoryDepletionPredictor(outlet)
        report = predictor.analyse()
        outlet_reports.append(report)
        total_critical += report["critical_count"]
        total_warning += report["warning_count"]
        total_adequate += report["adequate_count"]
        total_items += report["total_items"]

        # Annotate draft restocks with outlet info
        for dr in report["draft_restocks"]:
            dr["outlet_id"] = outlet.id
            dr["outlet_name"] = outlet.outlet_name
            dr["city"] = outlet.city
            all_draft_restocks.append(dr)

    # Sort network restocks by urgency (critical first, then by days)
    urgency_order = {"critical": 0, "warning": 1, "adequate": 2}
    all_draft_restocks.sort(
        key=lambda x: (urgency_order.get(x["urgency"], 2), x["days_until_depletion"])
    )

    return {
        "analysis_date": timezone.localdate().isoformat(),
        "outlets_count": len(approved_outlets),
        "total_critical": total_critical,
        "total_warning": total_warning,
        "total_adequate": total_adequate,
        "total_items": total_items,
        "outlet_reports": outlet_reports,
        "network_draft_restocks": all_draft_restocks,
    }
