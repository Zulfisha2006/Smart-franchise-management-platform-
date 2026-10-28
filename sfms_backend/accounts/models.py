from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from datetime import timedelta
import random


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        FRANCHISE_OWNER = "franchise_owner", "Franchise Owner"
        STAFF = "staff", "Staff"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.FRANCHISE_OWNER)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    is_verified = models.BooleanField(default=False)  # blocks login until email OTP is confirmed

    def save(self, *args, **kwargs):
        # Admin accounts are created directly by you via the terminal (create_superuser),
        # not through the public OTP registration flow - so they're auto-verified.
        if self.is_superuser:
            self.is_verified = True
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.role})"


class OTPCode(models.Model):
    """
    Stores a one-time email verification code for a user.
    A new registration (or a 'resend' request) creates a fresh row here.
    Old, unused codes are simply ignored once expired - we don't delete them,
    since keeping a trail is harmless and simpler.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otp_codes")
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    @staticmethod
    def generate_for(user):
        code = f"{random.randint(0, 999999):06d}"  # always 6 digits, zero-padded
        return OTPCode.objects.create(
            user=user,
            code=code,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

    def is_valid(self):
        return (not self.is_used) and timezone.now() <= self.expires_at

    def __str__(self):
        return f"OTP for {self.user.username} ({'used' if self.is_used else 'active'})"


class Outlet(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name="outlet",
                                  limit_choices_to={"role": User.Role.FRANCHISE_OWNER})
    outlet_name = models.CharField(max_length=150)
    city = models.CharField(max_length=100)
    address = models.TextField(blank=True)
    license_document = models.FileField(upload_to="outlet_documents/", blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    royalty_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=5.00)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.outlet_name} - {self.city} ({self.status})"
