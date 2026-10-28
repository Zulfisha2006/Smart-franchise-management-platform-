from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import Outlet, OTPCode

User = get_user_model()


class AccountsAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_user_registration_creates_unverified_user_and_otp(self):
        data = {
            "username": "testowner",
            "email": "testowner@example.com",
            "password": "Password123!",
            "phone_number": "9876543210",
        }
        res = self.client.post("/api/register/", data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username="testowner")
        self.assertFalse(user.is_verified)
        self.assertEqual(user.role, User.Role.FRANCHISE_OWNER)

        otp = OTPCode.objects.filter(user=user).first()
        self.assertIsNotNone(otp)
        self.assertEqual(len(otp.code), 6)

    def test_login_blocked_for_unverified_user(self):
        user = User.objects.create_user(
            username="unverified_user",
            email="unv@example.com",
            password="Password123!",
            is_verified=False,
        )
        res = self.client.post("/api/login/", {"username": "unverified_user", "password": "Password123!"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", res.data)

    def test_otp_verification_flow(self):
        user = User.objects.create_user(
            username="verify_me",
            email="ver@example.com",
            password="Password123!",
            is_verified=False,
        )
        otp = OTPCode.generate_for(user)

        # Invalid code
        res = self.client.post("/api/verify-otp/", {"username": "verify_me", "code": "000000"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Correct code
        res = self.client.post("/api/verify-otp/", {"username": "verify_me", "code": otp.code})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        user.refresh_from_db()
        self.assertTrue(user.is_verified)

        # Now login succeeds
        res_login = self.client.post("/api/login/", {"username": "verify_me", "password": "Password123!"})
        self.assertEqual(res_login.status_code, status.HTTP_200_OK)
        self.assertIn("access", res_login.data)


class OutletManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username="adminuser",
            email="admin@example.com",
            password="AdminPassword123!",
            role=User.Role.ADMIN,
        )
        self.owner = User.objects.create_user(
            username="owneruser",
            email="owner@example.com",
            password="OwnerPassword123!",
            role=User.Role.FRANCHISE_OWNER,
            is_verified=True,
        )

    def test_outlet_create_and_approval_flow(self):
        self.client.force_authenticate(user=self.owner)
        outlet_data = {
            "outlet_name": "Test Franchise Central",
            "city": "Mumbai",
            "address": "123 Main Road",
        }
        res = self.client.post("/api/outlets/create/", outlet_data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        outlet_id = res.data["id"]

        outlet = Outlet.objects.get(id=outlet_id)
        self.assertEqual(outlet.status, Outlet.Status.PENDING)

        # Admin approves outlet
        self.client.force_authenticate(user=self.admin)
        res_approve = self.client.patch(f"/api/outlets/{outlet_id}/approve/", {"status": "approved"})
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)

        outlet.refresh_from_db()
        self.assertEqual(outlet.status, Outlet.Status.APPROVED)

    def test_admin_can_delete_outlet(self):
        outlet = Outlet.objects.create(
            owner=self.owner,
            outlet_name="Outlet To Delete",
            city="Pune",
            status=Outlet.Status.APPROVED,
        )
        self.client.force_authenticate(user=self.admin)
        res = self.client.delete(f"/api/outlets/{outlet.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(Outlet.objects.filter(id=outlet.id).exists())

    def test_franchise_owner_cannot_delete_outlet(self):
        outlet = Outlet.objects.create(
            owner=self.owner,
            outlet_name="Owner Outlet",
            city="Jaipur",
            status=Outlet.Status.APPROVED,
        )
        self.client.force_authenticate(user=self.owner)
        res = self.client.delete(f"/api/outlets/{outlet.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Outlet.objects.filter(id=outlet.id).exists())
