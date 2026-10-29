import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sfms_backend.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

def create_or_update_admin():
    username = os.environ.get('ADMIN_USERNAME') or os.environ.get('DJANGO_SUPERUSER_USERNAME')
    password = os.environ.get('ADMIN_PASSWORD') or os.environ.get('DJANGO_SUPERUSER_PASSWORD')
    email = os.environ.get('ADMIN_EMAIL') or os.environ.get('DJANGO_SUPERUSER_EMAIL') or 'admin@example.com'

    if not username or not password:
        print("Note: ADMIN_USERNAME and ADMIN_PASSWORD are not set in environment variables.")
        print("Skipping automatic admin creation.")
        return

    try:
        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': email}
        )
        user.set_password(password)
        user.is_superuser = True
        user.is_staff = True
        user.role = User.Role.ADMIN
        user.is_verified = True
        user.save()

        if created:
            print(f"[OK] Admin user '{username}' created successfully!")
        else:
            print(f"[OK] Admin user '{username}' credentials updated successfully!")
    except Exception as e:
        print(f"[ERROR] Failed to create or update admin user: {e}")

if __name__ == '__main__':
    create_or_update_admin()

