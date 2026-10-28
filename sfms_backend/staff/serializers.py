from rest_framework import serializers
from .models import Employee


class EmployeeSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    shift_display = serializers.CharField(source="get_shift_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    compliance_status = serializers.ReadOnlyField()
    days_until_expiry = serializers.ReadOnlyField()
    outlet_name = serializers.CharField(source="outlet.outlet_name", read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "outlet",
            "outlet_name",
            "full_name",
            "role",
            "role_display",
            "phone",
            "email",
            "emergency_contact",
            "date_joined",
            "status",
            "status_display",
            "shift",
            "shift_display",
            "is_on_duty_today",
            "monthly_salary",
            "payroll_status",
            "last_paid_at",
            "certificate_name",
            "certificate_number",
            "certificate_expiry",
            "compliance_status",
            "days_until_expiry",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "outlet",
            "outlet_name",
            "created_at",
            "updated_at",
            "compliance_status",
            "days_until_expiry",
        ]


class EmployeeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = [
            "full_name",
            "role",
            "phone",
            "email",
            "emergency_contact",
            "date_joined",
            "status",
            "shift",
            "is_on_duty_today",
            "monthly_salary",
            "certificate_name",
            "certificate_number",
            "certificate_expiry",
        ]
