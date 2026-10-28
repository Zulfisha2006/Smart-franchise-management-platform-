from django.db import models
from accounts.models import Outlet, User


class Announcement(models.Model):
    """
    HQ Admin broadcasts announcements visible to all Franchise Owners.
    """
    title = models.CharField(max_length=200)
    message = models.TextField()
    target_all = models.BooleanField(default=True)
    target_outlets = models.ManyToManyField(
        Outlet,
        blank=True,
        related_name="targeted_announcements",
    )
    attachment_pdf = models.FileField(
        upload_to="announcements/reports/",
        null=True,
        blank=True,
    )
    attachment_excel = models.FileField(
        upload_to="announcements/reports/",
        null=True,
        blank=True,
    )
    report_type = models.CharField(max_length=50, blank=True, default="")
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="announcements",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"


class SupportTicket(models.Model):
    """
    Franchise Owners raise support tickets for their outlet.
    Admins can view, update status, and write replies.
    """
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        RESOLVED = "resolved", "Resolved"

    outlet = models.ForeignKey(
        Outlet,
        on_delete=models.CASCADE,
        related_name="tickets",
    )
    subject = models.CharField(max_length=200)
    description = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )
    admin_reply = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.status.upper()}] {self.outlet.outlet_name}: {self.subject}"
