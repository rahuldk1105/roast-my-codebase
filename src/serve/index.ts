import http from 'http';
import chokidar from 'chokidar';
import { RoastReport, Finding } from '../types/index.js';

// ── Color constants (matching existing html.ts theme) ──────────────────────
const COLORS = {
  bg: '#0d1117',
  card: '#161b22',
  border: '#30363d',
  text: '#e6edf3',
  dim: '#8b949e',
  critical: '#f85149',
  warning: '#e3b341',
  info: '#79c0ff',
  success: '#3fb950',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function _escapeJs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function getScoreColor(score: number): string {
  if (score >= 80) return COLORS.success;
  if (score >= 60) return COLORS.warning;
  return COLORS.critical;
}

function renderGaugeSvg(score: number): string {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const halfCirc = circumference / 2;
  const filled = (score / 100) * halfCirc;
  const color = getScoreColor(score);

  return `<svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" aria-label="Health score gauge: ${score}">
      <path d="M 10 64 A 54 54 0 0 1 110 64" fill="none" stroke="${COLORS.border}" stroke-width="10" stroke-linecap="round"/>
      <path d="M 10 64 A 54 54 0 0 1 110 64" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${filled.toFixed(2)} ${(halfCirc - filled).toFixed(2)}" pathLength="${halfCirc.toFixed(2)}"/>
    </svg>`;
}

function renderDonutChart(critical: number, warning: number, info: number): string {
  const total = critical + warning + info;
  if (total === 0) {
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="width:120px;height:120px">
      <circle cx="60" cy="60" r="40" fill="none" stroke="${COLORS.border}" stroke-width="18"/>
      <text x="60" y="60" text-anchor="middle" dominant-baseline="middle" fill="${COLORS.dim}" font-size="14" font-weight="700">0</text>
    </svg>`;
  }

  const r = 40;
  const cx = 60;
  const cy = 60;
  const circ = 2 * Math.PI * r;

  // Build arcs: critical → warning → info
  const segments: { count: number; color: string }[] = [
    { count: critical, color: COLORS.critical },
    { count: warning, color: COLORS.warning },
    { count: info, color: COLORS.info },
  ];

  let arcs = '';
  let offset = 0;

  for (const seg of segments) {
    if (seg.count === 0) continue;
    const pct = seg.count / total;
    const dash = pct * circ;
    const gap = circ - dash;
    arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="18"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${(-offset * circ / circ * circ + circ / 4).toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})"
      style="stroke-dashoffset: ${(-offset * circ + circ * 0.25).toFixed(2)}"/>`;
    offset += pct * circ;
  }

  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="width:120px;height:120px">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${COLORS.border}" stroke-width="18"/>
      ${arcs}
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="${COLORS.text}" font-size="18" font-weight="800">${total}</text>
    </svg>`;
}

function renderCategoryBarChart(findings: Finding[]): string {
  if (findings.length === 0) return '<p style="color:' + COLORS.dim + ';font-style:italic">No findings to chart.</p>';

  // Count by category
  const counts: Record<string, number> = {};
  for (const f of findings) {
    counts[f.category] = (counts[f.category] ?? 0) + 1;
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const max = sorted[0][1];
  const bars = sorted.map(([cat, count]) => {
    const pct = Math.round((count / max) * 100);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <div style="width:130px;font-size:11px;color:${COLORS.dim};text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0">${escapeHtml(cat)}</div>
      <div style="flex:1;height:16px;background:${COLORS.border};border-radius:4px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:#58a6ff;border-radius:4px;transition:width 0.3s"></div>
      </div>
      <div style="width:28px;font-size:12px;font-weight:700;color:${COLORS.text}">${count}</div>
    </div>`;
  }).join('');

  return `<div style="padding:4px 0">${bars}</div>`;
}

/**
 * Serialize the report to JSON safe for embedding inside a <script> tag.
 * JSON.stringify is safe for encoding, but the resulting string may contain
 * '</script>' or '<!--' which the HTML parser treats as tag boundaries even
 * inside a script element.  Replace the dangerous characters with their
 * Unicode escape equivalents — valid JS that produces identical runtime values.
 */
