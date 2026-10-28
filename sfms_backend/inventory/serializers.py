from rest_framework import serializers
from .models import StockItem, RestockRequest


class StockItemSerializer(serializers.ModelSerializer):
    outlet_name = serializers.CharField(source="outlet.outlet_name", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    depletion_advisory = serializers.SerializerMethodField()
    days_until_depletion = serializers.SerializerMethodField()
    suggested_restock_qty = serializers.SerializerMethodField()

    class Meta:
        model = StockItem
        fields = [
            "id", "outlet", "outlet_name", "name", "unit",
            "current_quantity", "low_stock_threshold", "restock_batch_qty",
            "is_low_stock", "depletion_advisory", "days_until_depletion",
            "suggested_restock_qty", "updated_at",
        ]
        read_only_fields = ["outlet", "updated_at", "depletion_advisory", "days_until_depletion", "suggested_restock_qty"]

    def _get_analysis(self, obj):
        if not hasattr(obj, "_cached_analysis"):
            from .predictor import InventoryDepletionPredictor
            from django.utils import timezone
            try:
                predictor = InventoryDepletionPredictor(obj.outlet)
                obj._cached_analysis = predictor._analyse_item(obj, timezone.localdate())
            except Exception:
                obj._cached_analysis = None
        return obj._cached_analysis

    def get_depletion_advisory(self, obj):
        ana = self._get_analysis(obj)
        return ana.get("advisory", "") if ana else ""

    def get_days_until_depletion(self, obj):
        ana = self._get_analysis(obj)
        return ana.get("days_until_depletion") if ana else None

    def get_suggested_restock_qty(self, obj):
        ana = self._get_analysis(obj)
        return ana.get("suggested_restock_qty", 0) if ana else 0

    def validate_current_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Quantity cannot be negative.")
        return value

    def validate_low_stock_threshold(self, value):
        if value < 0:
            raise serializers.ValidationError("Threshold cannot be negative.")
        return value


class StockAdjustSerializer(serializers.Serializer):
    """Used for the +/- quick-adjust action, not full item edits."""
    change = serializers.DecimalField(max_digits=10, decimal_places=2)  # e.g. +5 or -3

    def validate_change(self, value):
        if value == 0:
            raise serializers.ValidationError("Change must not be zero.")
        return value


class RestockRequestSerializer(serializers.ModelSerializer):
    stock_item_name = serializers.CharField(source="stock_item.name", read_only=True)
    stock_item_unit = serializers.CharField(source="stock_item.unit", read_only=True)
    outlet_name = serializers.CharField(source="outlet.outlet_name", read_only=True)
    outlet_city = serializers.CharField(source="outlet.city", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = RestockRequest
        fields = [
            "id", "outlet", "outlet_name", "outlet_city",
            "stock_item", "stock_item_name", "stock_item_unit",
            "requested_qty", "note", "admin_note",
            "status", "status_display",
            "requested_at", "updated_at",
        ]
        read_only_fields = [
            "outlet", "status", "admin_note",
            "requested_at", "updated_at",
        ]

    def validate_requested_qty(self, value):
        if value <= 0:
            raise serializers.ValidationError("Requested quantity must be greater than zero.")
        return value


class RestockRequestUpdateSerializer(serializers.ModelSerializer):
    """Used exclusively by Admin to update status and write a reply note."""

    class Meta:
        model = RestockRequest
        fields = ["status", "admin_note"]

    def validate_status(self, value):
        allowed = [
            RestockRequest.Status.APPROVED,
            RestockRequest.Status.REJECTED,
            RestockRequest.Status.FULFILLED,
        ]
        if value not in allowed:
            raise serializers.ValidationError(
                "Status must be one of: approved, rejected, fulfilled."
            )
        return value
