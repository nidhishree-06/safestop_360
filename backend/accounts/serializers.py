"""Serializers for authentication, profile management, and notifications."""

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import Notification, User, UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            "phone",
            "city",
            "emergency_note",
            "location_sharing_default",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    unread_notifications = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "role",
            "is_active",
            "created_at",
            "profile",
            "unread_notifications",
        ]
        read_only_fields = ["id", "email", "role", "is_active", "created_at"]

    def get_unread_notifications(self, obj: User) -> int:
        return obj.notifications.filter(is_read=False).count()


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})
    full_name = serializers.CharField(max_length=150, min_length=2)
    role = serializers.ChoiceField(
        choices=[User.Role.WOMAN, User.Role.PARTNER],
        default=User.Role.WOMAN,
    )
    phone = serializers.CharField(max_length=24, required=False, allow_blank=True, default="")
    city = serializers.CharField(max_length=100, required=False, allow_blank=True, default="Bengaluru")

    def validate_email(self, value: str) -> str:
        normalized = value.strip().lower()
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    def validate(self, attrs: dict) -> dict:
        password = attrs.get("password", "")
        temp_user = User(email=attrs.get("email", ""), full_name=attrs.get("full_name", ""))
        try:
            validate_password(password, user=temp_user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data: dict) -> User:
        phone = validated_data.pop("phone", "").strip()
        city = validated_data.pop("city", "").strip() or "Bengaluru"
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data["full_name"].strip(),
            role=validated_data["role"],
        )
        UserProfile.objects.create(user=user, phone=phone, city=city)
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs: dict) -> dict:
        email = attrs.get("email", "").strip().lower()
        password = attrs.get("password", "")
        user = authenticate(request=self.context.get("request"), username=email, password=password)
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account has been deactivated.")
        attrs["user"] = user
        return attrs


class ProfileUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150, min_length=2, required=False)
    phone = serializers.CharField(max_length=24, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    emergency_note = serializers.CharField(max_length=280, required=False, allow_blank=True)
    location_sharing_default = serializers.BooleanField(required=False)

    def update(self, instance: User, validated_data: dict) -> User:
        if "full_name" in validated_data:
            instance.full_name = validated_data["full_name"].strip()
            instance.save(update_fields=["full_name", "updated_at"])

        profile, _ = UserProfile.objects.get_or_create(user=instance)
        profile_fields = ["phone", "city", "emergency_note", "location_sharing_default"]
        changed = []
        for field in profile_fields:
            if field in validated_data:
                value = validated_data[field]
                if isinstance(value, str):
                    value = value.strip()
                setattr(profile, field, value)
                changed.append(field)
        if changed:
            profile.save(update_fields=[*changed, "updated_at"])
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value: str) -> str:
        user: User = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value: str) -> str:
        user: User = self.context["request"].user
        try:
            validate_password(value, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False, allow_blank=True)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "title",
            "body",
            "category",
            "is_read",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields
