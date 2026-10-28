from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    ProfileView,
    OutletCreateView,
    OutletListView,
    OutletApproveView,
    OutletDeleteView,
    VerifyOtpView,
    ResendOtpView,
)
from .auth_views import VerifiedTokenObtainPairView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-otp/", VerifyOtpView.as_view(), name="verify-otp"),
    path("resend-otp/", ResendOtpView.as_view(), name="resend-otp"),
    path("login/", VerifiedTokenObtainPairView.as_view(), name="login"),
    path("login/refresh/", TokenRefreshView.as_view(), name="login-refresh"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("outlets/", OutletListView.as_view(), name="outlet-list"),
    path("outlets/create/", OutletCreateView.as_view(), name="outlet-create"),
    path("outlets/<int:pk>/", OutletDeleteView.as_view(), name="outlet-detail"),
    path("outlets/<int:pk>/approve/", OutletApproveView.as_view(), name="outlet-approve"),
    path("outlets/<int:pk>/delete/", OutletDeleteView.as_view(), name="outlet-delete"),
]
