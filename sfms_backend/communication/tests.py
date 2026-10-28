from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from accounts.models import Outlet, User
from .models import Announcement, SupportTicket


class CommunicationModuleTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin user
        self.admin_user = User.objects.create_superuser(
            username="admin_hq",
            email="admin@chainhub.com",
            password="AdminPassword123!",
            role=User.Role.ADMIN,
        )

        # Approved Franchise Owner 1
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
        )

        # Approved Franchise Owner 2
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
        )

        # Pending Franchise Owner (unapproved)
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
        )

    # ------------------ Announcement Tests ------------------

    def test_admin_can_create_announcement(self):
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "title": "Supply Chain Maintenance",
            "message": "The central warehouse will be performing maintenance this Sunday.",
        }
        res = self.client.post("/api/announcements/create/", payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["title"], payload["title"])
        self.assertEqual(Announcement.objects.count(), 1)
        announcement = Announcement.objects.first()
        self.assertEqual(announcement.created_by, self.admin_user)

    def test_owner_cannot_create_announcement(self):
        self.client.force_authenticate(user=self.owner1)
        payload = {
            "title": "Owner Broadcast Attempt",
            "message": "Franchise owners should not be allowed to post announcements.",
        }
        res = self.client.post("/api/announcements/create/", payload)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Announcement.objects.count(), 0)

    def test_all_authenticated_users_can_list_announcements(self):
        Announcement.objects.create(
            title="First Announcement",
            message="Welcome to the platform.",
            created_by=self.admin_user,
        )
        Announcement.objects.create(
            title="Second Announcement",
            message="New seasonal recipes uploaded.",
            created_by=self.admin_user,
        )

        # Owner 1 lists
        self.client.force_authenticate(user=self.owner1)
        res = self.client.get("/api/announcements/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)
        # Verify newest first ordering
        self.assertEqual(res.data[0]["title"], "Second Announcement")

        # Admin lists
        self.client.force_authenticate(user=self.admin_user)
        res_admin = self.client.get("/api/announcements/")
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_admin.data), 2)

    # ------------------ Support Ticket Tests ------------------

    def test_approved_owner_can_create_ticket(self):
        self.client.force_authenticate(user=self.owner1)
        payload = {
            "subject": "POS Terminal issue",
            "description": "The card terminal is failing to connect to WiFi intermittently.",
        }
        res = self.client.post("/api/tickets/create/", payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["subject"], payload["subject"])
        self.assertEqual(res.data["status"], "open")
        self.assertEqual(res.data["outlet_name"], "QuickBite Central")

        ticket = SupportTicket.objects.first()
        self.assertEqual(ticket.outlet, self.outlet1)
        self.assertEqual(ticket.status, SupportTicket.Status.OPEN)

    def test_unapproved_owner_cannot_create_ticket(self):
        self.client.force_authenticate(user=self.pending_owner)
        payload = {
            "subject": "Pending Outlet Ticket",
            "description": "Should not be able to raise a ticket without an approved outlet.",
        }
        res = self.client.post("/api/tickets/create/", payload)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(SupportTicket.objects.count(), 0)

    def test_owner_sees_only_own_outlet_tickets(self):
        ticket1 = SupportTicket.objects.create(
            outlet=self.outlet1,
            subject="Outlet 1 Freezer issue",
            description="Deep freezer temp fluctuating.",
            status=SupportTicket.Status.OPEN,
        )
        ticket2 = SupportTicket.objects.create(
            outlet=self.outlet2,
            subject="Outlet 2 Packaging delay",
            description="Boxes delivery delayed.",
            status=SupportTicket.Status.OPEN,
        )

        # Owner 1 check
        self.client.force_authenticate(user=self.owner1)
        res1 = self.client.get("/api/tickets/")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res1.data), 1)
        self.assertEqual(res1.data[0]["id"], ticket1.id)
        self.assertEqual(res1.data[0]["subject"], "Outlet 1 Freezer issue")

        # Owner 2 check
        self.client.force_authenticate(user=self.owner2)
        res2 = self.client.get("/api/tickets/")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res2.data), 1)
        self.assertEqual(res2.data[0]["id"], ticket2.id)

    def test_admin_sees_all_tickets_and_can_filter(self):
        t1 = SupportTicket.objects.create(
            outlet=self.outlet1,
            subject="T1 Open",
            description="Open issue",
            status=SupportTicket.Status.OPEN,
        )
        t2 = SupportTicket.objects.create(
            outlet=self.outlet1,
            subject="T2 Resolved",
            description="Resolved issue",
            status=SupportTicket.Status.RESOLVED,
        )
        t3 = SupportTicket.objects.create(
            outlet=self.outlet2,
            subject="T3 In Progress",
            description="In progress issue",
            status=SupportTicket.Status.IN_PROGRESS,
        )

        self.client.force_authenticate(user=self.admin_user)

        # All tickets
        res = self.client.get("/api/tickets/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 3)

        # Filter by status=open
        res_open = self.client.get("/api/tickets/?status=open")
        self.assertEqual(res_open.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_open.data), 1)
        self.assertEqual(res_open.data[0]["id"], t1.id)

        # Filter by outlet=outlet1
        res_out1 = self.client.get(f"/api/tickets/?outlet={self.outlet1.id}")
        self.assertEqual(res_out1.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_out1.data), 2)

    def test_owner_cannot_update_ticket_status(self):
        ticket = SupportTicket.objects.create(
            outlet=self.outlet1,
            subject="Bug report",
            description="Owner trying to resolve",
            status=SupportTicket.Status.OPEN,
        )
        self.client.force_authenticate(user=self.owner1)
        res = self.client.patch(f"/api/tickets/{ticket.id}/update/", {
            "status": "resolved",
            "admin_reply": "Owner self reply",
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        ticket.refresh_from_db()
        self.assertEqual(ticket.status, SupportTicket.Status.OPEN)
        self.assertEqual(ticket.admin_reply, "")

    def test_admin_can_update_ticket_status_and_reply(self):
        ticket = SupportTicket.objects.create(
            outlet=self.outlet1,
            subject="Printer broken",
            description="Receipt printer is not printing clear receipts.",
            status=SupportTicket.Status.OPEN,
        )

        self.client.force_authenticate(user=self.admin_user)

        # Update to in_progress with reply
        res = self.client.patch(f"/api/tickets/{ticket.id}/update/", {
            "status": "in_progress",
            "admin_reply": "Technician has been dispatched for tomorrow 10 AM.",
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "in_progress")
        self.assertEqual(res.data["admin_reply"], "Technician has been dispatched for tomorrow 10 AM.")

        ticket.refresh_from_db()
        self.assertEqual(ticket.status, SupportTicket.Status.IN_PROGRESS)
        self.assertEqual(ticket.admin_reply, "Technician has been dispatched for tomorrow 10 AM.")

        # Update to resolved
        res2 = self.client.patch(f"/api/tickets/{ticket.id}/update/", {
            "status": "resolved",
        })
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["status"], "resolved")

        # Verify Owner now sees the updated status and admin reply
        self.client.force_authenticate(user=self.owner1)
        res_owner = self.client.get("/api/tickets/")
        self.assertEqual(res_owner.status_code, status.HTTP_200_OK)
        self.assertEqual(res_owner.data[0]["status"], "resolved")
        self.assertEqual(res_owner.data[0]["admin_reply"], "Technician has been dispatched for tomorrow 10 AM.")
