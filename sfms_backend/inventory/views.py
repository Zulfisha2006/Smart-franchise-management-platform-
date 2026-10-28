from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import IntegrityError

from accounts.models import Outlet, User
from .models import StockItem, RestockRequest, StockConsumptionLog
from .serializers import (
    StockItemSerializer,
    StockAdjustSerializer,
    RestockRequestSerializer,
    RestockRequestUpdateSerializer,
)
from .predictor import InventoryDepletionPredictor, get_network_depletion_report


class IsApprovedFranchiseOwner(permissions.BasePermission):
    """Only a Franchise Owner with an APPROVED outlet can manage inventory."""
    def has_permission(self, request, view):
        user = request.user
        if not (user.is_authenticated and user.role == User.Role.FRANCHISE_OWNER):
            return False
        return Outlet.objects.filter(owner=user, status=Outlet.Status.APPROVED).exists()


class IsAdmin(permissions.BasePermission):
    """Only HQ Admin users."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.role == User.Role.ADMIN or request.user.is_superuser
        )


# ─── Existing Stock Item Views ─────────────────────────────────────────────────

class StockItemCreateView(generics.CreateAPIView):
    """POST /api/inventory/create/ - owner adds a new stock item to their outlet."""
    serializer_class = StockItemSerializer
    permission_classes = [IsApprovedFranchiseOwner]

    def create(self, request, *args, **kwargs):
        outlet = Outlet.objects.get(owner=request.user, status=Outlet.Status.APPROVED)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save(outlet=outlet)
        except IntegrityError:
            return Response(
                {"name": ["You already have an item with this name."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class StockItemListView(generics.ListAPIView):
    """
    GET /api/inventory/
    Owner -> sees only their own outlet's items.
    Admin -> sees all items; optionally filter with ?outlet=<id>
    """
    serializer_class = StockItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.ADMIN:
            qs = StockItem.objects.all()
            outlet_id = self.request.query_params.get("outlet")
            if outlet_id:
                qs = qs.filter(outlet_id=outlet_id)
            return qs
        return StockItem.objects.filter(outlet__owner=user)


class StockAdjustView(APIView):
    """
    PATCH /api/inventory/<id>/adjust/
    Franchise Owner can ONLY log consumption / usage (change < 0).
    HQ Admin can perform arbitrary stock level adjustments.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        user = request.user
        if user.role == User.Role.ADMIN:
            try:
                item = StockItem.objects.get(pk=pk)
            except StockItem.DoesNotExist:
                return Response({"detail": "Item not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            try:
                item = StockItem.objects.get(pk=pk, outlet__owner=user)
            except StockItem.DoesNotExist:
                return Response({"detail": "Item not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = StockAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change = serializer.validated_data["change"]

        new_quantity = item.current_quantity + change
        if new_quantity < 0:
            return Response(
                {"detail": "Cannot reduce below zero stock."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        item.current_quantity = new_quantity
        item.save()

        # Log consumption for depletion prediction (only negative adjustments)
        if change < 0:
            StockConsumptionLog.objects.create(
                stock_item=item,
                quantity_change=abs(change),
            )

        return Response(StockItemSerializer(item).data)


class AdminStockDeliverView(APIView):
    """
    POST /api/inventory/<id>/deliver/
    HQ Admin delivers stock supplies directly to a franchise outlet.
    Body: {"quantity": 50} (optional; defaults to item.restock_batch_qty or 50)
    """
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from decimal import Decimal
        try:
            item = StockItem.objects.get(pk=pk)
        except StockItem.DoesNotExist:
            return Response({"detail": "Stock item not found."}, status=status.HTTP_404_NOT_FOUND)

        raw_qty = request.data.get("quantity")
        if raw_qty:
            try:
                delivery_qty = Decimal(str(raw_qty))
                if delivery_qty <= 0:
                    raise ValueError
            except (ValueError, TypeError):
                return Response({"detail": "Invalid delivery quantity."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            delivery_qty = item.restock_batch_qty or Decimal("50.0")

        item.current_quantity += delivery_qty
        item.save()

        # Auto-fulfill pending restock requests for this item
        RestockRequest.objects.filter(
            stock_item=item,
            status=RestockRequest.Status.PENDING,
        ).update(status=RestockRequest.Status.FULFILLED)

        return Response({
            "detail": f"Delivered {delivery_qty} {item.unit} to {item.outlet.outlet_name}.",
            "item": StockItemSerializer(item).data,
        }, status=status.HTTP_200_OK)


class LowStockView(generics.ListAPIView):
    """
    GET /api/inventory/low-stock/
    Owner -> their own low-stock items.
    Admin -> low-stock items across ALL outlets (network-wide alert panel).
    """
    serializer_class = StockItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.ADMIN:
            qs = StockItem.objects.all()
        else:
            qs = StockItem.objects.filter(outlet__owner=user)
        # Filter in Python since is_low_stock is a computed property, not a DB field
        return [item for item in qs if item.is_low_stock]


# ─── Restock Request Views ─────────────────────────────────────────────────────

class RestockRequestCreateView(generics.CreateAPIView):
    """
    POST /api/inventory/restock-requests/
    Franchise owner submits a restock request for one of their stock items.
    """
    serializer_class = RestockRequestSerializer
    permission_classes = [IsApprovedFranchiseOwner]

    def create(self, request, *args, **kwargs):
        outlet = Outlet.objects.get(owner=request.user, status=Outlet.Status.APPROVED)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Validate that the stock_item belongs to this owner's outlet
        stock_item = serializer.validated_data.get("stock_item")
        if stock_item.outlet != outlet:
            return Response(
                {"detail": "You can only request restock for your own outlet's items."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer.save(outlet=outlet)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RestockRequestListView(generics.ListAPIView):
    """
    GET /api/inventory/restock-requests/
    Owner -> sees only their outlet's requests.
    Admin -> sees all requests; optional ?outlet=<id> filter.
    """
    serializer_class = RestockRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.ADMIN:
            qs = RestockRequest.objects.select_related("outlet", "stock_item").all()
            outlet_id = self.request.query_params.get("outlet")
            if outlet_id:
                qs = qs.filter(outlet_id=outlet_id)
            return qs
        return RestockRequest.objects.select_related("outlet", "stock_item").filter(
            outlet__owner=user
        )


class RestockRequestUpdateView(APIView):
    """
    PATCH /api/inventory/restock-requests/<id>/update/
    Admin only — approve, reject, or fulfill a restock request.
    When fulfilled, the stock item's current_quantity is incremented automatically.
    """
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        try:
            req = RestockRequest.objects.select_related("stock_item").get(pk=pk)
        except RestockRequest.DoesNotExist:
            return Response({"detail": "Restock request not found."}, status=status.HTTP_404_NOT_FOUND)

        if req.status == RestockRequest.Status.FULFILLED:
            return Response(
                {"detail": "This request has already been fulfilled and cannot be changed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RestockRequestUpdateSerializer(req, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_req = serializer.save()

        # Auto-increment stock quantity when fulfilled
        if updated_req.status == RestockRequest.Status.FULFILLED:
            item = updated_req.stock_item
            item.current_quantity += updated_req.requested_qty
            item.save()

        return Response(RestockRequestSerializer(updated_req).data)


# ─── Inventory Depletion Prediction Views ──────────────────────────────────────

class InventoryDepletionView(APIView):
    """
    GET /api/inventory/depletion/
    Owner → depletion analysis for their own outlet.
    Admin → network-wide depletion report (or single outlet with ?outlet=<id>).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role == User.Role.ADMIN:
            outlet_id = request.query_params.get("outlet")
            if outlet_id:
                try:
                    outlet = Outlet.objects.get(pk=outlet_id)
                except Outlet.DoesNotExist:
                    return Response(
                        {"detail": "Outlet not found."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                predictor = InventoryDepletionPredictor(outlet)
                return Response(predictor.analyse())
            else:
                report = get_network_depletion_report()
                return Response(report)

        # Franchise owner
        try:
            outlet = Outlet.objects.get(
                owner=user, status=Outlet.Status.APPROVED
            )
        except Outlet.DoesNotExist:
            return Response(
                {"detail": "No approved outlet found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        predictor = InventoryDepletionPredictor(outlet)
        return Response(predictor.analyse())


class DraftRestockSubmitView(APIView):
    """
    POST /api/inventory/depletion/submit-restock/
    Converts an AI-generated draft restock suggestion into a real RestockRequest.
    Body: { stock_item: <id>, requested_qty: <qty>, note: "..." }
    """
    permission_classes = [IsApprovedFranchiseOwner]

    def post(self, request):
        outlet = Outlet.objects.get(
            owner=request.user, status=Outlet.Status.APPROVED
        )
        stock_item_id = request.data.get("stock_item")
        requested_qty = request.data.get("requested_qty")
        note = request.data.get("note", "")

        if not stock_item_id or not requested_qty:
            return Response(
                {"detail": "stock_item and requested_qty are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            stock_item = StockItem.objects.get(pk=stock_item_id, outlet=outlet)
        except StockItem.DoesNotExist:
            return Response(
                {"detail": "Stock item not found in your outlet."},
                status=status.HTTP_404_NOT_FOUND,
            )

        restock = RestockRequest.objects.create(
            outlet=outlet,
            stock_item=stock_item,
            requested_qty=requested_qty,
            note=note,
        )

        return Response(
            RestockRequestSerializer(restock).data,
            status=status.HTTP_201_CREATED,
        )
