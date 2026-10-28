from datetime import date
from decimal import Decimal
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Outlet, User
from sales.models import Sale
from royalty.models import RoyaltyInvoice


class RoyaltyModuleTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Admin
        self.admin_user = User.objects.create_superuser(
            username="admin_user",
            email="admin@chainhub.com",
            password="AdminPassword123!",
            role=User.Role.ADMIN,
        )

        # Create Franchise Owner 1
        self.owner1 = User.objects.create_user(
            username="owner1",
            email="owner1@chainhub.com",
            password="OwnerPassword123!",
            role=User.Role.FRANCHISE_OWNER,
            is_verified=True,
        )
        self.outlet1 = Outlet.objects.create(
            owner=self.owner1,
            outlet_name="QuickBite Central",
            city="Ludhiana",
            status=Outlet.Status.APPROVED,
            royalty_percentage=Decimal("5.00"),
        )

        # Create Franchise Owner 2
        self.owner2 = User.objects.create_user(
            username="owner2",
            email="owner2@chainhub.com",
            password="OwnerPassword123!",
            role=User.Role.FRANCHISE_OWNER,
            is_verified=True,
        )
        self.outlet2 = Outlet.objects.create(
            owner=self.owner2,
            outlet_name="QuickBite North",
            city="Chandigarh",
            status=Outlet.Status.APPROVED,
            royalty_percentage=Decimal("6.00"),
        )

        # Create unapproved owner
        self.pending_owner = User.objects.create_user(
            username="pending_owner",
            email="pending@chainhub.com",
            password="OwnerPassword123!",
            role=User.Role.FRANCHISE_OWNER,
            is_verified=True,
        )
        self.pending_outlet = Outlet.objects.create(
            owner=self.pending_owner,
            outlet_name="QuickBite South",
            city="Amritsar",
            status=Outlet.Status.PENDING,
            royalty_percentage=Decimal("5.00"),
        )

    def test_generate_royalty_invoices_command(self):
        """Test management command calculates sales and creates invoices properly."""
        # Create sales for outlet 1 in January 2026: 10,000 + 20,000 = 30,000
        Sale.objects.create(outlet=self.outlet1, date=date(2026, 1, 10), amount=Decimal("10000.00"))
        Sale.objects.create(outlet=self.outlet1, date=date(2026, 1, 15), amount=Decimal("20000.00"))

        # Create sales for outlet 2 in January 2026: 50,000
        Sale.objects.create(outlet=self.outlet2, date=date(2026, 1, 5), amount=Decimal("50000.00"))

        # Run command for Jan 2026
        call_command("generate_royalty_invoices", month=1, year=2026)

        # Verify outlet1 invoice: 30,000 * 5% = 1,500
        inv1 = RoyaltyInvoice.objects.get(outlet=self.outlet1, month=1, year=2026)
        self.assertEqual(inv1.total_sales, Decimal("30000.00"))
        self.assertEqual(inv1.royalty_percentage, Decimal("5.00"))
        self.assertEqual(inv1.amount_due, Decimal("1500.00"))
        self.assertEqual(inv1.status, RoyaltyInvoice.Status.PENDING)

        # Verify outlet2 invoice: 50,000 * 6% = 3,000
        inv2 = RoyaltyInvoice.objects.get(outlet=self.outlet2, month=1, year=2026)
        self.assertEqual(inv2.total_sales, Decimal("50000.00"))
        self.assertEqual(inv2.royalty_percentage, Decimal("6.00"))
        self.assertEqual(inv2.amount_due, Decimal("3000.00"))

        # Pending outlet should NOT get an invoice
        self.assertFalse(RoyaltyInvoice.objects.filter(outlet=self.pending_outlet).exists())

        # Safe re-run test: running command again should not duplicate
        call_command("generate_royalty_invoices", month=1, year=2026)
        self.assertEqual(RoyaltyInvoice.objects.filter(outlet=self.outlet1, month=1, year=2026).count(), 1)

    def test_royalty_invoice_list_view_permissions(self):
        """Owner only sees their own invoices; Admin sees all and can filter."""
        inv1 = RoyaltyInvoice.objects.create(
            outlet=self.outlet1, month=1, year=2026, total_sales=Decimal("10000.00"),
            royalty_percentage=Decimal("5.00"), amount_due=Decimal("500.00"),
        )
        inv2 = RoyaltyInvoice.objects.create(
            outlet=self.outlet2, month=1, year=2026, total_sales=Decimal("20000.00"),
            royalty_percentage=Decimal("6.00"), amount_due=Decimal("1200.00"),
        )

        # Owner 1 list
        self.client.force_authenticate(user=self.owner1)
        res = self.client.get("/api/royalty/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["id"], inv1.id)
        self.assertEqual(res.data[0]["outlet_name"], "QuickBite Central")

        # Admin list (sees both)
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get("/api/royalty/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)

        # Admin list filtered by outlet2
        res = self.client.get(f"/api/royalty/?outlet={self.outlet2.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["id"], inv2.id)

    def test_mark_as_paid_success(self):
        """Owner can mark their pending invoice as paid."""
        inv = RoyaltyInvoice.objects.create(
            outlet=self.outlet1, month=2, year=2026, total_sales=Decimal("10000.00"),
            royalty_percentage=Decimal("5.00"), amount_due=Decimal("500.00"),
            status=RoyaltyInvoice.Status.PENDING,
        )

        self.client.force_authenticate(user=self.owner1)
        res = self.client.patch(f"/api/royalty/{inv.id}/mark-paid/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], RoyaltyInvoice.Status.PAID)
        self.assertIsNotNone(res.data["paid_at"])

        inv.refresh_from_db()
        self.assertEqual(inv.status, RoyaltyInvoice.Status.PAID)
        self.assertIsNotNone(inv.paid_at)

    def test_mark_as_paid_already_paid_error(self):
        """Trying to mark an already-paid invoice returns 400 Bad Request."""
        inv = RoyaltyInvoice.objects.create(
            outlet=self.outlet1, month=2, year=2026, total_sales=Decimal("10000.00"),
            royalty_percentage=Decimal("5.00"), amount_due=Decimal("500.00"),
            status=RoyaltyInvoice.Status.PAID,
            paid_at=timezone.now(),
        )

        self.client.force_authenticate(user=self.owner1)
        res = self.client.patch(f"/api/royalty/{inv.id}/mark-paid/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already marked as paid", res.data["detail"])

    def test_mark_as_paid_unauthorized_other_outlet(self):
        """Owner 1 cannot mark Owner 2's invoice as paid (404/not found)."""
        inv = RoyaltyInvoice.objects.create(
            outlet=self.outlet2, month=2, year=2026, total_sales=Decimal("20000.00"),
            royalty_percentage=Decimal("6.00"), amount_due=Decimal("1200.00"),
            status=RoyaltyInvoice.Status.PENDING,
        )

        self.client.force_authenticate(user=self.owner1)
        res = self.client.patch(f"/api/royalty/{inv.id}/mark-paid/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_royalty_summary_views(self):
        """Summary view provides accurate aggregations for Owner and Admin."""
        today = timezone.localdate()
        # Outlet 1: 1 pending invoice of ₹500, 1 paid invoice of ₹800 paid this month
        RoyaltyInvoice.objects.create(
            outlet=self.outlet1, month=1, year=today.year, total_sales=Decimal("10000.00"),
            royalty_percentage=Decimal("5.00"), amount_due=Decimal("500.00"),
            status=RoyaltyInvoice.Status.PENDING,
        )
        RoyaltyInvoice.objects.create(
            outlet=self.outlet1, month=2, year=today.year, total_sales=Decimal("16000.00"),
            royalty_percentage=Decimal("5.00"), amount_due=Decimal("800.00"),
            status=RoyaltyInvoice.Status.PAID,
            paid_at=timezone.now(),
        )

        # Outlet 2: 1 pending invoice of ₹1,000
        RoyaltyInvoice.objects.create(
            outlet=self.outlet2, month=1, year=today.year, total_sales=Decimal("20000.00"),
            royalty_percentage=Decimal("5.00"), amount_due=Decimal("1000.00"),
            status=RoyaltyInvoice.Status.PENDING,
        )

        # Owner 1 summary
        self.client.force_authenticate(user=self.owner1)
        res = self.client.get("/api/royalty/summary/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total_pending_amount"], "500.00")
        self.assertEqual(res.data["total_paid_this_year"], "800.00")
        self.assertEqual(res.data["total_collected_this_month"], "800.00")
        self.assertEqual(res.data["pending_count"], 1)
        self.assertEqual(res.data["total_invoices_count"], 2)

        # Admin summary
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get("/api/royalty/summary/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total_pending_amount"], "1500.00")
        self.assertEqual(res.data["total_collected_this_month"], "800.00")
        self.assertEqual(res.data["total_invoices_count"], 3)
        self.assertEqual(res.data["total_pending_count"], 2)
