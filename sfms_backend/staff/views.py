from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Outlet, User
from sales.models import Sale
from .models import Employee
from .serializers import EmployeeSerializer, EmployeeCreateSerializer


class IsApprovedFranchiseOwner(permissions.BasePermission):
    """Allows access only to Franchise Owners with an APPROVED outlet."""
    def has_permission(self, request, view):
        user = request.user
        if not (user.is_authenticated and user.role == User.Role.FRANCHISE_OWNER):
            return False
        return Outlet.objects.filter(owner=user, status=Outlet.Status.APPROVED).exists()


class EmployeeListView(generics.ListAPIView):
    """
    GET /api/staff/
    Franchise Owner -> sees only their own outlet's staff.
    Admin -> sees all staff, or filters by ?outlet=<id>.
    """
    serializer_class = EmployeeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.ADMIN or user.is_superuser:
            outlet_id = self.request.query_params.get("outlet")
            if outlet_id:
                return Employee.objects.filter(outlet_id=outlet_id)
            return Employee.objects.all()
        try:
            outlet = Outlet.objects.get(owner=user, status=Outlet.Status.APPROVED)
            return Employee.objects.filter(outlet=outlet)
        except Outlet.DoesNotExist:
            return Employee.objects.none()


class EmployeeCreateView(generics.CreateAPIView):
    """
    POST /api/staff/create/
    Franchise Owner adds a new employee to their approved outlet.
    """
    serializer_class = EmployeeCreateSerializer
    permission_classes = [IsApprovedFranchiseOwner]

    def perform_create(self, serializer):
        outlet = Outlet.objects.get(
            owner=self.request.user, status=Outlet.Status.APPROVED
        )
        serializer.save(outlet=outlet)


class EmployeeUpdateView(generics.UpdateAPIView):
    """
    PATCH /api/staff/<int:pk>/update/
    Franchise owner updates employee details, shift, duty status, or marks payroll paid.
    """
    serializer_class = EmployeeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.ADMIN or user.is_superuser:
            return Employee.objects.all()
        return Employee.objects.filter(outlet__owner=user)

    def perform_update(self, serializer):
        instance = serializer.instance
        new_payroll_status = self.request.data.get("payroll_status")
        if new_payroll_status == Employee.PayrollStatus.PAID and instance.payroll_status != Employee.PayrollStatus.PAID:
            serializer.save(last_paid_at=timezone.now())
        else:
            serializer.save()


class EmployeeDeleteView(generics.DestroyAPIView):
    """
    DELETE /api/staff/<int:pk>/
    Franchise owner deletes an employee record from their outlet.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.ADMIN or user.is_superuser:
            return Employee.objects.all()
        return Employee.objects.filter(outlet__owner=user)


class StaffSummaryView(APIView):
    """
    GET /api/staff/summary/
    Returns high-level KPI metrics across the 4 key operational areas:
    1. Directory headcounts
    2. Daily Shift & Duty roster counts
    3. Monthly Payroll total & Labor Cost % of sales
    4. Compliance & Certificate expiry alerts
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == User.Role.ADMIN or user.is_superuser:
            outlet_id = request.query_params.get("outlet")
            if outlet_id:
                outlet = Outlet.objects.filter(id=outlet_id).first()
                employees = Employee.objects.filter(outlet=outlet)
            else:
                outlet = None
                employees = Employee.objects.all()
        else:
            outlet = Outlet.objects.filter(
                owner=user, status=Outlet.Status.APPROVED
            ).first()
            if not outlet:
                return Response({
                    "total_staff": 0,
                    "on_duty_today": 0,
                    "total_payroll": 0.0,
                    "pending_payroll": 0.0,
                    "labor_cost_pct": 0.0,
                    "compliance_alerts": 0,
                    "shift_breakdown": {},
                })
            employees = Employee.objects.filter(outlet=outlet)

        total_staff = employees.count()
        active_staff = employees.filter(status=Employee.Status.ACTIVE)
        on_duty_today = employees.filter(is_on_duty_today=True, status=Employee.Status.ACTIVE).count()

        # Shift breakdown
        shift_breakdown = {
            "morning": employees.filter(shift=Employee.Shift.MORNING, is_on_duty_today=True).count(),
            "evening": employees.filter(shift=Employee.Shift.EVENING, is_on_duty_today=True).count(),
            "full_day": employees.filter(shift=Employee.Shift.FULL_DAY, is_on_duty_today=True).count(),
            "night": employees.filter(shift=Employee.Shift.NIGHT, is_on_duty_today=True).count(),
            "off": employees.filter(is_on_duty_today=False).count(),
        }

        # Payroll
        total_payroll = float(active_staff.aggregate(t=Sum("monthly_salary"))["t"] or 0)
        pending_payroll = float(
            active_staff.filter(payroll_status=Employee.PayrollStatus.PENDING)
            .aggregate(t=Sum("monthly_salary"))["t"] or 0
        )
        paid_payroll = total_payroll - pending_payroll

        # Sales & Labor Cost Ratio (Current Month)
        today = timezone.localdate()
        month_start = today.replace(day=1)
        if outlet:
            sales_qs = Sale.objects.filter(outlet=outlet, date__gte=month_start)
        else:
            sales_qs = Sale.objects.filter(date__gte=month_start)

        current_month_sales = float(sales_qs.aggregate(t=Sum("amount"))["t"] or 0)
        if current_month_sales > 0:
            labor_cost_pct = round((total_payroll / current_month_sales) * 100, 1)
        else:
            labor_cost_pct = 0.0

        # Compliance alerts
        compliance_alerts = 0
        expiring_employees = []
        for emp in active_staff:
            status_val = emp.compliance_status
            if status_val in ("expired", "expiring_soon"):
                compliance_alerts += 1
                expiring_employees.append({
                    "id": emp.id,
                    "full_name": emp.full_name,
                    "role_display": emp.get_role_display(),
                    "certificate_name": emp.certificate_name,
                    "certificate_expiry": emp.certificate_expiry,
                    "compliance_status": status_val,
                    "days_until_expiry": emp.days_until_expiry,
                })

        return Response({
            "total_staff": total_staff,
            "on_duty_today": on_duty_today,
            "active_staff_count": active_staff.count(),
            "total_payroll": round(total_payroll, 2),
            "pending_payroll": round(pending_payroll, 2),
            "paid_payroll": round(paid_payroll, 2),
            "current_month_sales": round(current_month_sales, 2),
            "labor_cost_pct": labor_cost_pct,
            "compliance_alerts": compliance_alerts,
            "shift_breakdown": shift_breakdown,
            "expiring_employees": expiring_employees,
        })
