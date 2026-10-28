from datetime import timedelta
from django.db import models
from django.utils import timezone
from accounts.models import Outlet


class Employee(models.Model):
    class Role(models.TextChoices):
        HEAD_CHEF = "head_chef", "Head Chef"
        LINE_COOK = "line_cook", "Line Cook"
        KITCHEN_STAFF = "kitchen_staff", "Kitchen Staff"
        CASHIER = "cashier", "Cashier"
        BARISTA = "barista", "Barista"
        DELIVERY_RIDER = "delivery_rider", "Delivery Rider"
        FLOOR_MANAGER = "floor_manager", "Floor Manager"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ON_LEAVE = "on_leave", "On Leave"
        INACTIVE = "inactive", "Inactive"

    class Shift(models.TextChoices):
        MORNING = "morning", "Morning Shift (8 AM - 4 PM)"
        EVENING = "evening", "Evening Shift (4 PM - 12 AM)"
        FULL_DAY = "full_day", "Full Day (10 AM - 10 PM)"
        NIGHT = "night", "Night Shift (10 PM - 6 AM)"
        OFF = "off", "Off Duty"

    class PayrollStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"

    outlet = models.ForeignKey(
        Outlet,
        on_delete=models.CASCADE,
        related_name="employees",
    )
    full_name = models.CharField(max_length=150)
    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.KITCHEN_STAFF,
    )
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    emergency_contact = models.CharField(max_length=20, blank=True, null=True)
    date_joined = models.DateField(default=timezone.localdate)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    # Shift & Daily Attendance
    shift = models.CharField(
        max_length=20,
        choices=Shift.choices,
        default=Shift.MORNING,
    )
    is_on_duty_today = models.BooleanField(default=True)

    # Compensation & Payroll
    monthly_salary = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=15000.00,
    )
    payroll_status = models.CharField(
        max_length=20,
        choices=PayrollStatus.choices,
        default=PayrollStatus.PENDING,
    )
    last_paid_at = models.DateTimeField(blank=True, null=True)

    # Food Safety & Health Compliance
    certificate_name = models.CharField(
        max_length=150,
        default="Food Handler Health Fitness Card",
        blank=True,
    )
    certificate_number = models.CharField(max_length=50, blank=True, null=True)
    certificate_expiry = models.DateField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_on_duty_today", "role", "full_name"]

    def __str__(self):
        return f"{self.full_name} ({self.get_role_display()}) - {self.outlet.outlet_name}"

    @property
    def compliance_status(self):
        """
        Returns 'valid', 'expiring_soon', or 'expired'.
        'expiring_soon' is within 30 days.
        """
        if not self.certificate_expiry:
            return "not_submitted"
        today = timezone.localdate()
        if self.certificate_expiry < today:
            return "expired"
        elif self.certificate_expiry <= today + timedelta(days=30):
            return "expiring_soon"
        return "valid"

    @property
    def days_until_expiry(self):
        if not self.certificate_expiry:
            return None
        return (self.certificate_expiry - timezone.localdate()).days
