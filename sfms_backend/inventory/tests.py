from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User, Outlet
from inventory.models import StockItem


class InventoryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="invowner",
            email="invowner@example.com",
            password="Password123!",
            role=User.Role.FRANCHISE_OWNER,
            is_verified=True,
        )
        self.outlet = Outlet.objects.create(
            owner=self.owner,
            outlet_name="QuickBite Inventory Test",
            city="Pune",
            status=Outlet.Status.APPROVED,
        )
        self.client.force_authenticate(user=self.owner)

    def test_create_and_adjust_stock(self):
        res = self.client.post("/api/inventory/create/", {
            "name": "Burger Buns",
            "unit": "pieces",
            "current_quantity": "50.00",
            "low_stock_threshold": "10.00",
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        item_id = res.data["id"]

        # Quick adjust - delta +20
        res_adj = self.client.patch(f"/api/inventory/{item_id}/adjust/", {"change": "20.00"})
        self.assertEqual(res_adj.status_code, status.HTTP_200_OK)
        item = StockItem.objects.get(id=item_id)
        self.assertEqual(item.current_quantity, Decimal("70.00"))

        # Adjust below zero should fail
        res_neg = self.client.patch(f"/api/inventory/{item_id}/adjust/", {"change": "-100.00"})
        self.assertEqual(res_neg.status_code, status.HTTP_400_BAD_REQUEST)

    def test_low_stock_alert_detection(self):
        StockItem.objects.create(
            outlet=self.outlet,
            name="Packaging Boxes",
            unit="packs",
            current_quantity=Decimal("5.00"),
            low_stock_threshold=Decimal("15.00"),
        )
        res = self.client.get("/api/inventory/low-stock/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["name"], "Packaging Boxes")
