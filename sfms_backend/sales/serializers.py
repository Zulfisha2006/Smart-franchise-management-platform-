from rest_framework import serializers
from .models import Sale


class SaleSerializer(serializers.ModelSerializer):
    outlet_name = serializers.CharField(source="outlet.outlet_name", read_only=True)

    class Meta:
        model = Sale
        fields = ["id", "outlet", "outlet_name", "date", "amount", "note", "created_at"]
        read_only_fields = ["outlet", "created_at"]

    def validate_date(self, value):
        from django.utils import timezone
        if value > timezone.localdate():
            raise serializers.ValidationError("Cannot log sales for a future date.")
        return value

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Sales amount must be greater than zero.")
        return value
