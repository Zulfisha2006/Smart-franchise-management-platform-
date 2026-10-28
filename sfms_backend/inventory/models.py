from django.db import models
from accounts.models import Outlet


class StockItem(models.Model):
    """
    One row = one stock item tracked by an outlet (e.g. "Burger Buns").
    low_stock_threshold defines the point at which this item should be
    flagged as running low, so owners get warned before it runs out.
    """

    class Unit(models.TextChoices):
        KG = "kg", "Kilograms"
        LITRE = "litre", "Litres"
        PIECES = "pieces", "Pieces"
        PACKS = "packs", "Packs"

    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name="stock_items")
    name = models.CharField(max_length=120)
    unit = models.CharField(max_length=10, choices=Unit.choices, default=Unit.PIECES)
    current_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    low_stock_threshold = models.DecimalField(max_digits=10, decimal_places=2, default=10)
    restock_batch_qty = models.DecimalField(max_digits=10, decimal_places=2, default=50, help_text="Standard delivery batch size dispatched by HQ Admin")
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("outlet", "name")  # no duplicate item names within one outlet
        ordering = ["name"]

    @property
    def is_low_stock(self):
        return self.current_quantity <= self.low_stock_threshold

    def __str__(self):
        return f"{self.outlet.outlet_name} - {self.name} ({self.current_quantity} {self.unit})"


class RestockRequest(models.Model):
    """
    A franchise owner requests a restock for a specific stock item.
    Admin can approve, reject, or mark it fulfilled.
    When fulfilled, current_quantity is auto-bumped by requested_qty.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        FULFILLED = "fulfilled", "Fulfilled"

    outlet = models.ForeignKey(
        Outlet,
        on_delete=models.CASCADE,
        related_name="restock_requests",
    )
    stock_item = models.ForeignKey(
        StockItem,
        on_delete=models.CASCADE,
        related_name="restock_requests",
    )
    requested_qty = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="How much the owner needs",
    )
    note = models.TextField(
        blank=True,
        default="",
        help_text="Optional note from the franchise owner",
    )
    admin_note = models.TextField(
        blank=True,
        default="",
        help_text="Optional reply/reason from admin",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-requested_at"]

    def __str__(self):
        return (
            f"[{self.status.upper()}] {self.outlet.outlet_name} — "
            f"{self.stock_item.name} x{self.requested_qty}"
        )


class StockConsumptionLog(models.Model):
    """
    Records every stock drawdown (negative adjustment).
    Used by the AI depletion predictor to calculate consumption velocity
    and project when items will run out.
    """

    stock_item = models.ForeignKey(
        StockItem,
        on_delete=models.CASCADE,
        related_name="consumption_logs",
    )
    quantity_change = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Absolute quantity consumed (always positive in storage)",
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-recorded_at"]

    def __str__(self):
        return f"{self.stock_item.name} consumed {self.quantity_change} at {self.recorded_at}"
