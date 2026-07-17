from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = (
    ROOT
    / "samples"
    / "broken-submission"
    / "docs"
    / "technical-overview_FINAL_v3.pdf"
)

NAVY = colors.HexColor("#102438")
TEAL = colors.HexColor("#19B6A5")
PALE = colors.HexColor("#EAF7F5")
INK = colors.HexColor("#17212B")
MUTED = colors.HexColor("#5D6975")
LINE = colors.HexColor("#D6DEE5")


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 15 * mm, width, 15 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(18 * mm, height - 9.5 * mm, "CROSSREADY / TECHNICAL OVERVIEW")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 10 * mm, "Fictional demo fixture - intentionally stale")
    page_text = f"Page {doc.page}"
    canvas.drawRightString(width - 18 * mm, 10 * mm, page_text)
    if doc.page == 2:
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica", 8)
        canvas.drawString(
            18 * mm,
            16 * mm,
            "Public demo URL verified and reviewer access confirmed.",
        )
    canvas.restoreState()


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="Hero",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=32,
        textColor=NAVY,
        alignment=TA_LEFT,
        spaceAfter=5 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="Kicker",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=TEAL,
        spaceAfter=2 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="Section",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=NAVY,
        spaceBefore=4 * mm,
        spaceAfter=3 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="BodyMuted",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=15,
        textColor=MUTED,
    )
)


def metric_card(value, label):
    table = Table(
        [
            [Paragraph(f"<b>{value}</b>", styles["Hero"])],
            [Paragraph(label, styles["BodyMuted"])],
        ],
        colWidths=[52 * mm],
        rowHeights=[18 * mm, 12 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE),
                ("BOX", (0, 0), (-1, -1), 0.8, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return table


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        title="CrossReady Technical Overview v2.1",
        author="CrossReady Demo Fixture",
        subject="Intentionally stale technical report for consistency auditing",
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=24 * mm,
        bottomMargin=18 * mm,
    )

    metric_grid = Table(
        [
            [
                metric_card("94%", "Contradiction recall"),
                metric_card("80", "Evaluated packages"),
                metric_card("5", "Artifact types"),
            ]
        ],
        colWidths=[56 * mm, 56 * mm, 56 * mm],
        hAlign="LEFT",
    )
    metric_grid.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    pipeline_table = Table(
        [
            ["Stage", "Implementation", "Authority"],
            ["Inventory", "ZIP traversal and file metadata", "Deterministic"],
            ["Integrity", "SHA-256 comparison", "Deterministic"],
            ["Semantic audit", "gpt-4.1-mini", "Model extracted"],
            ["Evidence graph", "Disabled", "Not available"],
        ],
        colWidths=[38 * mm, 86 * mm, 44 * mm],
        repeatRows=1,
    )
    pipeline_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("LEADING", (0, 0), (-1, -1), 12),
                ("GRID", (0, 0), (-1, -1), 0.6, LINE),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )

    story = [
        Paragraph("ARCHIVED RELEASE / 2026-07-16", styles["Kicker"]),
        Paragraph("CrossReady Technical Overview", styles["Hero"]),
        Paragraph(
            "<b>Document version 2.1</b> - prepared before the final evaluation run.",
            styles["BodyMuted"],
        ),
        Spacer(1, 8 * mm),
        Paragraph("Evaluation snapshot", styles["Section"]),
        metric_grid,
        Spacer(1, 8 * mm),
        Paragraph("What this release verifies", styles["Section"]),
        Paragraph(
            "Version 2.1 compares rules, repository text, PDF content, HTML "
            "snapshots, and final submission copy. It presents an exportable "
            "summary after the audit completes.",
            styles["BodyText"],
        ),
        Spacer(1, 5 * mm),
        Paragraph("Release note", styles["Section"]),
        Paragraph(
            "The Evidence Graph remains disabled in this archived build. "
            "Version 3.0 is planned to add graph navigation and the expanded "
            "eight-artifact evaluation.",
            styles["BodyText"],
        ),
        PageBreak(),
        Paragraph("IMPLEMENTATION SNAPSHOT", styles["Kicker"]),
        Paragraph("Audit pipeline", styles["Hero"]),
        Paragraph(
            "This archived configuration uses the model shown below for "
            "semantic comparison. Hash verification and archive inventory are "
            "computed deterministically.",
            styles["BodyText"],
        ),
        Spacer(1, 7 * mm),
        pipeline_table,
        Spacer(1, 8 * mm),
        Paragraph("Known limitations", styles["Section"]),
        Paragraph(
            "This archived report is not the final release record. It does not "
            "demonstrate a public deployment, narrated video, or Evidence Graph.",
            styles["BodyText"],
        ),
    ]

    document.build(story, onFirstPage=header_footer, onLaterPages=header_footer)

    size = OUTPUT.stat().st_size
    label = OUTPUT.relative_to(ROOT)
    print(f"Generated {label} ({size} bytes)")


if __name__ == "__main__":
    build()
