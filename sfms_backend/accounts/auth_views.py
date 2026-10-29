from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


class VerifiedTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Enhanced authentication serializer:
    - Supports case-insensitive username matching (e.g. Zulfishaa or zulfishaa)
    - Supports logging in via either username OR email address
    - Automatically trims accidental whitespace
    - Verifies that the account is email-verified and active
    - Automatically verifies superusers and admin accounts
    """
    def validate(self, attrs):
        raw_login = attrs.get(self.username_field, "").strip()
        password = attrs.get("password", "")

        if not raw_login or not password:
            raise serializers.ValidationError(
                {"detail": "Please provide both username and password."}
            )

        # 1. Match by case-insensitive username first
        user = User.objects.filter(username__iexact=raw_login).first()

        # 2. If not found by username, match by case-insensitive email
        if not user:
            candidates = User.objects.filter(email__iexact=raw_login)
            for candidate in candidates:
                if candidate.check_password(password):
                    user = candidate
                    break
            if not user and candidates.exists():
                user = candidates.first()

        if not user or not user.check_password(password):
            raise serializers.ValidationError(
                {"detail": "Invalid username or password. Please try again."}
            )

        if not user.is_active:
            raise serializers.ValidationError(
                {"detail": "This account is inactive. Please contact support."}
            )

        # Superusers and admins are auto-verified
        if user.is_superuser or user.role == User.Role.ADMIN:
            if not user.is_verified:
                user.is_verified = True
                user.save(update_fields=["is_verified"])

        if not user.is_verified:
            from .models import OTPCode
            from .email_utils import send_otp_email
            otp = OTPCode.generate_for(user)
            try:
                send_otp_email(user, otp)
            except Exception:
                pass

            raise serializers.ValidationError(
                {
                    "detail": f"Your account is not verified yet. We sent a 6-digit verification code to {user.email}.",
                    "needs_verification": True,
                    "username": user.username,
                    "email": user.email,
                }
            )

        self.user = user
        refresh = self.get_token(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


class VerifiedTokenObtainPairView(TokenObtainPairView):
    serializer_class = VerifiedTokenObtainPairSerializer
