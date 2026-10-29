from django.core.mail import send_mail
from django.conf import settings


def send_otp_email(user, otp_code):
    """
    Sends the verification code to the user's email.
    Also prints to console/logs so codes can always be retrieved
    even if SMTP credentials aren't configured yet.
    """
    print(f"\n========================================", flush=True)
    print(f"[CHAINHUB OTP] User: '{user.username}' | Email: {user.email} | CODE: {otp_code.code}", flush=True)
    print(f"========================================\n", flush=True)

    gmail_address = getattr(settings, "GMAIL_ADDRESS", "")
    gmail_password = getattr(settings, "GMAIL_APP_PASSWORD", "")

    if not gmail_address or not gmail_password:
        raise ValueError("GMAIL_ADDRESS or GMAIL_APP_PASSWORD not set in environment variables.")

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
