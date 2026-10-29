import json
import urllib.request
import urllib.error
import logging
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


def send_via_brevo_api(user, otp_code, api_key, sender_email):
    """
    Sends an email using Brevo's HTTP API (v3/smtp/email) over HTTPS (port 443).
    This bypasses Render's free tier SMTP block (ports 25, 465, 587).
    """
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json",
    }
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #0d9488; color: white; font-weight: bold; font-size: 20px; width: 44px; height: 44px; line-height: 44px; border-radius: 8px;">CH</div>
            <h2 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 22px;">Chainhub Verification</h2>
            <p style="color: #64748b; font-size: 14px; margin: 0;">Smart Franchise Management Platform</p>
        </div>
        <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hi <strong>{user.username}</strong>,</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.5;">Here is your 6-digit verification code to complete your authentication:</p>
        <div style="text-align: center; margin: 28px 0;">
            <span style="display: inline-block; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0d9488; background: #f0fdfa; padding: 14px 28px; border-radius: 10px; border: 1.5px dashed #0d9488;">
                {otp_code.code}
            </span>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            ⏰ This code will expire in <strong>10 minutes</strong>.<br>
            If you did not request this verification code, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
            &copy; Chainhub SFMS &bull; Secure Authentication System
        </p>
    </div>
    """

    payload = {
        "sender": {
            "name": "Chainhub SFMS",
            "email": sender_email,
        },
        "to": [
            {
                "email": user.email,
                "name": user.username or "Franchise Partner",
            }
        ],
        "subject": f"{otp_code.code} is your Chainhub verification code",
        "htmlContent": html_content,
        "textContent": f"Hi {user.username},\n\nYour Chainhub verification code is: {otp_code.code}\n\nThis code expires in 10 minutes.\n\nChainhub Team",
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status in (200, 201, 202):
                print(f"[OK] Email successfully sent to {user.email} via Brevo API", flush=True)
                return True
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"[ERROR] Brevo API HTTP {e.code}: {err_body}", flush=True)
        raise RuntimeError(f"Brevo API error: {err_body}")
    except Exception as e:
        print(f"[ERROR] Failed to reach Brevo API: {e}", flush=True)
        raise

    return False


def send_otp_email(user, otp_code):
    """
    Sends the verification code to user's real email inbox.
    1. Uses Brevo HTTP API if BREVO_API_KEY is configured (recommended for Render free tier).
    2. Falls back to standard Django SMTP if Brevo is not configured.
    """
    brevo_key = getattr(settings, "BREVO_API_KEY", "").strip()
    brevo_sender = getattr(settings, "BREVO_SENDER_EMAIL", "").strip() or getattr(settings, "GMAIL_ADDRESS", "").strip()

    # 1. Primary path: Brevo REST API (HTTPS port 443 - works on Render Free)
    if brevo_key:
        if not brevo_sender:
            raise ValueError("BREVO_API_KEY is set, but BREVO_SENDER_EMAIL is missing. Please set your registered Brevo sender email in Render environment variables.")
        return send_via_brevo_api(user, otp_code, brevo_key, brevo_sender)

    # 2. Secondary path: Standard SMTP (Gmail or custom SMTP)
    gmail_address = getattr(settings, "GMAIL_ADDRESS", "").strip()
    gmail_password = getattr(settings, "GMAIL_APP_PASSWORD", "").strip()

    if gmail_address and gmail_password:
        # Check if running on Render free tier without Brevo
        if getattr(settings, "IS_RENDER", False):
            print(f"\n[WARNING] Running on Render free tier with standard SMTP. Render blocks outgoing SMTP ports (25, 465, 587). Please set BREVO_API_KEY in Render to send real emails.", flush=True)

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
        print(f"[OK] Email sent to {user.email} via standard SMTP", flush=True)
        return True

    # Neither provider configured
    raise ValueError(
        "No email service configured. Please add BREVO_API_KEY and BREVO_SENDER_EMAIL in your Render dashboard environment variables."
    )
