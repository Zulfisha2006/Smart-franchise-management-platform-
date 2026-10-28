import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Outlet
from sales.models import Sale


class Command(BaseCommand):
    help = "Generates realistic demo sales history for all APPROVED outlets (safe to re-run)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days", type=int, default=20,
            help="How many past days of sales to generate per outlet (default: 20)"
        )
        parser.add_argument(
            "--min", type=int, default=8000,
            help="Minimum daily sales amount (default: 8000)"
        )
        parser.add_argument(
            "--max", type=int, default=25000,
            help="Maximum daily sales amount (default: 25000)"
        )

    def handle(self, *args, **options):
        days = options["days"]
        min_amt = options["min"]
        max_amt = options["max"]

        outlets = Outlet.objects.filter(status=Outlet.Status.APPROVED)

        if not outlets.exists():
            self.stdout.write(self.style.WARNING(
                "No approved outlets found. Approve an outlet first, then re-run this command."
            ))
            return

        today = timezone.localdate()
        total_created = 0
        total_skipped = 0

        for outlet in outlets:
            created_for_this_outlet = 0
            for i in range(days):
                entry_date = today - timedelta(days=i)
                base_amount = random.randint(min_amt, max_amt)
                # Realistic hospitality/retail seasonality:
                # Friday/Saturday +35%, Sunday +20%, Monday-Tuesday -10%
                dow = entry_date.weekday()
                if dow in (4, 5):  # Fri, Sat
                    multiplier = 1.35
                elif dow == 6:    # Sun
                    multiplier = 1.20
                elif dow in (0, 1): # Mon, Tue
                    multiplier = 0.88
                else:
                    multiplier = 1.0

                amount = round(base_amount * multiplier, 2)

                # get_or_create = only inserts if this outlet+date doesn't already
                # have a sale logged. Prevents duplicates if you run this twice.
                sale, was_created = Sale.objects.get_or_create(
                    outlet=outlet,
                    date=entry_date,
                    defaults={"amount": amount, "note": "Demo sales record"},
                )
                if was_created:
                    created_for_this_outlet += 1
                    total_created += 1
                else:
                    total_skipped += 1

            self.stdout.write(self.style.SUCCESS(
                f"  {outlet.outlet_name}: {created_for_this_outlet} new sales entries added"
            ))

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {total_created} new entries created, {total_skipped} days skipped "
            f"(already had data). Refresh your dashboards to see the charts populate."
        ))
