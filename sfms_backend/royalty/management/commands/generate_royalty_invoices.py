import calendar
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db.models import Sum
from django.utils import timezone

from accounts.models import Outlet
from sales.models import Sale
from royalty.models import RoyaltyInvoice


class Command(BaseCommand):
    help = (
        "Calculates and generates monthly royalty invoices for all APPROVED outlets. "
        "Safe to re-run (uses get_or_create to prevent duplicate invoices for the same outlet+month+year)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--month",
            type=int,
            default=None,
            help="Target month (1-12). Defaults to previous calendar month.",
        )
        parser.add_argument(
            "--year",
            type=int,
            default=None,
            help="Target year (e.g. 2026). Defaults to previous month's year.",
        )

    def handle(self, *args, **options):
        today = timezone.localdate()

        # Determine target month and year (default: previous calendar month)
        if options["month"] is not None:
            target_month = options["month"]
            if not 1 <= target_month <= 12:
                self.stderr.write(self.style.ERROR(f"Invalid month: {target_month}. Must be between 1 and 12."))
                return
            target_year = options["year"] if options["year"] is not None else today.year
        else:
            # Default to last month
            if today.month == 1:
                target_month = 12
                target_year = today.year - 1
            else:
                target_month = today.month - 1
                target_year = today.year

        if options["year"] is not None and options["month"] is None:
            target_year = options["year"]

        month_name = calendar.month_name[target_month]
        self.stdout.write(self.style.NOTICE(
            f"Generating royalty invoices for: {month_name} {target_year}"
        ))

        approved_outlets = Outlet.objects.filter(status=Outlet.Status.APPROVED)

        if not approved_outlets.exists():
            self.stdout.write(self.style.WARNING(
                "No approved outlets found. Approve outlets first, then run this command."
            ))
            return

        total_created = 0
        total_skipped = 0

        for outlet in approved_outlets:
            # Calculate sum of sales for that outlet for target month and year
            sales_qs = Sale.objects.filter(
                outlet=outlet,
                date__year=target_year,
                date__month=target_month,
            )
            total_sales = sales_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            royalty_pct = outlet.royalty_percentage
            amount_due = (Decimal(total_sales) * Decimal(royalty_pct) / Decimal("100")).quantize(Decimal("0.01"))

            invoice, created = RoyaltyInvoice.objects.get_or_create(
                outlet=outlet,
                month=target_month,
                year=target_year,
                defaults={
                    "total_sales": total_sales,
                    "royalty_percentage": royalty_pct,
                    "amount_due": amount_due,
                    "status": RoyaltyInvoice.Status.PENDING,
                },
            )

            if created:
                total_created += 1
                self.stdout.write(self.style.SUCCESS(
                    f"  [+] Created invoice for {outlet.outlet_name}: "
                    f"Sales={total_sales:,.2f} | Rate={royalty_pct}% | Amount Due={amount_due:,.2f}"
                ))
            else:
                total_skipped += 1
                self.stdout.write(
                    f"  [-] Skipped {outlet.outlet_name}: Invoice for {month_name} {target_year} already exists (Amount Due: {invoice.amount_due} - {invoice.status})."
                )

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {total_created} invoices created, {total_skipped} skipped (already existed)."
        ))
