"""
Benchmarking & Report Generation Backend Views
POST /api/benchmarks/data/       -> Multi-outlet comparison data
POST /api/benchmarks/export/pdf/ -> Download PDF report
POST /api/benchmarks/export/excel/ -> Download Excel report
POST /api/benchmarks/publish/    -> Publish report as Announcement with file attachments
"""
import io
import json
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum, Avg, Count, Max, Min
from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Outlet, User
from sales.models import Sale
from inventory.models import StockItem
from royalty.models import RoyaltyInvoice
from .models import Announcement


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (request.user.is_authenticated and
                request.user.role == User.Role.ADMIN)


def _parse_date_range(params):
    """Parse date_from / date_to from request params. Defaults to last 30 days."""
    today = date.today()
    try:
        date_from = date.fromisoformat(params.get("date_from", "")) 
    except (ValueError, TypeError):
        date_from = today - timedelta(days=30)
    try:
        date_to = date.fromisoformat(params.get("date_to", ""))
    except (ValueError, TypeError):
        date_to = today
    return date_from, date_to


def _build_outlet_benchmarks(outlets, date_from, date_to):
    """Build per-outlet benchmark data from DB records."""
    results = []
    span_days = max(1, (date_to - date_from).days + 1)

    # Pre-fetch all low-stock items for efficiency
    all_low_stock_items = {item.outlet_id for item in StockItem.objects.all() if item.is_low_stock}

    for outlet in outlets:
        # ─── Sales ─────────────────────────────────────────────────────
        sales_qs = Sale.objects.filter(outlet=outlet, date__range=(date_from, date_to))
        total_sales = float(sales_qs.aggregate(t=Sum("amount"))["t"] or 0)
        sale_count = sales_qs.count()
        avg_daily = total_sales / span_days

        # Previous period for growth
        prev_from = date_from - timedelta(days=span_days)
        prev_to = date_from - timedelta(days=1)
        prev_sales = float(
            Sale.objects.filter(outlet=outlet, date__range=(prev_from, prev_to))
            .aggregate(t=Sum("amount"))["t"] or 0
        )
        if prev_sales > 0:
            growth_pct = round(((total_sales - prev_sales) / prev_sales) * 100, 1)
        else:
            growth_pct = 0.0

        # ─── Inventory ─────────────────────────────────────────────────
        stock_items = StockItem.objects.filter(outlet=outlet)
        total_items = stock_items.count()
        low_stock_count = sum(1 for it in stock_items if it.is_low_stock)
        inventory_health = round(((total_items - low_stock_count) / total_items * 100) if total_items else 100, 1)

        # ─── Royalty ───────────────────────────────────────────────────
        royalty_qs = RoyaltyInvoice.objects.filter(outlet=outlet)
        total_royalty_due = float(royalty_qs.aggregate(t=Sum("amount_due"))["t"] or 0)
        pending_royalty = float(
            royalty_qs.filter(status=RoyaltyInvoice.Status.PENDING)
            .aggregate(t=Sum("amount_due"))["t"] or 0
        )
        royalty_paid = total_royalty_due - pending_royalty

        # ─── Monthly breakdown ─────────────────────────────────────────
        monthly = []
        # Group sales by month for chart data
        from django.db.models.functions import TruncMonth
        monthly_qs = (
            sales_qs.annotate(month=TruncMonth("date"))
            .values("month")
            .annotate(total=Sum("amount"))
            .order_by("month")
        )
        for m in monthly_qs:
            monthly.append({
                "month": m["month"].strftime("%b %Y"),
                "total": float(m["total"] or 0),
            })

        results.append({
            "outlet_id": outlet.id,
            "outlet_name": outlet.outlet_name,
            "city": outlet.city,
            "owner": outlet.owner.username,
            "status": outlet.status,
            "total_sales": round(total_sales, 2),
            "sale_entries": sale_count,
            "avg_daily_sales": round(avg_daily, 2),
            "growth_pct": growth_pct,
            "prev_period_sales": round(prev_sales, 2),
            "total_items": total_items,
            "low_stock_count": low_stock_count,
            "inventory_health": inventory_health,
            "total_royalty_due": round(total_royalty_due, 2),
            "royalty_paid": round(royalty_paid, 2),
            "pending_royalty": round(pending_royalty, 2),
            "royalty_percentage": float(outlet.royalty_percentage),
            "monthly_sales": monthly,
        })

    # Add performance ranking by total sales
    results.sort(key=lambda x: x["total_sales"], reverse=True)
    for rank, r in enumerate(results, 1):
        r["rank"] = rank

    return results


