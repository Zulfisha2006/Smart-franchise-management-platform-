from django.core.management.base import BaseCommand
from accounts.models import User

class Command(BaseCommand):
    help = "Check existing users without displaying passwords"

    def handle(self, *args, **options):
        for user in User.objects.all():
            self.stdout.write(
                f"Username: {user.username} | "
                f"Email: {user.email} | "
                f"Role: {user.role} | "
                f"Verified: {user.is_verified} | "
                f"Active: {user.is_active}"
            )
