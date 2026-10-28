import calendar
from rest_framework import serializers
from .models import RoyaltyInvoice


class RoyaltyInvoiceSerializer(serializers.ModelSerializer):
    outlet_name = serializers.CharField(source="outlet.outlet_name", read_only=True)
    city = serializers.CharField(source="outlet.city", read_only=True)
    period_name = serializers.CharField(read_only=True)
    month_name = serializers.SerializerMethodField()

    class Meta:
        model = RoyaltyInvoice
        fields = [
            "id",
            "outlet",
            "outlet_name",
            "city",
            "month",
            "year",
            "period_name",
            "month_name",
            "total_sales",
            "royalty_percentage",
            "amount_due",
            "status",
            "paid_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "outlet",
            "outlet_name",
            "city",
            "period_name",
            "month_name",
            "total_sales",
            "royalty_percentage",
            "amount_due",
            "status",
            "paid_at",
            "created_at",
            "updated_at",
        ]

    def get_month_name(self, obj):
        try:
            return calendar.month_name[obj.month]
        except (IndexError, TypeError):
            return str(obj.month)