class BenchmarkDataView(APIView):
    """
    GET /api/benchmarks/data/
    Returns multi-outlet comparison data for the admin.
    Query params: date_from, date_to, city, outlet_ids (comma-separated)
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        date_from, date_to = _parse_date_range(request.query_params)

        outlets = Outlet.objects.filter(status=Outlet.Status.APPROVED).select_related("owner")

        city_filter = request.query_params.get("city", "")
        if city_filter:
            outlets = outlets.filter(city__icontains=city_filter)

        outlet_ids_param = request.query_params.get("outlet_ids", "")
        if outlet_ids_param:
            try:
                ids = [int(x) for x in outlet_ids_param.split(",") if x.strip()]
                outlets = outlets.filter(id__in=ids)
            except ValueError:
                pass

        outlet_list = list(outlets)

        if not outlet_list:
            return Response({
                "date_from": date_from.isoformat(),
                "date_to": date_to.isoformat(),
                "outlets": [],
                "network_totals": {},
                "cities": [],
            })

        benchmarks = _build_outlet_benchmarks(outlet_list, date_from, date_to)

        # Network totals
        network_total_sales = sum(b["total_sales"] for b in benchmarks)
        network_avg_daily = network_total_sales / max(1, (date_to - date_from).days + 1)
        network_avg_health = round(
            sum(b["inventory_health"] for b in benchmarks) / len(benchmarks), 1
        ) if benchmarks else 100.0

        all_cities = list(
            Outlet.objects.filter(status=Outlet.Status.APPROVED)
            .values_list("city", flat=True)
            .distinct()
            .order_by("city")
        )

        return Response({
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "outlets": benchmarks,
            "network_totals": {
                "total_sales": round(network_total_sales, 2),
                "avg_daily_sales": round(network_avg_daily, 2),
                "outlet_count": len(benchmarks),
                "avg_inventory_health": network_avg_health,
                "top_outlet": benchmarks[0]["outlet_name"] if benchmarks else "-",
            },
            "cities": all_cities,
        })


# ─── PDF Generation ────────────────────────────────────────────────────────────

def _generate_pdf(benchmarks, date_from, date_to, network_totals):
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle,
                                    Paragraph, Spacer, HRFlowable)
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )

    # Colour palette matching the app
    NAVY = colors.HexColor("#1B2B3A")
    TEAL = colors.HexColor("#1A7F6A")
    AMBER = colors.HexColor("#D4842A")
    PAPER = colors.HexColor("#F7F6F3")
    WHITE = colors.white
    SOFT = colors.HexColor("#8B8C8E")
    RED = colors.HexColor("#B3261E")

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "title", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=20, textColor=NAVY,
        spaceAfter=4, alignment=TA_LEFT,
    )
    sub_style = ParagraphStyle(
        "sub", parent=styles["Normal"],
        fontName="Helvetica", fontSize=10, textColor=SOFT,
        spaceAfter=2, alignment=TA_LEFT,
    )
    label_style = ParagraphStyle(
        "label", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=9, textColor=NAVY,
    )
    val_style = ParagraphStyle(
        "val", parent=styles["Normal"],
        fontName="Helvetica", fontSize=9, textColor=NAVY,
    )
    cell_style = ParagraphStyle(
        "cell", parent=styles["Normal"],
        fontName="Helvetica", fontSize=8, textColor=NAVY,
        alignment=TA_LEFT,
    )
    cell_bold = ParagraphStyle(
        "cell_bold", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=8, textColor=NAVY,
        alignment=TA_LEFT,
    )

    story = []

    # ── Header ──────────────────────────────────────────────────────────────
    story.append(Paragraph("Chainhub", title_style))
    story.append(Paragraph(
        f"Multi-Outlet Performance Report  ·  {date_from} to {date_to}",
        sub_style,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=NAVY, spaceAfter=12))

    # ── Network Summary Cards (as a row table) ──────────────────────────────
    nt = network_totals
    summary_data = [
        ["Total Network Sales", "Avg Daily Sales", "Active Outlets", "Avg Inventory Health"],
        [
            f"₹{nt.get('total_sales', 0):,.0f}",
            f"₹{nt.get('avg_daily_sales', 0):,.0f}",
            str(nt.get("outlet_count", 0)),
            f"{nt.get('avg_inventory_health', 0)}%",
        ],
    ]
    summary_table = Table(summary_data, colWidths=["25%", "25%", "25%", "25%"])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("BACKGROUND", (0, 1), (-1, 1), PAPER),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 14),
        ("TEXTCOLOR", (0, 1), (-1, 1), TEAL),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, 1), [PAPER]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D9DDE3")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#D9DDE3")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 16))

    # ── Per-Outlet Table ────────────────────────────────────────────────────
    story.append(Paragraph("Outlet Performance Comparison", label_style))
    story.append(Spacer(1, 6))

    headers = [
        "Rank", "Outlet Name", "City", "Total Sales (₹)",
        "Avg Daily (₹)", "Growth %", "Inv. Health", "Pending Royalty (₹)", "Status",
    ]
    col_widths = [1.2 * cm, 5.5 * cm, 3 * cm, 3.5 * cm, 3 * cm, 2 * cm, 2.5 * cm, 4 * cm, 2 * cm]

    table_data = [headers]
    for b in benchmarks:
        growth = b["growth_pct"]
        growth_str = f"+{growth}%" if growth > 0 else f"{growth}%"
        row = [
            str(b["rank"]),
            b["outlet_name"],
            b["city"],
            f"₹{b['total_sales']:,.0f}",
            f"₹{b['avg_daily_sales']:,.0f}",
            growth_str,
            f"{b['inventory_health']}%",
            f"₹{b['pending_royalty']:,.0f}",
            b["status"].title(),
        ]
        table_data.append(row)

    outlet_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    ts = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (1, 1), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PAPER]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D9DDE3")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#D9DDE3")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("ALIGN", (1, 1), (2, -1), "LEFT"),
    ])
    # Colour growth cells
    for row_idx, b in enumerate(benchmarks, 1):
        if b["growth_pct"] > 0:
            ts.add("TEXTCOLOR", (5, row_idx), (5, row_idx), TEAL)
            ts.add("FONTNAME", (5, row_idx), (5, row_idx), "Helvetica-Bold")
        elif b["growth_pct"] < 0:
            ts.add("TEXTCOLOR", (5, row_idx), (5, row_idx), RED)
            ts.add("FONTNAME", (5, row_idx), (5, row_idx), "Helvetica-Bold")
        if b["inventory_health"] < 70:
            ts.add("TEXTCOLOR", (6, row_idx), (6, row_idx), AMBER)

    outlet_table.setStyle(ts)
    story.append(outlet_table)

    # ── Footer ───────────────────────────────────────────────────────────────
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=SOFT, spaceBefore=4))
    story.append(Paragraph(
        f"Generated by Chainhub HQ  ·  Top Performer: {nt.get('top_outlet', '-')}",
        ParagraphStyle("footer", parent=styles["Normal"],
                       fontName="Helvetica", fontSize=8, textColor=SOFT, alignment=TA_RIGHT),
    ))

    doc.build(story)
    buf.seek(0)
    return buf


class ExportPDFView(APIView):
    """POST /api/benchmarks/export/pdf/ — returns a PDF file."""
    permission_classes = [IsAdmin]

    def post(self, request):
        body = request.data
        date_from, date_to = _parse_date_range(body)
        outlets = Outlet.objects.filter(status=Outlet.Status.APPROVED).select_related("owner")
        city = body.get("city", "")
        if city:
            outlets = outlets.filter(city__icontains=city)
        outlet_ids = body.get("outlet_ids", [])
        if outlet_ids:
            outlets = outlets.filter(id__in=outlet_ids)

        benchmarks = _build_outlet_benchmarks(list(outlets), date_from, date_to)
        network_total_sales = sum(b["total_sales"] for b in benchmarks)
        network_avg_daily = network_total_sales / max(1, (date_to - date_from).days + 1)
        network_avg_health = round(
            sum(b["inventory_health"] for b in benchmarks) / len(benchmarks), 1
        ) if benchmarks else 100.0

        network_totals = {
            "total_sales": round(network_total_sales, 2),
            "avg_daily_sales": round(network_avg_daily, 2),
            "outlet_count": len(benchmarks),
            "avg_inventory_health": network_avg_health,
            "top_outlet": benchmarks[0]["outlet_name"] if benchmarks else "-",
        }

        buf = _generate_pdf(benchmarks, date_from, date_to, network_totals)
        filename = f"Chainhub_Report_{date_from}_{date_to}.pdf"
        response = HttpResponse(buf.read(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response


def _generate_excel(benchmarks, date_from, date_to, network_totals):
    import openpyxl
    from openpyxl.styles import (Font, Alignment, PatternFill, Border, Side,
                                  GradientFill)
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    ws_sum = wb.active
    ws_sum.title = "Summary"
    ws_detail = wb.create_sheet("Outlet Detail")

    # ── Colors ──────────────────────────────────────────────────────────────
    NAVY_HEX = "1B2B3A"
    TEAL_HEX = "1A7F6A"
    AMBER_HEX = "D4842A"
    PAPER_HEX = "F7F6F3"
    RED_HEX = "B3261E"
    WHITE_HEX = "FFFFFF"
    BORDER_HEX = "D9DDE3"

    navy_fill = PatternFill("solid", fgColor=NAVY_HEX)
    teal_fill = PatternFill("solid", fgColor=TEAL_HEX)
    paper_fill = PatternFill("solid", fgColor=PAPER_HEX)
    white_fill = PatternFill("solid", fgColor=WHITE_HEX)
    thin = Side(style="thin", color=BORDER_HEX)
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    def hdr_font(white=True):
        return Font(bold=True, color=WHITE_HEX if white else NAVY_HEX, name="Calibri", size=10)

    def body_font(bold=False, color=NAVY_HEX):
        return Font(bold=bold, color=color, name="Calibri", size=10)

    def center_align():
        return Alignment(horizontal="center", vertical="center", wrap_text=True)

    # ── Summary Sheet ────────────────────────────────────────────────────────
    ws_sum.merge_cells("A1:D1")
    ws_sum["A1"] = "Chainhub — Multi-Outlet Performance Report"
    ws_sum["A1"].font = Font(bold=True, size=16, color=NAVY_HEX, name="Calibri")
    ws_sum["A1"].alignment = center_align()

    ws_sum["A2"] = f"Period: {date_from}  to  {date_to}"
    ws_sum["A2"].font = body_font(color="8B8C8E")
    ws_sum.merge_cells("A2:D2")
    ws_sum["A2"].alignment = center_align()

    ws_sum.append([])

    sum_headers = ["Metric", "Value"]
    ws_sum.append(sum_headers)
    for col_idx, h in enumerate(sum_headers, 1):
        cell = ws_sum.cell(row=4, column=col_idx)
        cell.fill = navy_fill
        cell.font = hdr_font()
        cell.alignment = center_align()
        cell.border = border

    nt = network_totals
    summary_rows = [
        ("Total Network Sales", f"₹{nt.get('total_sales', 0):,.2f}"),
        ("Average Daily Sales", f"₹{nt.get('avg_daily_sales', 0):,.2f}"),
        ("Active Outlets", str(nt.get("outlet_count", 0))),
        ("Average Inventory Health", f"{nt.get('avg_inventory_health', 0)}%"),
        ("Top Performing Outlet", nt.get("top_outlet", "-")),
    ]
    for i, (metric, value) in enumerate(summary_rows, 5):
        ws_sum.cell(row=i, column=1, value=metric).fill = paper_fill if i % 2 == 0 else white_fill
        ws_sum.cell(row=i, column=2, value=value).fill = paper_fill if i % 2 == 0 else white_fill
        for col in [1, 2]:
            c = ws_sum.cell(row=i, column=col)
            c.font = body_font(bold=(col == 2))
            c.alignment = center_align()
            c.border = border

    ws_sum.column_dimensions["A"].width = 30
    ws_sum.column_dimensions["B"].width = 28
    ws_sum.row_dimensions[1].height = 34

    # ── Detail Sheet ─────────────────────────────────────────────────────────
    detail_headers = [
        "Rank", "Outlet Name", "City", "Owner", "Total Sales (₹)",
        "Avg Daily Sales (₹)", "Growth %", "Sale Entries",
        "Inventory Health", "Low Stock Items", "Pending Royalty (₹)", "Royalty Paid (₹)",
    ]
    ws_detail.append(detail_headers)
    for col_idx, h in enumerate(detail_headers, 1):
        cell = ws_detail.cell(row=1, column=col_idx)
        cell.fill = navy_fill
        cell.font = hdr_font()
        cell.alignment = center_align()
        cell.border = border
        ws_detail.column_dimensions[get_column_letter(col_idx)].width = 18

    ws_detail.column_dimensions["B"].width = 26
    ws_detail.column_dimensions["D"].width = 22

    for row_idx, b in enumerate(benchmarks, 2):
        fill = paper_fill if row_idx % 2 == 0 else white_fill
        row_data = [
            b["rank"],
            b["outlet_name"],
            b["city"],
            b["owner"],
            b["total_sales"],
            b["avg_daily_sales"],
            b["growth_pct"],
            b["sale_entries"],
            b["inventory_health"],
            b["low_stock_count"],
            b["pending_royalty"],
            b["royalty_paid"],
        ]
        for col_idx, value in enumerate(row_data, 1):
            cell = ws_detail.cell(row=row_idx, column=col_idx, value=value)
            cell.fill = fill
            cell.border = border
            cell.alignment = center_align()
            cell.font = body_font()

        # Growth colour
        growth_cell = ws_detail.cell(row=row_idx, column=7)
        if b["growth_pct"] > 0:
            growth_cell.font = Font(bold=True, color=TEAL_HEX, name="Calibri", size=10)
        elif b["growth_pct"] < 0:
            growth_cell.font = Font(bold=True, color=RED_HEX, name="Calibri", size=10)

        # Inv health colour
        health_cell = ws_detail.cell(row=row_idx, column=9)
        if b["inventory_health"] < 70:
            health_cell.font = Font(bold=True, color=AMBER_HEX, name="Calibri", size=10)

    ws_detail.row_dimensions[1].height = 30
    ws_detail.freeze_panes = "A2"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


class ExportExcelView(APIView):
    """POST /api/benchmarks/export/excel/ — returns an Excel file."""
    permission_classes = [IsAdmin]

    def post(self, request):
        body = request.data
        date_from, date_to = _parse_date_range(body)
        outlets = Outlet.objects.filter(status=Outlet.Status.APPROVED).select_related("owner")
        city = body.get("city", "")
        if city:
            outlets = outlets.filter(city__icontains=city)
        outlet_ids = body.get("outlet_ids", [])
        if outlet_ids:
            outlets = outlets.filter(id__in=outlet_ids)

        benchmarks = _build_outlet_benchmarks(list(outlets), date_from, date_to)
        network_total_sales = sum(b["total_sales"] for b in benchmarks)
        network_avg_daily = network_total_sales / max(1, (date_to - date_from).days + 1)
        network_avg_health = round(
            sum(b["inventory_health"] for b in benchmarks) / len(benchmarks), 1
        ) if benchmarks else 100.0

        network_totals = {
            "total_sales": round(network_total_sales, 2),
            "avg_daily_sales": round(network_avg_daily, 2),
            "outlet_count": len(benchmarks),
            "avg_inventory_health": network_avg_health,
            "top_outlet": benchmarks[0]["outlet_name"] if benchmarks else "-",
        }

        buf = _generate_excel(benchmarks, date_from, date_to, network_totals)
        filename = f"Chainhub_Report_{date_from}_{date_to}.xlsx"
        response = HttpResponse(
            buf.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response


class PublishReportView(APIView):
    """
    POST /api/benchmarks/publish/
    Generates the report files, saves them to media, then creates an Announcement
    linking to the PDF/Excel files.
    Body: { title, message, date_from, date_to, city, outlet_ids, target_all, target_outlet_ids }
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        body = request.data
        title = body.get("title", "Network Performance Report")
        message = body.get("message", "")
        date_from, date_to = _parse_date_range(body)
        target_all = body.get("target_all", True)
        target_outlet_ids = body.get("target_outlet_ids", [])

        # Build data
        outlets = Outlet.objects.filter(status=Outlet.Status.APPROVED).select_related("owner")
        city = body.get("city", "")
        if city:
            outlets = outlets.filter(city__icontains=city)
        filter_outlet_ids = body.get("outlet_ids", [])
        if filter_outlet_ids:
            outlets = outlets.filter(id__in=filter_outlet_ids)

        benchmarks = _build_outlet_benchmarks(list(outlets), date_from, date_to)
        network_total_sales = sum(b["total_sales"] for b in benchmarks)
        network_avg_daily = network_total_sales / max(1, (date_to - date_from).days + 1)
        network_avg_health = round(
            sum(b["inventory_health"] for b in benchmarks) / len(benchmarks), 1
        ) if benchmarks else 100.0

        network_totals = {
            "total_sales": round(network_total_sales, 2),
            "avg_daily_sales": round(network_avg_daily, 2),
            "outlet_count": len(benchmarks),
            "avg_inventory_health": network_avg_health,
            "top_outlet": benchmarks[0]["outlet_name"] if benchmarks else "-",
        }

        from django.core.files.base import ContentFile

        # Generate and save PDF
        pdf_buf = _generate_pdf(benchmarks, date_from, date_to, network_totals)
        pdf_filename = f"Chainhub_Report_{date_from}_{date_to}.pdf"
        pdf_content = ContentFile(pdf_buf.read(), name=pdf_filename)

        # Generate and save Excel
        xlsx_buf = _generate_excel(benchmarks, date_from, date_to, network_totals)
        xlsx_filename = f"Chainhub_Report_{date_from}_{date_to}.xlsx"
        xlsx_content = ContentFile(xlsx_buf.read(), name=xlsx_filename)

        # Create announcement
        ann = Announcement.objects.create(
            title=title,
            message=message,
            created_by=request.user,
            target_all=target_all,
            report_type="benchmarking",
        )
        ann.attachment_pdf.save(pdf_filename, pdf_content, save=True)
        ann.attachment_excel.save(xlsx_filename, xlsx_content, save=True)

        if not target_all and target_outlet_ids:
            ann.target_outlets.set(Outlet.objects.filter(id__in=target_outlet_ids))

        return Response({
            "detail": "Report published as network announcement.",
            "announcement_id": ann.id,
        }, status=status.HTTP_201_CREATED)
