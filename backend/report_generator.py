"""
Netraith Incident Report Generator
Generates a professional PDF incident report using reportlab.
POST /api/report/generate
GET  /api/report/latest
"""

import io
import os
import sqlite3
import json
from datetime import datetime, timezone
from collections import Counter

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

DB_PATH = os.environ.get("NETRAITH_DB", "netraith.db")

# ── Color palette ─────────────────────────────────────────────────────────────
C_BG      = colors.HexColor('#000814')
C_CYAN    = colors.HexColor('#00FFD4')
C_TEAL    = colors.HexColor('#00D4C8')
C_RED     = colors.HexColor('#FF3A3A')
C_ORANGE  = colors.HexColor('#FF6B00')
C_YELLOW  = colors.HexColor('#FFD700')
C_WHITE   = colors.HexColor('#E0F0F0')
C_DIM     = colors.HexColor('#4a7070')
C_PANEL   = colors.HexColor('#001830')
C_BORDER  = colors.HexColor('#004040')

# ── Styles ────────────────────────────────────────────────────────────────────
def make_styles():
    return {
        'title': ParagraphStyle('title',
            fontName='Helvetica-Bold', fontSize=22, textColor=C_CYAN,
            spaceAfter=4, alignment=TA_LEFT),
        'subtitle': ParagraphStyle('subtitle',
            fontName='Helvetica', fontSize=9, textColor=C_DIM,
            spaceAfter=2, alignment=TA_LEFT),
        'section': ParagraphStyle('section',
            fontName='Helvetica-Bold', fontSize=11, textColor=C_CYAN,
            spaceBefore=14, spaceAfter=6),
        'body': ParagraphStyle('body',
            fontName='Helvetica', fontSize=9, textColor=C_WHITE,
            spaceAfter=4, leading=14),
        'mono': ParagraphStyle('mono',
            fontName='Courier', fontSize=8, textColor=C_TEAL,
            spaceAfter=2, leading=12),
        'label': ParagraphStyle('label',
            fontName='Helvetica-Bold', fontSize=8, textColor=C_DIM,
            spaceAfter=1),
        'critical': ParagraphStyle('critical',
            fontName='Helvetica-Bold', fontSize=9, textColor=C_RED),
        'high': ParagraphStyle('high',
            fontName='Helvetica-Bold', fontSize=9, textColor=C_ORANGE),
        'medium': ParagraphStyle('medium',
            fontName='Helvetica-Bold', fontSize=9, textColor=C_YELLOW),
        'summary_num': ParagraphStyle('summary_num',
            fontName='Helvetica-Bold', fontSize=28, textColor=C_CYAN,
            alignment=TA_CENTER, spaceAfter=2),
        'summary_lbl': ParagraphStyle('summary_lbl',
            fontName='Helvetica', fontSize=7, textColor=C_DIM,
            alignment=TA_CENTER),
        'footer': ParagraphStyle('footer',
            fontName='Helvetica', fontSize=7, textColor=C_DIM,
            alignment=TA_CENTER),
    }

# ── Data fetching ─────────────────────────────────────────────────────────────
def _fetch_data():
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row

            alerts = [dict(r) for r in conn.execute(
                "SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 200"
            ).fetchall()]

            blocked = [dict(r) for r in conn.execute(
                "SELECT * FROM blocked_ips WHERE unblocked=0 ORDER BY blocked_at DESC"
            ).fetchall()]

            ai_explanations = [dict(r) for r in conn.execute(
                "SELECT * FROM ai_explanations ORDER BY created_at DESC LIMIT 3"
            ).fetchall()]

        return alerts, blocked, ai_explanations
    except Exception as e:
        return [], [], []

def _sev_color(s: str):
    s = (s or '').lower()
    if s == 'critical': return C_RED
    if s == 'high':     return C_ORANGE
    if s == 'medium':   return C_YELLOW
    return C_TEAL

