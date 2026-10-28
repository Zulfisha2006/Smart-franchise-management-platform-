from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from accounts.models import Outlet, User
from .models import Sale
from .serializers import SaleSerializer


class IsApprovedFranchiseOwner(permissions.BasePermission):
    """Only a Franchise Owner with an APPROVED outlet can log sales."""
    def has_permission(self, request, view):
        user = request.user
        if not (user.is_authenticated and user.role == User.Role.FRANCHISE_OWNER):
            return False
        return Outlet.objects.filter(owner=user, status=Outlet.Status.APPROVED).exists()


class SaleCreateView(APIView):
    """
    POST /api/sales/create/
    Rules:
      1. Sales can only be submitted after 9 PM IST (21:00) — end-of-day reporting window.
      2. Once a sale entry for today is saved, it is LOCKED — no further updates allowed.
    """
    permission_classes = [IsApprovedFranchiseOwner]

    # The hour (in IST, 24-h) from which sales entry is permitted.
    ENTRY_ALLOWED_HOUR = 21  # 9 PM

    def post(self, request):
        outlet = Outlet.objects.get(owner=request.user, status=Outlet.Status.APPROVED)

        # --- Rule 1: Time gate — only after 9 PM IST ---
        now_ist = timezone.localtime()   # USE_TZ=True + TIME_ZONE='Asia/Kolkata' → IST
        if now_ist.hour < self.ENTRY_ALLOWED_HOUR:
            remaining_h = self.ENTRY_ALLOWED_HOUR - now_ist.hour - 1
            remaining_m = 60 - now_ist.minute
            if remaining_m == 60:
                remaining_m = 0
                remaining_h += 1
            return Response(
                {
                    "detail": (
                        f"Sales can only be logged after 9:00 PM IST. "
                        f"Entry window opens in {remaining_h}h {remaining_m}m."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        entry_date = request.data.get("date") or timezone.localdate().isoformat()

        # --- Rule 2: Lock — once saved for today, no updates ---
        existing = Sale.objects.filter(outlet=outlet, date=entry_date).first()
        if existing:
            return Response(
                {
                    "detail": (
                        "Today's sales entry has already been saved and is now locked. "
                        "Once submitted, daily sales cannot be modified."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = SaleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(outlet=outlet)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class SaleListView(generics.ListAPIView):
    """
    GET /api/sales/
    Franchise Owner -> sees only their own outlet's sales history.
    Admin -> sees all sales; optionally filter with ?outlet=<id>
    """
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.ADMIN:
            qs = Sale.objects.all()
            outlet_id = self.request.query_params.get("outlet")
            if outlet_id:
                qs = qs.filter(outlet_id=outlet_id)
            return qs
        return Sale.objects.filter(outlet__owner=user)


def _build_summary(sales_qs):
    """Shared helper: turns a queryset of Sale rows into summary stats."""
    today = timezone.localdate()
    month_start = today.replace(day=1)
    prev_month_end = month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)

    this_month_qs = sales_qs.filter(date__gte=month_start, date__lte=today)
    prev_month_qs = sales_qs.filter(date__gte=prev_month_start, date__lte=prev_month_end)

    this_month_total = this_month_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0")
    prev_month_total = prev_month_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0")

    days_elapsed = (today - month_start).days + 1
    avg_daily = (this_month_total / days_elapsed) if days_elapsed else Decimal("0")

    best_day = this_month_qs.order_by("-amount").first()
    worst_day = this_month_qs.order_by("amount").first()

    if prev_month_total > 0:
        growth_pct = float((this_month_total - prev_month_total) / prev_month_total * 100)
    else:
        growth_pct = None

    today_entry = sales_qs.filter(date=today).first()

    return {
        "today_sales": str(today_entry.amount) if today_entry else "0",
        "today_sale_locked": today_entry is not None,  # True once today's entry exists
        "this_month_total": str(this_month_total),
        "previous_month_total": str(prev_month_total),
        "average_daily": str(round(avg_daily, 2)),
        "growth_percent": round(growth_pct, 1) if growth_pct is not None else None,
        "best_day": {"date": best_day.date, "amount": str(best_day.amount)} if best_day else None,
        "worst_day": {"date": worst_day.date, "amount": str(worst_day.amount)} if worst_day else None,
    }


class SaleSummaryView(APIView):
    """
    GET /api/sales/summary/
    Franchise Owner -> their own outlet's stats (today, month total, avg, growth %, best/worst day).
    Admin -> a per-outlet breakdown across ALL outlets, for the comparison dashboard.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role == User.Role.ADMIN:
            results = []
            for outlet in Outlet.objects.filter(status=Outlet.Status.APPROVED):
                sales_qs = Sale.objects.filter(outlet=outlet)
                summary = _build_summary(sales_qs)
                summary["outlet_id"] = outlet.id
                summary["outlet_name"] = outlet.outlet_name
                summary["city"] = outlet.city
                results.append(summary)
            return Response(results)

        try:
            outlet = Outlet.objects.get(owner=user, status=Outlet.Status.APPROVED)
        except Outlet.DoesNotExist:
            return Response({"detail": "No approved outlet found."}, status=status.HTTP_404_NOT_FOUND)

        sales_qs = Sale.objects.filter(outlet=outlet)
        summary = _build_summary(sales_qs)
        summary["outlet_id"] = outlet.id
        summary["outlet_name"] = outlet.outlet_name
        return Response(summary)


class SalePredictionView(APIView):
    """
    GET /api/sales/predict/?days=7&outlet=<id>
    Franchise Owner -> generates AI sales forecast for their approved outlet.
    Admin -> generates AI sales forecast for any selected outlet (?outlet=<id>).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        days = request.query_params.get("days", 7)
        try:
            days = int(days)
        except (ValueError, TypeError):
            days = 7

        if user.role == User.Role.ADMIN:
            outlet_id = request.query_params.get("outlet")
            if outlet_id:
                try:
                    outlet = Outlet.objects.get(id=outlet_id)
                except Outlet.DoesNotExist:
                    return Response({"detail": "Outlet not found."}, status=status.HTTP_404_NOT_FOUND)
            else:
                outlet = Outlet.objects.filter(status=Outlet.Status.APPROVED).first()
                if not outlet:
                    return Response({"detail": "No approved outlets exist to forecast."}, status=status.HTTP_404_NOT_FOUND)
        else:
            try:
                outlet = Outlet.objects.get(owner=user, status=Outlet.Status.APPROVED)
            except Outlet.DoesNotExist:
                return Response(
                    {"detail": "No approved outlet found. AI forecasting requires an approved outlet."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        from .predictor import SalesPredictor
        predictor = SalesPredictor(outlet=outlet, forecast_days=days)
        prediction_result = predictor.forecast()
        return Response(prediction_result)


class NetworkSalesForecastView(APIView):
    """
    GET /api/sales/network-forecast/?days=7
    Admin only: Generates aggregate multi-outlet network sales forecast,
    projected royalty collection for HQ, and outlet growth comparisons.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.ADMIN:
            return Response({"detail": "Admin authorization required."}, status=status.HTTP_403_FORBIDDEN)

        days = request.query_params.get("days", 7)
        try:
            days = int(days)
        except (ValueError, TypeError):
            days = 7

        from .predictor import get_network_sales_forecast
        network_result = get_network_sales_forecast(forecast_days=days)
        return Response(network_result)

