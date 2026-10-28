from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Outlet, User
from .models import RoyaltyInvoice
from .serializers import RoyaltyInvoiceSerializer


def _format_amt(value):
    """Safely formats Decimal or None to a standard 2-decimal string."""
    if value is None:
        return "0.00"
    return f"{Decimal(str(value)):.2f}"


class IsApprovedFranchiseOwner(permissions.BasePermission):
    """Only a Franchise Owner with an APPROVED outlet can interact with royalty payment actions."""
    def has_permission(self, request, view):
        user = request.user
        if not (user.is_authenticated and user.role == User.Role.FRANCHISE_OWNER):
            return False
        return Outlet.objects.filter(owner=user, status=Outlet.Status.APPROVED).exists()


class RoyaltyInvoiceListView(generics.ListAPIView):
    """
    GET /api/royalty/
    Franchise Owner -> sees only their own outlet's royalty invoices.
    Admin -> sees all invoices across all outlets; optionally filter with ?outlet=<id>
    """
    serializer_class = RoyaltyInvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.ADMIN:
            qs = RoyaltyInvoice.objects.all().select_related("outlet")
            outlet_id = self.request.query_params.get("outlet")
            if outlet_id:
                qs = qs.filter(outlet_id=outlet_id)
            return qs
        return RoyaltyInvoice.objects.filter(outlet__owner=user).select_related("outlet")


class RoyaltyMarkPaidView(APIView):
    """
    PATCH /api/royalty/<id>/mark-paid/
    Franchise Owner marks their own pending invoice as paid.
    Validates:
      - invoice must exist and belong to the requesting owner's outlet
      - invoice must not already be paid
    """
    permission_classes = [IsApprovedFranchiseOwner]

    def patch(self, request, pk):
        invoice = RoyaltyInvoice.objects.filter(pk=pk, outlet__owner=request.user).first()
        if not invoice:
            return Response(
                {"detail": "Invoice not found or does not belong to your outlet."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invoice.status == RoyaltyInvoice.Status.PAID:
            return Response(
                {"detail": "Invoice is already marked as paid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invoice.status = RoyaltyInvoice.Status.PAID
        invoice.paid_at = timezone.now()
        invoice.save(update_fields=["status", "paid_at", "updated_at"])

        serializer = RoyaltyInvoiceSerializer(invoice)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RoyaltySummaryView(APIView):
    """
    GET /api/royalty/summary/
    Franchise Owner -> returns summary stats for their outlet (pending amount, paid this year, etc.).
    Admin -> returns network-wide aggregated stats (total pending, collected this month, YTD collection).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localdate()
        current_year = today.year
        current_month = today.month

        if user.role == User.Role.ADMIN:
            invoices = RoyaltyInvoice.objects.all()

            total_pending = invoices.filter(
                status=RoyaltyInvoice.Status.PENDING
            ).aggregate(total=Sum("amount_due"))["total"] or Decimal("0.00")

            collected_this_month = invoices.filter(
                status=RoyaltyInvoice.Status.PAID,
                paid_at__year=current_year,
                paid_at__month=current_month,
            ).aggregate(total=Sum("amount_due"))["total"] or Decimal("0.00")

            collected_this_year = invoices.filter(
                status=RoyaltyInvoice.Status.PAID,
                paid_at__year=current_year,
            ).aggregate(total=Sum("amount_due"))["total"] or Decimal("0.00")

            total_collected_lifetime = invoices.filter(
                status=RoyaltyInvoice.Status.PAID
            ).aggregate(total=Sum("amount_due"))["total"] or Decimal("0.00")

            return Response({
                "total_pending_amount": _format_amt(total_pending),
                "total_collected_this_month": _format_amt(collected_this_month),
                "total_collected_this_year": _format_amt(collected_this_year),
                "total_collected_lifetime": _format_amt(total_collected_lifetime),
                "total_invoices_count": invoices.count(),
                "total_pending_count": invoices.filter(status=RoyaltyInvoice.Status.PENDING).count(),
            })

        try:
            outlet = Outlet.objects.get(owner=user, status=Outlet.Status.APPROVED)
        except Outlet.DoesNotExist:
            return Response(
                {"detail": "No approved outlet found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        invoices = RoyaltyInvoice.objects.filter(outlet=outlet)

        total_pending = invoices.filter(
            status=RoyaltyInvoice.Status.PENDING
        ).aggregate(total=Sum("amount_due"))["total"] or Decimal("0.00")

        paid_this_year = invoices.filter(
            status=RoyaltyInvoice.Status.PAID,
            year=current_year,
        ).aggregate(total=Sum("amount_due"))["total"] or Decimal("0.00")

        collected_this_month = invoices.filter(
            status=RoyaltyInvoice.Status.PAID,
            paid_at__year=current_year,
            paid_at__month=current_month,
        ).aggregate(total=Sum("amount_due"))["total"] or Decimal("0.00")

        total_paid_lifetime = invoices.filter(
            status=RoyaltyInvoice.Status.PAID
        ).aggregate(total=Sum("amount_due"))["total"] or Decimal("0.00")

        return Response({
            "outlet_id": outlet.id,
            "outlet_name": outlet.outlet_name,
            "royalty_percentage": str(outlet.royalty_percentage),
            "total_pending_amount": _format_amt(total_pending),
            "total_paid_this_year": _format_amt(paid_this_year),
            "total_collected_this_month": _format_amt(collected_this_month),
            "total_paid_lifetime": _format_amt(total_paid_lifetime),
            "pending_count": invoices.filter(status=RoyaltyInvoice.Status.PENDING).count(),
            "total_invoices_count": invoices.count(),
        })
