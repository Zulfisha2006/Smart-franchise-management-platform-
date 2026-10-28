from rest_framework import serializers
from .models import Announcement, SupportTicket


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source="created_by.username", default="HQ Admin")
    attachment_pdf_url = serializers.SerializerMethodField()
    attachment_excel_url = serializers.SerializerMethodField()
    target_outlet_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )

    class Meta:
        model = Announcement
        fields = [
            "id",
            "title",
            "message",
            "target_all",
            "target_outlet_ids",
            "report_type",
            "attachment_pdf_url",
            "attachment_excel_url",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_by_name", "created_at",
                            "attachment_pdf_url", "attachment_excel_url"]

    def get_attachment_pdf_url(self, obj):
        request = self.context.get("request")
        if obj.attachment_pdf and request:
            return request.build_absolute_uri(obj.attachment_pdf.url)
        return None

    def get_attachment_excel_url(self, obj):
        request = self.context.get("request")
        if obj.attachment_excel and request:
            return request.build_absolute_uri(obj.attachment_excel.url)
        return None

    def create(self, validated_data):
        target_outlet_ids = validated_data.pop("target_outlet_ids", [])
        announcement = super().create(validated_data)
        if target_outlet_ids:
            from accounts.models import Outlet
            announcement.target_outlets.set(Outlet.objects.filter(id__in=target_outlet_ids))
        return announcement


class SupportTicketSerializer(serializers.ModelSerializer):
    outlet_name = serializers.ReadOnlyField(source="outlet.outlet_name")
    outlet_city = serializers.ReadOnlyField(source="outlet.city")
    owner_username = serializers.ReadOnlyField(source="outlet.owner.username")
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            "id",
            "outlet",
            "outlet_name",
            "outlet_city",
            "owner_username",
            "subject",
            "description",
            "status",
            "status_display",
            "admin_reply",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "outlet",
            "outlet_name",
            "outlet_city",
            "owner_username",
            "status_display",
            "created_at",
            "updated_at",
        ]


class SupportTicketCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = ["id", "subject", "description"]


class SupportTicketUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = ["status", "admin_reply"]
        extra_kwargs = {
            "status": {"required": False},
            "admin_reply": {"required": False},
        }
