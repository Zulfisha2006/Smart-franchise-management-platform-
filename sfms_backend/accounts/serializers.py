from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Outlet

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "phone_number", "role"]
        read_only_fields = ["role"]

    def create(self, validated_data):
        validated_data["role"] = User.Role.FRANCHISE_OWNER
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "phone_number", "is_verified"]


class OutletSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="owner.username", read_only=True)

    class Meta:
        model = Outlet
        fields = ["id", "outlet_name", "city", "address", "license_document",
                  "status", "royalty_percentage", "owner", "owner_name", "created_at"]
        read_only_fields = ["owner", "status", "royalty_percentage", "created_at"]