function serializeReportForJs(report: RoastReport): string {
  const raw = JSON.stringify(report);
  let safe = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '<')  { safe += '\\u003c'; }
    else if (ch === '>') { safe += '\\u003e'; }
    else if (ch === '&') { safe += '\\u0026'; }
    else if (ch.charCodeAt(0) === 0x2028) { safe += '\\u2028'; }
    else if (ch.charCodeAt(0) === 0x2029) { safe += '\\u2029'; }
    else { safe += ch; }
  }
  return safe;
}

/**
 * Generates a complete, self-contained HTML dashboard for a RoastReport.
 * No external CDN dependencies — all CSS and JS inline.
 */
export function generateDashboardHtml(report: RoastReport): string {
  const scoreColor = getScoreColor(report.health.score);
  const criticals = report.findings.filter(f => f.severity === 'critical').length;
  const warnings = report.findings.filter(f => f.severity === 'warning').length;
  const infos = report.findings.filter(f => f.severity === 'info').length;

  const categories = Array.from(new Set(report.findings.map(f => f.category))).sort();

  const reportJson = serializeReportForJs(report);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>🔥 Roast Dashboard — ${escapeHtml(report.projectName)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background: ${COLORS.bg};
      color: ${COLORS.text};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      min-height: 100vh;
      padding-top: 64px;
    }

    /* ── Fixed header ── */
    .top-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 56px;
      background: ${COLORS.card};
      border-bottom: 1px solid ${COLORS.border};
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 16px;
      z-index: 100;
    }
    .top-bar-logo { font-size: 18px; font-weight: 800; color: ${COLORS.text}; white-space: nowrap; }
    .top-bar-project { font-size: 13px; color: ${COLORS.dim}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .top-bar-center { flex: 1; display: flex; justify-content: center; align-items: center; gap: 10px; }
    .health-badge {
      display: flex; align-items: baseline; gap: 6px;
      background: ${COLORS.bg}; border: 1px solid ${COLORS.border};
      border-radius: 8px; padding: 4px 14px;
    }
    .health-score { font-size: 28px; font-weight: 900; color: ${scoreColor}; line-height: 1; }
    .health-grade { font-size: 13px; font-weight: 700; color: ${scoreColor}; }
    .health-label { font-size: 11px; color: ${COLORS.dim}; }
    .top-bar-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 600;
      padding: 5px 12px; border-radius: 6px; cursor: pointer;
      border: 1px solid ${COLORS.border};
      background: ${COLORS.bg}; color: ${COLORS.dim};
      transition: border-color 0.15s, color 0.15s;
      text-decoration: none;
    }
    .btn:hover { border-color: #8b949e; color: ${COLORS.text}; }
    .btn:disabled { opacity: 0.4; cursor: default; }
    .btn-primary { border-color: #58a6ff; color: #58a6ff; }
    .btn-primary:hover { background: rgba(88,166,255,0.1); }

    /* ── Layout ── */
    .container { max-width: 1100px; margin: 0 auto; padding: 24px 16px 64px; }

    /* ── Stats row ── */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    @media (max-width: 700px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
    .stat-card {
      background: ${COLORS.card}; border: 1px solid ${COLORS.border};
      border-radius: 10px; padding: 16px; text-align: center;
    }
    .stat-val { font-size: 28px; font-weight: 800; color: ${COLORS.text}; display: block; }
    .stat-lbl {
      font-size: 10px; font-weight: 700; letter-spacing: 0.07em;
      text-transform: uppercase; color: ${COLORS.dim}; margin-top: 4px; display: block;
    }

    /* ── Two-column charts ── */
    .charts-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;
    }
    @media (max-width: 700px) { .charts-row { grid-template-columns: 1fr; } }
    .chart-card {
      background: ${COLORS.card}; border: 1px solid ${COLORS.border};
      border-radius: 10px; padding: 20px;
    }
    .chart-title { font-size: 13px; font-weight: 700; color: ${COLORS.text}; margin-bottom: 16px; }
    .gauge-center { display: flex; flex-direction: column; align-items: center; }
    .gauge-center svg { width: 160px; height: 94px; }
    .gauge-score-big { font-size: 48px; font-weight: 900; color: ${scoreColor}; line-height: 1; margin-top: -4px; }
    .gauge-grade-lbl { font-size: 14px; color: ${COLORS.dim}; font-weight: 600; }
    .donut-center { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .donut-legend { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
    .donut-legend-item { display: flex; align-items: center; gap: 5px; font-size: 12px; }
    .donut-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }

    /* ── Findings panel ── */
    .panel {
      background: ${COLORS.card}; border: 1px solid ${COLORS.border};
      border-radius: 10px; padding: 20px; margin-bottom: 20px;
    }
    .panel-title {
      font-size: 15px; font-weight: 700; color: ${COLORS.text};
      margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
    }
    .count-chip {
      font-size: 11px; font-weight: 600; background: ${COLORS.border};
      color: ${COLORS.dim}; border-radius: 20px; padding: 1px 8px;
    }
    .collapse-btn {
      margin-left: auto; background: none; border: none; cursor: pointer;
      color: ${COLORS.dim}; font-size: 13px; padding: 2px 6px;
    }
    .collapse-btn:hover { color: ${COLORS.text}; }

    /* ── Filter bar ── */
    .filter-bar {
      display: flex; gap: 8px; flex-wrap: wrap;
      align-items: center; margin-bottom: 14px;
    }
    .filter-search {
      flex: 1; min-width: 180px;
      background: ${COLORS.bg}; border: 1px solid ${COLORS.border};
      color: ${COLORS.text}; border-radius: 6px; padding: 5px 10px;
      font-size: 13px; outline: none;
    }
    .filter-search:focus { border-color: #58a6ff; }
    .filter-search::placeholder { color: ${COLORS.dim}; }
    .sev-btn {
      background: ${COLORS.bg}; border: 1px solid ${COLORS.border};
      color: ${COLORS.dim}; font-size: 11px; font-weight: 700;
      border-radius: 20px; padding: 3px 11px; cursor: pointer;
      transition: border-color 0.12s, color 0.12s;
    }
    .sev-btn:hover { border-color: #8b949e; color: ${COLORS.text}; }
    .sev-btn.active        { border-color: #58a6ff; color: #58a6ff; }
    .sev-btn.active-crit   { border-color: ${COLORS.critical}; color: ${COLORS.critical}; }
    .sev-btn.active-warn   { border-color: ${COLORS.warning}; color: ${COLORS.warning}; }
    .sev-btn.active-info   { border-color: ${COLORS.info}; color: ${COLORS.info}; }
    .cat-select {
      background: ${COLORS.bg}; border: 1px solid ${COLORS.border};
      color: ${COLORS.dim}; font-size: 12px; border-radius: 6px;
      padding: 4px 8px; cursor: pointer; outline: none;
    }
    .cat-select:focus { border-color: #58a6ff; }
    .showing-label { font-size: 12px; color: ${COLORS.dim}; white-space: nowrap; margin-left: auto; }
    .sort-bar {
      display: flex; gap: 6px; align-items: center;
      margin-bottom: 10px; font-size: 12px; color: ${COLORS.dim};
    }
    .sort-btn {
      background: none; border: 1px solid ${COLORS.border};
      color: ${COLORS.dim}; font-size: 11px; font-weight: 600;
      border-radius: 20px; padding: 2px 10px; cursor: pointer;
    }
    .sort-btn:hover { border-color: #8b949e; color: ${COLORS.text}; }
    .sort-btn.active { border-color: #8b949e; color: ${COLORS.text}; }

    /* ── Findings list ── */
    .findings-list { display: flex; flex-direction: column; gap: 0; }
    .finding-row {
      border-left: 3px solid transparent;
      border-bottom: 1px solid ${COLORS.border};
      padding: 10px 12px; cursor: pointer;
      display: flex; align-items: flex-start; gap: 10px;
      transition: background 0.1s;
    }
    .finding-row:last-child { border-bottom: none; }
    .finding-row:hover { background: rgba(255,255,255,0.025); }
    .finding-row.crit-row { border-left-color: ${COLORS.critical}; }
    .finding-row.warn-row { border-left-color: ${COLORS.warning}; }
    .finding-row.info-row { border-left-color: ${COLORS.info}; }
    .finding-detail {
      display: none; padding: 8px 12px 10px 12px;
      background: ${COLORS.bg}; border-bottom: 1px solid ${COLORS.border};
      font-size: 12px; color: ${COLORS.dim}; white-space: pre-wrap; line-height: 1.6;
    }
    .finding-detail.open { display: block; }
    .sev-badge {
      display: inline-block; font-size: 9px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.05em;
      padding: 2px 7px; border-radius: 20px; flex-shrink: 0; margin-top: 1px;
    }
    .sev-badge.crit { background: rgba(248,81,73,0.18); color: ${COLORS.critical}; border: 1px solid rgba(248,81,73,0.4); }
    .sev-badge.warn { background: rgba(227,179,65,0.18); color: ${COLORS.warning}; border: 1px solid rgba(227,179,65,0.4); }
    .sev-badge.info { background: rgba(121,192,255,0.18); color: ${COLORS.info}; border: 1px solid rgba(121,192,255,0.4); }
    .cat-chip {
      font-size: 10px; font-weight: 700; color: ${COLORS.dim};
      background: ${COLORS.border}; border-radius: 4px; padding: 1px 6px;
      flex-shrink: 0; margin-top: 2px; white-space: nowrap;
    }
    .finding-msg { flex: 1; font-size: 13px; color: ${COLORS.text}; }
    .finding-file {
      font-size: 11px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      color: ${COLORS.dim}; flex-shrink: 0; max-width: 200px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .empty-findings { color: ${COLORS.dim}; font-style: italic; padding: 12px 0; }

    /* ── Roasts section ── */
    .roasts-grid { display: flex; flex-direction: column; gap: 10px; }
    .roast-card {
      display: flex; gap: 12px;
      background: ${COLORS.bg}; border: 1px solid ${COLORS.border};
      border-radius: 8px; padding: 14px;
    }
    .roast-icon { font-size: 20px; flex-shrink: 0; line-height: 1.4; }
    .roast-target { font-size: 13px; font-weight: 700; color: ${COLORS.text}; margin-bottom: 3px; }
    .roast-msg { font-size: 13px; color: #c9d1d9; font-style: italic; line-height: 1.5; }

    /* ── Verdict ── */
    .verdict-block {
      border-left: 3px solid ${COLORS.border}; padding: 14px 18px;
      background: ${COLORS.bg}; border-radius: 0 8px 8px 0;
    }
    .verdict-text { font-size: 16px; font-style: italic; color: #c9d1d9; line-height: 1.7; }

    /* ── Scrollable findings list wrapper ── */
    .findings-scroll { max-height: 520px; overflow-y: auto; border: 1px solid ${COLORS.border}; border-radius: 8px; }
    .findings-scroll::-webkit-scrollbar { width: 6px; }
    .findings-scroll::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
  </style>
</head>
<body>

  <!-- Fixed top bar -->
  <div class="top-bar">
    <div class="top-bar-logo">🔥 Roast My Codebase</div>
    <div class="top-bar-project">${escapeHtml(report.projectName)}</div>
    <div class="top-bar-center">
      <div class="health-badge">
        <span class="health-score">${report.health.score}</span>
        <span class="health-grade">${escapeHtml(report.health.grade)}</span>
        <span class="health-label">${escapeHtml(report.health.label)}</span>
      </div>
    </div>
    <div class="top-bar-actions">
      <button class="btn" id="rescan-btn">↻ Rescan</button>
      <button class="btn btn-primary" id="export-btn">⬇ Export JSON</button>
    </div>
  </div>

  <div class="container">

    <!-- Stats row -->
    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-val">${report.stats.totalFiles.toLocaleString()}</span>
        <span class="stat-lbl">Total Files</span>
      </div>
      <div class="stat-card">
        <span class="stat-val">${report.stats.totalLines.toLocaleString()}</span>
        <span class="stat-lbl">Lines of Code</span>
      </div>
      <div class="stat-card">
        <span class="stat-val">${report.stats.dependencies}</span>
        <span class="stat-lbl">Dependencies</span>
      </div>
      <div class="stat-card">
        <span class="stat-val">${report.findings.length}</span>
        <span class="stat-lbl">Total Findings</span>
      </div>
    </div>

    <!-- Charts row -->
    <div class="charts-row">
      <!-- Gauge -->
      <div class="chart-card">
        <div class="chart-title">Health Score</div>
        <div class="gauge-center">
          ${renderGaugeSvg(report.health.score)}
          <div class="gauge-score-big">${report.health.score}</div>
          <div class="gauge-grade-lbl">Grade: ${escapeHtml(report.health.grade)} — ${escapeHtml(report.health.label)}</div>
        </div>
      </div>
      <!-- Donut -->
      <div class="chart-card">
        <div class="chart-title">Severity Breakdown</div>
        <div class="donut-center">
          ${renderDonutChart(criticals, warnings, infos)}
          <div class="donut-legend">
            <div class="donut-legend-item"><div class="donut-dot" style="background:${COLORS.critical}"></div><span style="color:${COLORS.critical}">${criticals} Critical</span></div>
            <div class="donut-legend-item"><div class="donut-dot" style="background:${COLORS.warning}"></div><span style="color:${COLORS.warning}">${warnings} Warning</span></div>
            <div class="donut-legend-item"><div class="donut-dot" style="background:${COLORS.info}"></div><span style="color:${COLORS.info}">${infos} Info</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Findings panel -->
    <div class="panel">
      <div class="panel-title">
        Findings <span class="count-chip">${report.findings.length}</span>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        <input type="search" class="filter-search" id="search-input" placeholder="Search message or file…" />
        <button class="sev-btn active" data-sev="all" id="sev-all">All</button>
        <button class="sev-btn" data-sev="critical" id="sev-critical">Critical (${criticals})</button>
        <button class="sev-btn" data-sev="warning" id="sev-warning">Warning (${warnings})</button>
        <button class="sev-btn" data-sev="info" id="sev-info">Info (${infos})</button>
        <select class="cat-select" id="cat-select">
          <option value="">All Categories</option>
          ${categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('\n          ')}
        </select>
        <span class="showing-label" id="showing-label">Showing ${report.findings.length} of ${report.findings.length}</span>
      </div>

      <!-- Sort bar -->
      <div class="sort-bar">
        Sort:
        <button class="sort-btn active" data-sort="severity" id="sort-severity">Severity</button>
        <button class="sort-btn" data-sort="category" id="sort-category">Category</button>
        <button class="sort-btn" data-sort="file" id="sort-file">File</button>
      </div>

      <!-- Findings list (scrollable) -->
      <div class="findings-scroll" id="findings-container"></div>
    </div>

    <!-- Roasts section -->
    ${report.roasts.length > 0 ? `<div class="panel">
      <div class="panel-title">
        🔥 Roasts <span class="count-chip">${report.roasts.length}</span>
        <button class="collapse-btn" id="roasts-toggle">▲ Hide</button>
      </div>
      <div id="roasts-body">
        <div class="roasts-grid">
          ${report.roasts.map(r => `<div class="roast-card">
            <div class="roast-icon">🔥</div>
            <div>
              <div class="roast-target">${escapeHtml(r.target)}</div>
              <div class="roast-msg">${escapeHtml(r.message)}</div>
            </div>
          </div>`).join('\n          ')}
        </div>
      </div>
    </div>` : ''}

    <!-- Category bar chart -->
    <div class="panel">
      <div class="panel-title">Category Breakdown <span style="font-size:11px;font-weight:400;color:${COLORS.dim}">(top 10)</span></div>
      ${renderCategoryBarChart(report.findings)}
    </div>

    <!-- Verdict -->
    <div class="panel">
      <div class="panel-title">Verdict</div>
      <div class="verdict-block">
        <p class="verdict-text">&ldquo;${escapeHtml(report.verdict)}&rdquo;</p>
      </div>
    </div>

  </div><!-- /container -->

  <script>
  (function () {
    // ── Report data ──────────────────────────────────────────────────────────
    var REPORT = ${reportJson};
    var allFindings = REPORT.findings || [];

    // ── State ────────────────────────────────────────────────────────────────
    var state = {
      search: '',
      severity: 'all',
      category: '',
      sort: 'severity',
      expanded: {}
    };

    // ── Helpers ──────────────────────────────────────────────────────────────
    function esc(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    var SEV_ORDER = { critical: 0, warning: 1, info: 2 };

    function applyFilters() {
      var q = state.search.toLowerCase();
      var results = allFindings.filter(function (f) {
        if (state.severity !== 'all' && f.severity !== state.severity) return false;
        if (state.category && f.category !== state.category) return false;
        if (q) {
          var msg = (f.message || '').toLowerCase();
          var file = (f.file || '').toLowerCase();
          if (msg.indexOf(q) === -1 && file.indexOf(q) === -1) return false;
        }
        return true;
      });

      // Sort
      results = results.slice().sort(function (a, b) {
        if (state.sort === 'severity') {
          var ao = SEV_ORDER[a.severity] !== undefined ? SEV_ORDER[a.severity] : 99;
          var bo = SEV_ORDER[b.severity] !== undefined ? SEV_ORDER[b.severity] : 99;
          return ao - bo;
        } else if (state.sort === 'category') {
          return (a.category || '').localeCompare(b.category || '');
        } else if (state.sort === 'file') {
          return (a.file || '').localeCompare(b.file || '');
        }
        return 0;
      });

      return results;
    }

    function sevClass(sev) {
      if (sev === 'critical') return 'crit';
      if (sev === 'warning') return 'warn';
      return 'info';
    }

    function rowClass(sev) {
      if (sev === 'critical') return 'crit-row';
      if (sev === 'warning') return 'warn-row';
      return 'info-row';
    }

    function makeEl(tag, classNames, text) {
      var el = document.createElement(tag);
      if (classNames) el.className = classNames;
      if (text != null) el.textContent = text;
      return el;
    }

    function renderFindings(results) {
      var container = document.getElementById('findings-container');
      var showing = document.getElementById('showing-label');
      if (!container) return;

      showing.textContent = 'Showing ' + results.length + ' of ' + allFindings.length;

      // Clear previous content safely — no innerHTML
      while (container.firstChild) { container.removeChild(container.firstChild); }

      if (results.length === 0) {
        var empty = makeEl('p', 'empty-findings', 'No findings match your filters.');
        empty.style.padding = '16px';
        container.appendChild(empty);
        return;
      }

      var list = makeEl('div', 'findings-list', null);

      for (var i = 0; i < results.length; i++) {
        var f = results[i];
        var sc = sevClass(f.severity);
        var rc = rowClass(f.severity);

        // Row
        var row = makeEl('div', 'finding-row ' + rc, null);
        row.setAttribute('data-id', f.id || '');

        var badge = makeEl('span', 'sev-badge ' + sc, f.severity || '');
        var chip  = makeEl('span', 'cat-chip', f.category || '');
        var msg   = makeEl('span', 'finding-msg', f.message || '');
        row.appendChild(badge);
        row.appendChild(chip);
        row.appendChild(msg);

        if (f.file) {
          var fileSp = makeEl('span', 'finding-file', f.file);
          fileSp.title = f.file;
          row.appendChild(fileSp);
        }

        list.appendChild(row);

        // Detail panel (only created when there is something to show)
        if (f.detail || f.file) {
          var detailLines = [];
          if (f.file)   detailLines.push('File: ' + f.file);
          if (f.detail) detailLines.push(f.detail);
          var detailEl = makeEl('div', 'finding-detail' + (state.expanded[f.id] ? ' open' : ''), detailLines.join('\n'));
          detailEl.setAttribute('data-detail-id', f.id || '');
          list.appendChild(detailEl);
        }
      }

      container.appendChild(list);

      // Row click handlers — attach after appending to DOM
      var rows = container.querySelectorAll('.finding-row');
      rows.forEach(function (row) {
        row.addEventListener('click', function () {
          var id = row.getAttribute('data-id');
          state.expanded[id] = !state.expanded[id];
          var detail = container.querySelector('[data-detail-id="' + id + '"]');
          if (detail) {
            detail.classList.toggle('open', !!state.expanded[id]);
          }
        });
      });
    }

    function refresh() {
      renderFindings(applyFilters());
    }

    // ── Search ───────────────────────────────────────────────────────────────
    var searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        state.search = searchInput.value;
        refresh();
      });
    }

    // ── Severity buttons ─────────────────────────────────────────────────────
    var sevBtns = document.querySelectorAll('.sev-btn');
    sevBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.severity = btn.getAttribute('data-sev');
        sevBtns.forEach(function (b) {
          b.classList.remove('active', 'active-crit', 'active-warn', 'active-info');
        });
        if (state.severity === 'all') {
          btn.classList.add('active');
        } else if (state.severity === 'critical') {
          btn.classList.add('active-crit');
        } else if (state.severity === 'warning') {
          btn.classList.add('active-warn');
        } else {
          btn.classList.add('active-info');
        }
        refresh();
      });
    });

    // ── Category select ──────────────────────────────────────────────────────
    var catSelect = document.getElementById('cat-select');
    if (catSelect) {
      catSelect.addEventListener('change', function () {
        state.category = catSelect.value;
        refresh();
      });
    }

    // ── Sort buttons ─────────────────────────────────────────────────────────
    var sortBtns = document.querySelectorAll('.sort-btn');
    sortBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.sort = btn.getAttribute('data-sort');
        sortBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        refresh();
      });
    });

    // ── Export JSON ──────────────────────────────────────────────────────────
    var exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var blob = new Blob([JSON.stringify(REPORT, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'roast-report.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
    }

    // ── Roasts collapse ──────────────────────────────────────────────────────
    var roastsToggle = document.getElementById('roasts-toggle');
    var roastsBody = document.getElementById('roasts-body');
    if (roastsToggle && roastsBody) {
      roastsToggle.addEventListener('click', function () {
        var hidden = roastsBody.style.display === 'none';
        roastsBody.style.display = hidden ? '' : 'none';
        roastsToggle.textContent = hidden ? '▲ Hide' : '▼ Show';
      });
    }

    // ── SSE live reload ──────────────────────────────────────────────────────
    var scanBadge = document.createElement('div');
    scanBadge.id = 'scan-badge';
    scanBadge.style.cssText = 'position:fixed;bottom:16px;right:16px;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:8px 14px;font-size:12px;color:#8b949e;display:none;z-index:9999';
    document.body.appendChild(scanBadge);

    var evtSource = new EventSource('/events');

    evtSource.onmessage = function(e) {
      var data = JSON.parse(e.data);

      if (data.type === 'scanning') {
        scanBadge.textContent = '↻ Rescanning…';
        scanBadge.style.color = '#8b949e';
        scanBadge.style.display = 'block';
      }

      if (data.type === 'update') {
        scanBadge.textContent = '✓ Updated';
        scanBadge.style.color = '#3fb950';
        // Reload the page to get the fresh HTML
        setTimeout(function() { window.location.reload(); }, 400);
      }

      if (data.type === 'error') {
        scanBadge.textContent = '✗ Rescan failed';
        scanBadge.style.color = '#f85149';
        setTimeout(function() { scanBadge.style.display = 'none'; }, 3000);
      }
    };

    evtSource.onerror = function() {
      // SSE connection lost — server probably stopped
      scanBadge.textContent = '○ Disconnected';
      scanBadge.style.color = '#8b949e';
      scanBadge.style.display = 'block';
    };

    // ── Rescan button ────────────────────────────────────────────────────────
    var rescanBtn = document.getElementById('rescan-btn');
    if (rescanBtn) {
      rescanBtn.addEventListener('click', function() {
        rescanBtn.disabled = true;
        rescanBtn.textContent = '↻ Scanning…';
        // POST /rescan to trigger server-side rescan
        fetch('/rescan', { method: 'POST' }).catch(function() {});
        setTimeout(function() {
          rescanBtn.disabled = false;
          rescanBtn.textContent = '↻ Rescan';
        }, 2000);
      });
    }

    // ── Initial render ───────────────────────────────────────────────────────
    refresh();
  })();
  </script>

</body>
</html>`;
}

/**
 * Starts a local HTTP dashboard server.
 * Returns the http.Server instance so callers can close it (e.g. in tests).
 *
 * Routes:
 *   GET /            → HTML dashboard
 *   GET /api/report  → JSON report  (Content-Type: application/json)
 *   GET /health      → {"ok":true}
 *   GET /events      → SSE stream for live reload
 *   POST /rescan     → Trigger manual rescan (requires options.rescan)
 *   *                → 404
 */
export function startDashboard(
  report: RoastReport,
  port: number = 7777,
  options?: { watch?: boolean; rootDir?: string; rescan?: () => Promise<RoastReport> }
): http.Server {
  // Mutable state — updated on each rescan
  let _currentReport = report;
  let currentHtml = generateDashboardHtml(report);
  let _currentReportJson = JSON.stringify(report);

  // SSE client management
  const sseClients = new Set<http.ServerResponse>();

  // Rescan state (hoisted for use in both request handler and watcher)
  let isRescanning = false;

  function broadcast(data: object): void {
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try { client.write(msg); } catch { sseClients.delete(client); }
    }
  }

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';

    // SSE endpoint
    if (req.method === 'GET' && url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write('data: {"type":"connected"}\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // Manual rescan endpoint
    if (req.method === 'POST' && url === '/rescan' && options?.rescan) {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end('{"status":"scanning"}');
      if (!isRescanning) {
        isRescanning = true;
        broadcast({ type: 'scanning', file: 'manual' });
        options.rescan().then(newReport => {
          _currentReport = newReport;
          currentHtml = generateDashboardHtml(newReport);
          _currentReportJson = JSON.stringify(newReport);
          broadcast({ type: 'update', report: newReport });
          isRescanning = false;
        }).catch(() => {
          broadcast({ type: 'error', message: 'Rescan failed' });
          isRescanning = false;
        });
      }
      return;
    }

    if (req.method === 'GET' && url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(currentHtml);
    } else if (req.method === 'GET' && url === '/api/report') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(_currentReportJson);
    } else if (req.method === 'GET' && url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end('{"ok":true}');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });

  // Port conflict handling: try port, port+1, port+2
  const tryListen = (tryPort: number): void => {
    server.listen(tryPort, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      const actualPort = addr.port;
      console.log(`\n✓ Dashboard running at http://localhost:${actualPort}`);
      console.log('  Press Ctrl+C to stop\n');

      // Open browser using the `open` package (audited, no direct shell usage)
      const url = `http://localhost:${actualPort}`;
      import('open').then(mod => mod.default(url)).catch(() => { /* best-effort */ });

      // Start file watcher if requested
      if (options?.watch && options?.rootDir && options?.rescan) {
        const watcher = chokidar.watch(
          ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.go', '**/*.rs', '**/*.java', '**/*.cs', '**/*.rb', '**/*.php', '**/*.swift', '**/*.kt'],
          {
            cwd: options.rootDir,
            ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
            ignoreInitial: true,
            persistent: true,
          }
        );

        let debounceTimer: NodeJS.Timeout | null = null;

        watcher.on('change', (changedPath: string) => {
          if (isRescanning) return;
          if (debounceTimer) clearTimeout(debounceTimer);

          debounceTimer = setTimeout(async () => {
            if (isRescanning) return;
            isRescanning = true;

            // Notify clients: scanning started
            broadcast({ type: 'scanning', file: changedPath });

            try {
              const newReport = await options.rescan!();
              // Update the stored report and regenerated HTML
              _currentReport = newReport;
              currentHtml = generateDashboardHtml(newReport);
              _currentReportJson = JSON.stringify(newReport);

              // Push full update to all SSE clients
              broadcast({ type: 'update', report: newReport });
              console.log(`  ↻ Dashboard updated (${changedPath})`);
            } catch {
              broadcast({ type: 'error', message: 'Rescan failed' });
            } finally {
              isRescanning = false;
            }
          }, 800); // 800ms debounce
        });

        // Cleanup watcher on SIGINT
        process.on('SIGINT', () => {
          watcher.close();
          process.exit(0);
        });
      }
    });
  };

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      const addr = server.address();
      // Determine which port we just tried
      const tried = typeof addr === 'object' && addr ? addr.port : port;
      const next = (typeof tried === 'number' ? tried : port) + 1;
      if (next <= port + 2) {
        tryListen(next);
      } else {
        console.error(`✗ Could not bind to port ${port}–${port + 2}. All ports in use.`);
        process.exit(1);
      }
    } else {
      console.error(`✗ Server error: ${err.message}`);
      process.exit(1);
    }
  });

  tryListen(port);

  return server;
}
