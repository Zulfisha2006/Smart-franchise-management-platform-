from django.core.mail import send_mail
from django.conf import settings


def send_otp_email(user, otp_code):
    """
    Sends the verification code to the user's email.
    Prints to server logs so the code is always visible in Render dashboard.
    Skips SMTP on Render free tier (where outbound SMTP ports are blocked).
    """
    print(f"\n========================================", flush=True)
    print(f"[CHAINHUB OTP] User: '{user.username}' | Email: {user.email} | CODE: {otp_code.code}", flush=True)
    print(f"========================================\n", flush=True)

    # Render free tier blocks outbound SMTP ports 25, 465, and 587.
    # Skip attempting SMTP on Render to prevent worker hanging and 500 timeout.
    if getattr(settings, "IS_RENDER", False):
        print("[INFO] Render free tier blocks SMTP ports. OTP logged above.", flush=True)
        return False

    gmail_address = getattr(settings, "GMAIL_ADDRESS", "")
    gmail_password = getattr(settings, "GMAIL_APP_PASSWORD", "")

    if not gmail_address or not gmail_password:
        return False

    try:
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
        return True
    except Exception as e:
        print(f"[WARNING] Could not send email via SMTP: {e}", flush=True)
        return False
