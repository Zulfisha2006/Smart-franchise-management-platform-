from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import Outlet, OTPCode
from .serializers import RegisterSerializer, UserSerializer, OutletSerializer
from .email_utils import send_otp_email

User = get_user_model()


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN)


class RegisterView(generics.CreateAPIView):
    """
    POST /api/register/
    Creates the account as UNVERIFIED, generates an OTP, and emails it.
    The user cannot log in until they verify via /api/verify-otp/.
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()  # is_verified defaults to False

        otp = OTPCode.generate_for(user)
        try:
            send_otp_email(user, otp)
        except Exception as e:
            from django.conf import settings
            has_credentials = bool(getattr(settings, "GMAIL_ADDRESS", "") and getattr(settings, "GMAIL_APP_PASSWORD", ""))
            warning_msg = (
                "Account created, but verification email could not be sent. Check your Gmail configuration."
                if has_credentials
                else "Email credentials not yet set in Render. The OTP code was printed in Render logs."
            )
            return Response(
                {
                    **serializer.data,
                    "email_warning": warning_msg,
                    "dev_otp": otp.code if not has_credentials else None,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class VerifyOtpView(APIView):
    """
    POST /api/verify-otp/
    Body: {"username": "...", "code": "123456"}
    Marks the user as verified if the code matches and hasn't expired.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        code = (request.data.get("code") or "").strip()

        if not username or not code:
            return Response({"detail": "Please provide both username/email and verification code."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(username__iexact=username).first()
        if not user:
            user = User.objects.filter(email__iexact=username).first()

        if not user:
            return Response({"detail": "User not found. Please register first."}, status=status.HTTP_404_NOT_FOUND)

        if user.is_verified:
            return Response({"detail": "Account is already verified. You can now log in."})

        otp = OTPCode.objects.filter(user=user, code=code).order_by("-created_at").first()

        if not otp or not otp.is_valid():
            return Response({"detail": "Invalid or expired verification code. Please check or click 'Resend OTP'."}, status=status.HTTP_400_BAD_REQUEST)

        otp.is_used = True
        otp.save()
        user.is_verified = True
        user.save(update_fields=["is_verified"])

        return Response({"detail": "Account verified successfully. You can now log in."})


class ResendOtpView(APIView):
    """
    POST /api/resend-otp/
    Body: {"username": "..."}
    Generates a fresh code and emails it again - used if the first one
    expired or never arrived.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        if not username:
            return Response({"detail": "Please provide your username or email."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(username__iexact=username).first()
        if not user:
            user = User.objects.filter(email__iexact=username).first()

        if not user:
            return Response({"detail": "User not found. Please register first."}, status=status.HTTP_404_NOT_FOUND)

        if user.is_verified:
            return Response({"detail": "Account is already verified. You can log in directly."})

        otp = OTPCode.generate_for(user)
        try:
            send_otp_email(user, otp)
        except Exception:
            from django.conf import settings
            has_credentials = bool(getattr(settings, "GMAIL_ADDRESS", "") and getattr(settings, "GMAIL_APP_PASSWORD", ""))
            detail_msg = (
                "Could not send verification email. Please check server configuration."
                if has_credentials
                else f"GMAIL credentials not set in Render. Check Render logs, or use code: {otp.code}"
            )
            return Response(
                {
                    "detail": detail_msg,
                    "dev_otp": otp.code if not has_credentials else None,
                },
                status=status.HTTP_200_OK if not has_credentials else status.HTTP_502_BAD_GATEWAY,
            )

        return Response({"detail": "A new verification code has been sent to your email."})


class ProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class OutletCreateView(generics.CreateAPIView):
    serializer_class = OutletSerializer
    permission_classes = [permissions.IsAuthenticated]
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class OutletListView(generics.ListAPIView):
    serializer_class = OutletSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.ADMIN:
            return Outlet.objects.all().order_by("-created_at")
        return Outlet.objects.filter(owner=user)


class OutletApproveView(APIView):
    permission_classes = [IsAdmin]
    def patch(self, request, pk):
        try:
            outlet = Outlet.objects.get(pk=pk)
        except Outlet.DoesNotExist:
            return Response({"error": "Outlet not found"}, status=status.HTTP_404_NOT_FOUND)
        new_status = request.data.get("status")
        if new_status not in [Outlet.Status.APPROVED, Outlet.Status.REJECTED]:
            return Response({"error": "invalid status"}, status=status.HTTP_400_BAD_REQUEST)
        outlet.status = new_status
        outlet.save()
        return Response(OutletSerializer(outlet).data)


class OutletDeleteView(APIView):
    """
    DELETE /api/outlets/<pk>/
    Only accessible by Admin. Deletes the outlet and cascades to its sales, inventory, and invoices.
    """
    permission_classes = [IsAdmin]

    def delete(self, request, pk):
        try:
            outlet = Outlet.objects.get(pk=pk)
        except Outlet.DoesNotExist:
            return Response({"error": "Outlet not found"}, status=status.HTTP_404_NOT_FOUND)

        outlet_name = outlet.outlet_name
        outlet.delete()
        return Response(
            {"detail": f"Outlet '{outlet_name}' has been successfully removed."},
            status=status.HTTP_200_OK,
        )