# ── Report builder ────────────────────────────────────────────────────────────
def generate_report() -> bytes:
    alerts, blocked, ai_explanations = _fetch_data()
    styles  = make_styles()
    buf     = io.BytesIO()
    W, H    = A4

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=16*mm, bottomMargin=16*mm,
    )

    story = []
    now   = datetime.now(timezone.utc)

    # ── PAGE BACKGROUND via canvas callback ───────────────────────────────────
    def bg_canvas(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(C_BG)
        canvas.rect(0, 0, W, H, fill=1, stroke=0)
        # Top accent bar
        canvas.setFillColor(C_CYAN)
        canvas.rect(0, H - 3, W, 3, fill=1, stroke=0)
        # Bottom bar
        canvas.setFillColor(C_BORDER)
        canvas.rect(0, 0, W, 1.5, fill=1, stroke=0)
        # Footer text
        canvas.setFillColor(C_DIM)
        canvas.setFont('Helvetica', 7)
        canvas.drawString(18*mm, 8*mm, f'NETRAITH INCIDENT REPORT — CONFIDENTIAL — Generated {now.strftime("%Y-%m-%d %H:%M UTC")}')
        canvas.drawRightString(W - 18*mm, 8*mm, f'Page {doc.page}')
        canvas.restoreState()

    # ── HEADER ────────────────────────────────────────────────────────────────
    story.append(Paragraph("NETRAITH", styles['title']))
    story.append(Paragraph("SECURITY INCIDENT REPORT", ParagraphStyle('st2',
        fontName='Helvetica-Bold', fontSize=13, textColor=C_TEAL, spaceAfter=2)))
    story.append(Paragraph(
        f"Generated: {now.strftime('%A, %d %B %Y at %H:%M UTC')}  |  Classification: CONFIDENTIAL",
        styles['subtitle']))
    story.append(HRFlowable(width='100%', thickness=1, color=C_BORDER, spaceAfter=12))

    # ── EXECUTIVE SUMMARY KPI boxes ───────────────────────────────────────────
    total     = len(alerts)
    critical  = sum(1 for a in alerts if a.get('severity') == 'critical')
    high      = sum(1 for a in alerts if a.get('severity') == 'high')
    medium    = sum(1 for a in alerts if a.get('severity') == 'medium')
    n_blocked = len(blocked)
    unique_ips = len(set(a.get('src_ip','') for a in alerts))

    kpi_data = [
        [
            Paragraph(str(total),     styles['summary_num']),
            Paragraph(str(critical),  ParagraphStyle('k2', fontName='Helvetica-Bold', fontSize=28, textColor=C_RED, alignment=TA_CENTER)),
            Paragraph(str(high),      ParagraphStyle('k3', fontName='Helvetica-Bold', fontSize=28, textColor=C_ORANGE, alignment=TA_CENTER)),
            Paragraph(str(n_blocked), ParagraphStyle('k4', fontName='Helvetica-Bold', fontSize=28, textColor=C_YELLOW, alignment=TA_CENTER)),
            Paragraph(str(unique_ips),styles['summary_num']),
        ],
        [
            Paragraph('TOTAL ALERTS',   styles['summary_lbl']),
            Paragraph('CRITICAL',        styles['summary_lbl']),
            Paragraph('HIGH',            styles['summary_lbl']),
            Paragraph('IPs BLOCKED',     styles['summary_lbl']),
            Paragraph('UNIQUE SOURCES',  styles['summary_lbl']),
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[33*mm]*5)
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), C_PANEL),
        ('BOX',        (0,0), (-1,-1), 1, C_BORDER),
        ('INNERGRID',  (0,0), (-1,-1), 0.5, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('ALIGN',      (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 12))

    # ── EXECUTIVE SUMMARY TEXT ────────────────────────────────────────────────
    story.append(Paragraph("EXECUTIVE SUMMARY", styles['section']))
    crit_pct  = round(critical / total * 100) if total > 0 else 0
    cat_counts = Counter(a.get('category','Unknown') for a in alerts)
    top_cat   = cat_counts.most_common(1)[0][0] if cat_counts else 'N/A'
    summary_text = (
        f"Netraith detected <b>{total} security alerts</b> during the monitoring period. "
        f"Of these, <font color='#FF3A3A'><b>{critical} ({crit_pct}%) were classified as CRITICAL severity</b></font>, "
        f"{high} as HIGH, and {medium} as MEDIUM. "
        f"The most prevalent attack category was <b>{top_cat}</b>. "
        f"The automated firewall engine blocked <b>{n_blocked} malicious IP addresses</b> via iptables rules. "
        f"A total of <b>{unique_ips} unique source IPs</b> were identified across all alerts."
    )
    story.append(Paragraph(summary_text, styles['body']))
    story.append(Spacer(1, 8))

    # ── SEVERITY BREAKDOWN ────────────────────────────────────────────────────
    story.append(Paragraph("SEVERITY BREAKDOWN", styles['section']))
    sev_data = [
        ['SEVERITY', 'COUNT', 'PERCENTAGE', 'VISUAL'],
    ]
    for sev, count, col in [
        ('CRITICAL', critical, C_RED),
        ('HIGH',     high,     C_ORANGE),
        ('MEDIUM',   medium,   C_YELLOW),
        ('LOW',      total - critical - high - medium, C_TEAL),
    ]:
        pct = round(count / total * 100) if total > 0 else 0
        bar = '█' * (pct // 5) + '░' * (20 - pct // 5)
        sev_data.append([
            Paragraph(f'<b>{sev}</b>', ParagraphStyle('sv', fontName='Helvetica-Bold', fontSize=9, textColor=col)),
            Paragraph(str(count), ParagraphStyle('sv2', fontName='Helvetica-Bold', fontSize=9, textColor=col, alignment=TA_CENTER)),
            Paragraph(f'{pct}%', ParagraphStyle('sv3', fontName='Helvetica', fontSize=9, textColor=C_WHITE, alignment=TA_CENTER)),
            Paragraph(f'<font color="#{col.hexval()[2:]}">{bar}</font>', ParagraphStyle('bar', fontName='Courier', fontSize=7, textColor=col)),
        ])
    sev_table = Table(sev_data, colWidths=[35*mm, 25*mm, 30*mm, 80*mm])
    sev_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0),  C_BORDER),
        ('BACKGROUND', (0,1), (-1,-1), C_PANEL),
        ('TEXTCOLOR',  (0,0), (-1,0),  C_CYAN),
        ('FONTNAME',   (0,0), (-1,0),  'Helvetica-Bold'),
        ('FONTSIZE',   (0,0), (-1,0),  8),
        ('GRID',       (0,0), (-1,-1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [C_PANEL, colors.HexColor('#001020')]),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(sev_table)
    story.append(Spacer(1, 8))

    # ── TOP ATTACK CATEGORIES ─────────────────────────────────────────────────
    story.append(Paragraph("TOP ATTACK CATEGORIES", styles['section']))
    cat_data = [['CATEGORY', 'COUNT', 'SEVERITY DISTRIBUTION']]
    for cat, cnt in cat_counts.most_common(8):
        cat_alerts = [a for a in alerts if a.get('category') == cat]
        c_crit = sum(1 for a in cat_alerts if a.get('severity') == 'critical')
        c_high = sum(1 for a in cat_alerts if a.get('severity') == 'high')
        dist = f"Critical: {c_crit}  |  High: {c_high}  |  Other: {cnt - c_crit - c_high}"
        cat_data.append([
            Paragraph(cat[:45], styles['body']),
            Paragraph(str(cnt), ParagraphStyle('cn', fontName='Helvetica-Bold', fontSize=9,
                textColor=C_RED if c_crit > 0 else C_ORANGE, alignment=TA_CENTER)),
            Paragraph(dist, styles['mono']),
        ])
    cat_table = Table(cat_data, colWidths=[75*mm, 20*mm, 75*mm])
    cat_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0),  C_BORDER),
        ('TEXTCOLOR',  (0,0), (-1,0),  C_CYAN),
        ('FONTNAME',   (0,0), (-1,0),  'Helvetica-Bold'),
        ('FONTSIZE',   (0,0), (-1,0),  8),
        ('GRID',       (0,0), (-1,-1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [C_PANEL, colors.HexColor('#001020')]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('ALIGN', (1,0), (1,-1), 'CENTER'),
    ]))
    story.append(cat_table)
    story.append(Spacer(1, 8))

    # ── RECENT CRITICAL ALERTS ────────────────────────────────────────────────
    story.append(Paragraph("RECENT CRITICAL ALERTS", styles['section']))
    crit_alerts = [a for a in alerts if a.get('severity') == 'critical'][:10]
    if crit_alerts:
        alert_data = [['TIME', 'SOURCE IP', 'SIGNATURE', 'CATEGORY', 'ACTION']]
        for a in crit_alerts:
            ts = a.get('timestamp','')[:19].replace('T',' ')
            alert_data.append([
                Paragraph(ts[11:19], styles['mono']),
                Paragraph(a.get('src_ip','N/A'), ParagraphStyle('ip', fontName='Courier', fontSize=8, textColor=C_RED)),
                Paragraph((a.get('signature','')[:40] + '...' if len(a.get('signature','')) > 40 else a.get('signature','')), styles['mono']),
                Paragraph(a.get('category','')[:25], styles['body']),
                Paragraph(a.get('action','').upper(), ParagraphStyle('act', fontName='Helvetica-Bold', fontSize=8, textColor=C_ORANGE if a.get('action') == 'blocked' else C_YELLOW)),
            ])
        alert_table = Table(alert_data, colWidths=[18*mm, 30*mm, 65*mm, 40*mm, 17*mm])
        alert_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0),  C_BORDER),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#100010')),
            ('TEXTCOLOR',  (0,0), (-1,0),  C_CYAN),
            ('FONTNAME',   (0,0), (-1,0),  'Helvetica-Bold'),
            ('FONTSIZE',   (0,0), (-1,0),  7),
            ('GRID',       (0,0), (-1,-1), 0.5, C_BORDER),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#100010'), C_PANEL]),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('FONTSIZE',   (0,1), (-1,-1), 7),
        ]))
        story.append(alert_table)
    story.append(Spacer(1, 8))

    # ── BLOCKED IPs ───────────────────────────────────────────────────────────
    if blocked:
        story.append(Paragraph("FIREWALL — BLOCKED IP ADDRESSES", styles['section']))
        block_data = [['IP ADDRESS', 'SEVERITY', 'SIGNATURE', 'BLOCKED AT']]
        for b in blocked[:15]:
            block_data.append([
                Paragraph(b.get('ip',''), ParagraphStyle('bip', fontName='Courier', fontSize=8, textColor=C_RED)),
                Paragraph(b.get('severity','').upper(), ParagraphStyle('bs', fontName='Helvetica-Bold', fontSize=8, textColor=_sev_color(b.get('severity','')))),
                Paragraph((b.get('signature','')[:45] + '...' if len(b.get('signature','')) > 45 else b.get('signature','')), styles['mono']),
                Paragraph(b.get('blocked_at','')[:19].replace('T',' '), styles['mono']),
            ])
        block_table = Table(block_data, colWidths=[32*mm, 22*mm, 80*mm, 36*mm])
        block_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0),  colors.HexColor('#300000')),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#100005')),
            ('TEXTCOLOR',  (0,0), (-1,0),  C_RED),
            ('FONTNAME',   (0,0), (-1,0),  'Helvetica-Bold'),
            ('FONTSIZE',   (0,0), (-1,0),  8),
            ('GRID',       (0,0), (-1,-1), 0.5, colors.HexColor('#400020')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#100005'), C_PANEL]),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(block_table)
        story.append(Spacer(1, 8))

    # ── TOP SOURCE IPs ────────────────────────────────────────────────────────
    story.append(Paragraph("TOP THREAT SOURCES", styles['section']))
    ip_counts = Counter(a.get('src_ip','') for a in alerts if a.get('src_ip'))
    ip_data = [['RANK', 'IP ADDRESS', 'ALERT COUNT', 'MAX SEVERITY', 'STATUS']]
    for i, (ip, cnt) in enumerate(ip_counts.most_common(10), 1):
        ip_alerts = [a for a in alerts if a.get('src_ip') == ip]
        max_sev   = 'critical' if any(a.get('severity')=='critical' for a in ip_alerts) else \
                    'high'     if any(a.get('severity')=='high'     for a in ip_alerts) else 'medium'
        is_blocked_ip = any(b.get('ip') == ip for b in blocked)
        ip_data.append([
            Paragraph(f'#{i}', styles['body']),
            Paragraph(ip, ParagraphStyle('tip', fontName='Courier', fontSize=8, textColor=_sev_color(max_sev))),
            Paragraph(str(cnt), ParagraphStyle('tc', fontName='Helvetica-Bold', fontSize=9, textColor=_sev_color(max_sev), alignment=TA_CENTER)),
            Paragraph(max_sev.upper(), ParagraphStyle('ts', fontName='Helvetica-Bold', fontSize=8, textColor=_sev_color(max_sev))),
            Paragraph('BLOCKED' if is_blocked_ip else 'ACTIVE', ParagraphStyle('tst', fontName='Helvetica-Bold', fontSize=8,
                textColor=C_RED if is_blocked_ip else C_ORANGE)),
        ])
    ip_table = Table(ip_data, colWidths=[15*mm, 40*mm, 30*mm, 35*mm, 30*mm+10*mm])
    ip_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0),  C_BORDER),
        ('TEXTCOLOR',  (0,0), (-1,0),  C_CYAN),
        ('FONTNAME',   (0,0), (-1,0),  'Helvetica-Bold'),
        ('FONTSIZE',   (0,0), (-1,0),  8),
        ('GRID',       (0,0), (-1,-1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [C_PANEL, colors.HexColor('#001020')]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('ALIGN', (2,0), (2,-1), 'CENTER'),
    ]))
    story.append(ip_table)
    story.append(Spacer(1, 8))

    # ── AI THREAT ASSESSMENTS ─────────────────────────────────────────────────
    if ai_explanations:
        story.append(Paragraph("AI THREAT ASSESSMENTS (CLAUDE)", styles['section']))
        story.append(Paragraph(
            "The following threat assessments were generated by Claude AI for the most critical alerts:",
            styles['body']))
        story.append(Spacer(1, 6))
        for exp in ai_explanations[:2]:
            text = exp.get('explanation','')[:800]
            story.append(KeepTogether([
                Table([[Paragraph(text, ParagraphStyle('ai', fontName='Helvetica', fontSize=8,
                    textColor=C_WHITE, leading=13, spaceAfter=0))]],
                    colWidths=[170*mm],
                    style=TableStyle([
                        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#001830')),
                        ('BOX', (0,0), (-1,-1), 1, C_CYAN),
                        ('TOPPADDING', (0,0), (-1,-1), 8),
                        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                        ('LEFTPADDING', (0,0), (-1,-1), 10),
                        ('RIGHTPADDING', (0,0), (-1,-1), 10),
                    ])
                ),
                Spacer(1, 6)
            ]))

    # ── RECOMMENDATIONS ───────────────────────────────────────────────────────
    story.append(Paragraph("SECURITY RECOMMENDATIONS", styles['section']))
    recs = []
    if critical > 5:
        recs.append("IMMEDIATE: Multiple critical alerts detected. Review and harden firewall rules urgently.")
    if n_blocked > 0:
        recs.append(f"VERIFY: {n_blocked} IPs have been auto-blocked. Confirm blocks are appropriate and no false positives.")
    if any('SQL' in (a.get('category','')) for a in alerts):
        recs.append("WEB SECURITY: SQL injection attempts detected. Review WAF rules and application input validation.")
    if any('DDoS' in (a.get('category','')) or 'Denial' in (a.get('category','')) for a in alerts):
        recs.append("DDoS PROTECTION: Enable rate limiting and consider upstream DDoS mitigation service.")
    if any('Malware' in (a.get('category','')) or 'C2' in (a.get('category','')) for a in alerts):
        recs.append("MALWARE: C2/Malware traffic detected. Isolate affected systems and run endpoint scans immediately.")
    if any('Insider' in (a.get('category','')) for a in alerts):
        recs.append("INSIDER THREAT: Anomalous internal activity detected. Review user access logs and permissions.")
    if not recs:
        recs.append("System appears stable. Continue monitoring and maintain current security posture.")

    rec_data = [[
        Paragraph(f'{i+1}. {rec}', styles['body'])
    ] for i, rec in enumerate(recs)]
    rec_table = Table(rec_data, colWidths=[170*mm])
    rec_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), C_PANEL),
        ('GRID',       (0,0), (-1,-1), 0.5, C_BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [C_PANEL, colors.HexColor('#001020')]),
    ]))
    story.append(rec_table)
    story.append(Spacer(1, 12))

    # ── FOOTER NOTE ───────────────────────────────────────────────────────────
    story.append(HRFlowable(width='100%', thickness=1, color=C_BORDER, spaceAfter=8))
    story.append(Paragraph(
        "This report was automatically generated by Netraith — Real-Time Intrusion & Insider Threat Detection System. "
        "Powered by Suricata IDS, Claude AI, and Bayesian threat prediction. "
        "All data sourced from live network monitoring.",
        styles['footer']
    ))

    doc.build(story, onFirstPage=bg_canvas, onLaterPages=bg_canvas)
    return buf.getvalue()