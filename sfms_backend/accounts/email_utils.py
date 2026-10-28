from django.core.mail import send_mail
from django.conf import settings


def send_otp_email(user, otp_code):
    """
    Sends the verification code to the user's email.
    Uses Django's send_mail, which relies on the EMAIL_* settings
    configured in settings.py (pulled from the .env file).
    """
    subject = "Your Chainhub verification code"
    message = (
        f"Hi {user.username},\n\n"
        f"Your Chainhub verification code is: {otp_code.code}\n"
        f"This code expires in 10 minutes.\n\n"
        f"If you didn't request this, you can safely ignore this email."
    )
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )
