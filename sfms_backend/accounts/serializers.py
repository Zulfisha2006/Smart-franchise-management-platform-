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
        extra_kwargs = {
            "username": {"validators": []},
            "email": {"validators": []},
        }

    def validate_username(self, value):
        username = value.strip()
        existing = User.objects.filter(username__iexact=username).first()
        if existing and existing.is_verified:
            raise serializers.ValidationError("An account with this username already exists and is verified. Please log in.")
        return username

    def validate_email(self, value):
        email = value.strip().lower()
        existing = User.objects.filter(email__iexact=email).first()
        if existing and existing.is_verified:
            raise serializers.ValidationError("An account with this email already exists and is verified. Please log in.")
        return email

    def create(self, validated_data):
        username = validated_data.get("username")
        existing_user = User.objects.filter(username__iexact=username).first()
        if existing_user and not existing_user.is_verified:
            existing_user.email = validated_data.get("email", existing_user.email)
            existing_user.set_password(validated_data.get("password"))
            if "phone_number" in validated_data:
                existing_user.phone_number = validated_data["phone_number"]
            existing_user.role = User.Role.FRANCHISE_OWNER
            existing_user.save()
            return existing_user

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
