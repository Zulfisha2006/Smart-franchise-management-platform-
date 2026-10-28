from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User, Outlet
from sales.models import Sale


from unittest.mock import patch
from datetime import datetime
from zoneinfo import ZoneInfo

class SalesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="salesowner",
            email="salesowner@example.com",
            password="Password123!",
            role=User.Role.FRANCHISE_OWNER,
            is_verified=True,
        )
        self.outlet = Outlet.objects.create(
            owner=self.owner,
            outlet_name="QuickBite Sales Test",
            city="Delhi",
            status=Outlet.Status.APPROVED,
            royalty_percentage=Decimal("5.00"),
        )
        self.client.force_authenticate(user=self.owner)

    def test_sales_entry_blocked_before_9pm(self):
        """Entering sales before 21:00 IST is blocked with 403."""
        ist = ZoneInfo("Asia/Kolkata")
        morning_time = datetime(2026, 10, 5, 10, 30, tzinfo=ist)
        today_str = morning_time.date().isoformat()

        with patch("django.utils.timezone.localtime", return_value=morning_time):
            res = self.client.post("/api/sales/create/", {"amount": "15000.00", "note": "Morning attempt", "date": today_str})
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
            self.assertIn("9:00 PM IST", res.data["detail"])
            self.assertEqual(Sale.objects.filter(outlet=self.outlet).count(), 0)

    def test_sales_entry_allowed_after_9pm_and_locked_afterwards(self):
        """Entering sales after 21:00 IST succeeds; duplicate / update attempt on same day returns 409 locked."""
        ist = ZoneInfo("Asia/Kolkata")
        night_time = datetime(2026, 10, 5, 21, 15, tzinfo=ist)
        today_str = night_time.date().isoformat()

        with patch("django.utils.timezone.localtime", return_value=night_time), \
             patch("django.utils.timezone.localdate", return_value=night_time.date()):
            # 1. First submission after 9 PM succeeds
            res = self.client.post("/api/sales/create/", {"amount": "22000.00", "note": "Dinner rush", "date": today_str})
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            self.assertEqual(Sale.objects.filter(outlet=self.outlet).count(), 1)

            # 2. Re-submitting / updating on the same day is locked (409 Conflict)
            res_update = self.client.post("/api/sales/create/", {"amount": "25000.00", "note": "Try edit", "date": today_str})
            self.assertEqual(res_update.status_code, status.HTTP_409_CONFLICT)
            self.assertIn("locked", res_update.data["detail"].lower())

            # Original amount must remain intact (immutable)
            sale = Sale.objects.get(outlet=self.outlet, date=today_str)
            self.assertEqual(sale.amount, Decimal("22000.00"))

    def test_sales_summary(self):
        today = timezone.localdate()
        Sale.objects.create(outlet=self.outlet, date=today, amount=Decimal("25000.00"))
        res = self.client.get("/api/sales/summary/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["today_sales"], "25000.00")
        self.assertTrue(res.data["today_sale_locked"])

    def test_ai_sales_prediction_owner_cold_start(self):
        """Owner with 0 or sparse sales gets a graceful baseline prior forecast."""
        res = self.client.get("/api/sales/predict/?days=7")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["outlet_id"], self.outlet.id)
        self.assertEqual(len(res.data["forecast"]), 7)
        self.assertGreater(res.data["summary"]["projected_total"], 0)
        self.assertGreater(res.data["summary"]["projected_royalty"], 0)
        self.assertIn("Baseline Prior", res.data["summary"]["model_type"])

    def test_ai_sales_prediction_with_sales_history(self):
        """Owner with multi-week sales gets Scikit-Learn hybrid ensemble forecast with confidence bands."""
        from datetime import timedelta
        today = timezone.localdate()
        # Seed 15 days of sales
        for i in range(1, 16):
            dt = today - timedelta(days=i)
            dow = dt.weekday()
            mult = 1.3 if dow in (4, 5) else (0.85 if dow in (0, 1) else 1.0)
            Sale.objects.create(
                outlet=self.outlet,
                date=dt,
                amount=Decimal(str(round(20000.0 * mult, 2))),
                note=f"Day -{i} sales",
            )

        res = self.client.get("/api/sales/predict/?days=14")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data["forecast"]), 14)
        self.assertIn("Ensemble", res.data["summary"]["model_type"])
        self.assertGreaterEqual(res.data["summary"]["confidence_score"], 60.0)

        # Check confidence interval validity on all days
        for day in res.data["forecast"]:
            self.assertLessEqual(day["lower_bound"], day["predicted_amount"])
            self.assertGreaterEqual(day["upper_bound"], day["predicted_amount"])

        # Check insights generated
        self.assertGreater(len(res.data["insights"]), 0)

    def test_admin_network_sales_forecast_and_permissions(self):
        """Admin can access network forecast; Franchise Owner is blocked with 403."""
        # 1. Owner forbidden from network endpoint
        res_forbidden = self.client.get("/api/sales/network-forecast/")
        self.assertEqual(res_forbidden.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Authenticate as Admin
        admin = User.objects.create_superuser(
            username="adminhq",
            email="adminhq@example.com",
            password="Password123!",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(user=admin)

        # Create a second approved outlet
        owner2 = User.objects.create_user(
            username="owner2",
            email="owner2@example.com",
            password="Password123!",
            role=User.Role.FRANCHISE_OWNER,
            is_verified=True,
        )
        Outlet.objects.create(
            owner=owner2,
            outlet_name="QuickBite Amritsar",
            city="Amritsar",
            status=Outlet.Status.APPROVED,
            royalty_percentage=Decimal("6.00"),
        )

        res_admin = self.client.get("/api/sales/network-forecast/?days=7")
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(res_admin.data["outlets_count"], 2)
        self.assertGreater(res_admin.data["network_projected_total"], 0)
        self.assertGreater(res_admin.data["network_projected_royalty"], 0)
        self.assertEqual(len(res_admin.data["outlet_forecasts"]), 2)

        # 3. Admin can also drill down to a specific outlet prediction
        res_drill = self.client.get(f"/api/sales/predict/?outlet={self.outlet.id}&days=7")
        self.assertEqual(res_drill.status_code, status.HTTP_200_OK)
        self.assertEqual(res_drill.data["outlet_id"], self.outlet.id)
