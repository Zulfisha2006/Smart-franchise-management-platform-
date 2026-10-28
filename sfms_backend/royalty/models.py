import calendar
from django.db import models
from django.utils import timezone
from accounts.models import Outlet


class RoyaltyInvoice(models.Model):
    """
    Monthly royalty invoice generated for an approved outlet.
    Stores snapshot values of sales and royalty rate at the time of generation.
    """
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"

    outlet = models.ForeignKey(
        Outlet,
        on_delete=models.CASCADE,
        related_name="royalty_invoices",
    )
    month = models.PositiveSmallIntegerField(help_text="Month number (1-12)")
    year = models.PositiveSmallIntegerField(help_text="Year (e.g. 2026)")
    total_sales = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Snapshot of total outlet sales in this month",
    )
    royalty_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Snapshot of royalty % at generation time",
    )
    amount_due = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Calculated royalty amount due (total_sales * royalty_percentage / 100)",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("outlet", "month", "year")
        ordering = ["-year", "-month", "-created_at"]

    @property
    def period_name(self):
        """Returns readable period e.g. 'August 2026'."""
        try:
            month_name = calendar.month_name[self.month]
            return f"{month_name} {self.year}"
        except (IndexError, TypeError):
            return f"{self.month}/{self.year}"

    def mark_as_paid(self):
        """Transitions status to paid and records timestamp."""
        if self.status == self.Status.PAID:
            raise ValueError("Invoice is already marked as paid.")
        self.status = self.Status.PAID
        self.paid_at = timezone.now()
        self.save(update_fields=["status", "paid_at", "updated_at"])

    def __str__(self):
        return f"{self.outlet.outlet_name} - {self.period_name} - ₹{self.amount_due} ({self.status})"
