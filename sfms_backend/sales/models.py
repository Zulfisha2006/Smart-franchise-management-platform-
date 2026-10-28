from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from accounts.models import Outlet


class Sale(models.Model):
    """
    One row = one day's total sales for one outlet.
    We enforce ONE entry per outlet per date (unique_together) so an owner
    can't accidentally submit the same day twice.
    """
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name="sales")
    date = models.DateField(default=timezone.localdate)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    note = models.CharField(max_length=200, blank=True)  # optional: "Festival weekend", etc.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("outlet", "date")  # one entry per outlet per day
        ordering = ["-date"]

    def clean(self):
        # Prevent logging sales for a future date
        if self.date > timezone.localdate():
            raise ValidationError("Cannot log sales for a future date.")

    def __str__(self):
        return f"{self.outlet.outlet_name} - {self.date} - ₹{self.amount}"
