from rest_framework import generics, permissions, status
from rest_framework.response import Response
from accounts.models import Outlet, User
from .models import Announcement, SupportTicket
from .serializers import (
    AnnouncementSerializer,
    SupportTicketSerializer,
    SupportTicketCreateSerializer,
    SupportTicketUpdateSerializer,
)


class IsAdmin(permissions.BasePermission):
    """Allows access only to Admin users."""
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.ADMIN
        )


class IsApprovedFranchiseOwner(permissions.BasePermission):
    """Only a Franchise Owner with an APPROVED outlet can raise support tickets."""
    def has_permission(self, request, view):
        user = request.user
        if not (user.is_authenticated and user.role == User.Role.FRANCHISE_OWNER):
            return False
        return Outlet.objects.filter(owner=user, status=Outlet.Status.APPROVED).exists()


class AnnouncementCreateView(generics.CreateAPIView):
    """
    POST /api/announcements/create/
    HQ Admin posts a new network-wide broadcast announcement.
    """
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAdmin]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AnnouncementListView(generics.ListAPIView):
    """
    GET /api/announcements/
    Admin sees all announcements.
    Franchise Owner sees announcements targeted to all or explicitly to their outlet.
    """
    serializer_class = AnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.ADMIN:
            return Announcement.objects.all().distinct()
        
        # Franchise Owner or Staff:
        # Check user's outlet
        try:
            outlet = getattr(user, "outlet", None)
        except Exception:
            outlet = None

        if outlet:
            from django.db.models import Q
            return Announcement.objects.filter(
                Q(target_all=True) | Q(target_outlets=outlet)
            ).distinct()
        
        return Announcement.objects.filter(target_all=True).distinct()



class SupportTicketCreateView(generics.CreateAPIView):
    """
    POST /api/tickets/create/
    Approved Franchise Owner raises a new support ticket for their outlet.
    """
    serializer_class = SupportTicketCreateSerializer
    permission_classes = [IsApprovedFranchiseOwner]

    def create(self, request, *args, **kwargs):
        outlet = Outlet.objects.get(owner=request.user, status=Outlet.Status.APPROVED)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save(outlet=outlet)
        output_serializer = SupportTicketSerializer(ticket)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


class SupportTicketListView(generics.ListAPIView):
    """
    GET /api/tickets/
    Franchise Owner sees only tickets for their outlet.
    Admin sees all tickets across the network with optional ?status=... and ?outlet=... filters.
    """
    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        status_param = self.request.query_params.get("status")
        outlet_param = self.request.query_params.get("outlet")

        if user.role == User.Role.ADMIN:
            qs = SupportTicket.objects.all().select_related("outlet", "outlet__owner")
            if status_param:
                qs = qs.filter(status=status_param)
            if outlet_param:
                qs = qs.filter(outlet_id=outlet_param)
            return qs

        qs = SupportTicket.objects.filter(outlet__owner=user).select_related("outlet", "outlet__owner")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs


class SupportTicketUpdateView(generics.UpdateAPIView):
    """
    PATCH /api/tickets/<id>/update/
    Admin updates ticket status (open -> in_progress -> resolved) and/or writes an admin_reply.
    """
    serializer_class = SupportTicketUpdateSerializer
    permission_classes = [IsAdmin]
    queryset = SupportTicket.objects.all()
    http_method_names = ["patch", "put", "options", "head"]

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        output_serializer = SupportTicketSerializer(instance)
        return Response(output_serializer.data, status=status.HTTP_200_OK)
