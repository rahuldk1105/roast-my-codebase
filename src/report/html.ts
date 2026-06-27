import fs from "fs";
import path from "path";
import { RoastReport, Finding } from "../types/index.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#3fb950";
  if (score >= 60) return "#e3b341";
  return "#f85149";
}

function _getGradeColor(score: number): string {
  return getScoreColor(score);
}

function _getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical": return "#f85149";
    case "warning": return "#e3b341";
    case "info": return "#79c0ff";
    default: return "#8b949e";
  }
}

function _getSeverityBg(severity: string): string {
  switch (severity) {
    case "critical": return "rgba(248, 81, 73, 0.15)";
    case "warning": return "rgba(227, 179, 65, 0.15)";
    case "info": return "rgba(121, 192, 255, 0.15)";
    default: return "rgba(139, 148, 158, 0.15)";
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

function renderGauge(score: number): string {
  // SVG arc gauge using stroke-dasharray trick
  // Circle: r=54, circumference = 2*PI*54 ≈ 339.3
  // We use a half-circle arc (180°), so half-circumference = 169.6
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const halfCirc = circumference / 2;
  const filled = (score / 100) * halfCirc;
  const color = getScoreColor(score);

  return `
    <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" aria-label="Health score gauge: ${score}">
      <!-- Background arc -->
      <path
        d="M 10 64 A 54 54 0 0 1 110 64"
        fill="none"
        stroke="#30363d"
        stroke-width="10"
        stroke-linecap="round"
      />
      <!-- Score arc -->
      <path
        d="M 10 64 A 54 54 0 0 1 110 64"
        fill="none"
        stroke="${color}"
        stroke-width="10"
        stroke-linecap="round"
        stroke-dasharray="${filled} ${halfCirc - filled}"
        pathLength="${halfCirc}"
      />
    </svg>`;
}

function renderSeverityBar(findings: Finding[]): string {
  const total = findings.length;
  if (total === 0) {
    return `<div class="severity-bar-empty">No findings — clean bill of health 🎉</div>`;
  }

  const criticals = findings.filter((f) => f.severity === "critical").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;

  const critPct = (criticals / total) * 100;
  const warnPct = (warnings / total) * 100;
  const infoPct = (infos / total) * 100;

  const segments = [];
  if (criticals > 0) {
    segments.push(
      `<div class="bar-segment critical" style="width:${critPct}%" title="${criticals} critical">${criticals}</div>`
    );
  }
  if (warnings > 0) {
    segments.push(
      `<div class="bar-segment warning" style="width:${warnPct}%" title="${warnings} warnings">${warnings}</div>`
    );
  }
  if (infos > 0) {
    segments.push(
      `<div class="bar-segment info" style="width:${infoPct}%" title="${infos} info">${infos}</div>`
    );
  }

  return `
    <div class="severity-bar-wrap">
      <div class="severity-bar">${segments.join("")}</div>
      <div class="severity-legend">
        ${criticals > 0 ? `<span class="legend-item critical"><span class="dot"></span>${criticals} critical</span>` : ""}
        ${warnings > 0 ? `<span class="legend-item warning"><span class="dot"></span>${warnings} warning${warnings !== 1 ? "s" : ""}</span>` : ""}
        ${infos > 0 ? `<span class="legend-item info"><span class="dot"></span>${infos} info</span>` : ""}
      </div>
    </div>`;
}

function renderRoastCards(report: RoastReport): string {
  if (report.roasts.length === 0) return "";

  const cards = report.roasts
    .map(
      (roast) => `
        <div class="roast-card">
          <div class="roast-icon">🔥</div>
          <div class="roast-content">
            <div class="roast-target">${escapeHtml(roast.target)}</div>
            <div class="roast-message">${escapeHtml(roast.message)}</div>
          </div>
        </div>`
    )
    .join("\n");

  return `
    <section class="section">
      <h2 class="section-title">🔥 Roasts</h2>
      <div class="roast-list">
        ${cards}
      </div>
    </section>`;
}

function _renderFindingsTable(findings: Finding[]): string {
  if (findings.length === 0) {
    return `
      <section class="section">
        <h2 class="section-title">Findings</h2>
        <p class="empty-state">No findings. Your codebase passed with flying colors!</p>
      </section>`;
  }

  const rows = findings
    .map(
      (f) => `
        <tr data-severity="${escapeHtml(f.severity)}">
          <td>
            <span class="badge badge-${escapeHtml(f.severity)}">${escapeHtml(f.severity)}</span>
          </td>
          <td class="col-category">${escapeHtml(f.category)}</td>
          <td class="col-message" title="${escapeHtml(f.message)}">${escapeHtml(truncate(f.message, 120))}</td>
          <td class="col-file">${f.file ? `<span class="file-path">${escapeHtml(f.file)}</span>` : '<span class="no-file">—</span>'}</td>
        </tr>`
    )
    .join("\n");

  return `
    <section class="section">
      <h2 class="section-title">Findings <span class="count-badge">${findings.length}</span></h2>
      <div class="table-wrap">
        <table id="findings-table" class="findings-table">
          <thead>
            <tr>
              <th class="sortable" data-col="0" title="Sort by severity">Severity <span class="sort-icon">↕</span></th>
              <th class="sortable" data-col="1" title="Sort by category">Category <span class="sort-icon">↕</span></th>
              <th>Message</th>
              <th class="sortable" data-col="3" title="Sort by file">File <span class="sort-icon">↕</span></th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </section>`;
}

function renderStyles(scoreColor: string): string {
  return `
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        background: #0d1117;
        color: #c9d1d9;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        min-height: 100vh;
      }

      .container {
        max-width: 900px;
        margin: 0 auto;
        padding: 32px 16px 64px;
      }

      /* ── Header ── */
      .header {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 24px;
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 32px;
        margin-bottom: 24px;
      }

      .header-left { min-width: 0; }

      .project-label {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #8b949e;
        margin-bottom: 4px;
      }

      .project-name {
        font-size: 28px;
        font-weight: 700;
        color: #f0f6fc;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .health-label {
        font-size: 13px;
        color: #8b949e;
        margin-top: 8px;
      }

      .health-label strong {
        color: ${scoreColor};
      }

      /* ── Gauge ── */
      .gauge-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        flex-shrink: 0;
      }

      .gauge-wrap svg {
        width: 140px;
        height: 82px;
      }

      .gauge-score {
        font-size: 42px;
        font-weight: 800;
        color: ${scoreColor};
        line-height: 1;
        text-align: center;
        margin-top: -4px;
      }

      .gauge-grade {
        font-size: 14px;
        font-weight: 600;
        color: #8b949e;
        text-align: center;
        margin-top: 2px;
      }

      /* ── Stats grid ── */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 24px;
      }

      @media (max-width: 600px) {
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
        .header { grid-template-columns: 1fr; }
        .gauge-wrap { align-items: flex-start; }
      }

      .stat-card {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 8px;
        padding: 16px;
        text-align: center;
      }

      .stat-value {
        font-size: 26px;
        font-weight: 700;
        color: #f0f6fc;
        display: block;
      }

      .stat-label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #8b949e;
        margin-top: 4px;
        display: block;
      }

      /* ── Section ── */
      .section {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 24px;
      }

      .section-title {
        font-size: 16px;
        font-weight: 700;
        color: #f0f6fc;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .count-badge {
        font-size: 12px;
        font-weight: 600;
        background: #30363d;
        color: #8b949e;
        border-radius: 20px;
        padding: 1px 8px;
      }

      /* ── Severity bar ── */
      .severity-bar {
        height: 10px;
        border-radius: 6px;
        overflow: hidden;
        display: flex;
        background: #30363d;
      }

      .bar-segment {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        color: #0d1117;
        min-width: 24px;
        transition: opacity 0.15s;
        cursor: default;
      }

      .bar-segment:hover { opacity: 0.85; }
      .bar-segment.critical { background: #f85149; }
      .bar-segment.warning  { background: #e3b341; }
      .bar-segment.info     { background: #79c0ff; }

      .severity-legend {
        display: flex;
        gap: 16px;
        margin-top: 12px;
        flex-wrap: wrap;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 500;
      }

      .legend-item .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .legend-item.critical { color: #f85149; }
      .legend-item.critical .dot { background: #f85149; }
      .legend-item.warning  { color: #e3b341; }
      .legend-item.warning  .dot { background: #e3b341; }
      .legend-item.info     { color: #79c0ff; }
      .legend-item.info     .dot { background: #79c0ff; }

      .severity-bar-empty {
        color: #3fb950;
        font-weight: 600;
        font-size: 14px;
      }

      /* ── Roast cards ── */
      .roast-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .roast-card {
        display: flex;
        gap: 14px;
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 8px;
        padding: 16px;
      }

      .roast-icon {
        font-size: 22px;
        flex-shrink: 0;
        line-height: 1.4;
      }

      .roast-content { min-width: 0; }

      .roast-target {
        font-size: 13px;
        font-weight: 700;
        color: #f0f6fc;
        margin-bottom: 4px;
      }

      .roast-message {
        font-size: 14px;
        color: #c9d1d9;
        line-height: 1.55;
      }

      /* ── Findings table ── */
      .table-wrap {
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid #30363d;
      }

      .findings-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      .findings-table th {
        background: #0d1117;
        color: #8b949e;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 10px 14px;
        text-align: left;
        white-space: nowrap;
        border-bottom: 1px solid #30363d;
      }

      .findings-table th.sortable {
        cursor: pointer;
        user-select: none;
      }

      .findings-table th.sortable:hover { color: #f0f6fc; }
      .findings-table th.sorted-asc .sort-icon::after  { content: " ↑"; }
      .findings-table th.sorted-desc .sort-icon::after { content: " ↓"; }
      .sort-icon { color: #484f58; font-size: 10px; }

      .findings-table td {
        padding: 10px 14px;
        border-bottom: 1px solid #21262d;
        vertical-align: top;
      }

      .findings-table tbody tr:last-child td { border-bottom: none; }

      .findings-table tbody tr:hover td { background: rgba(255,255,255,0.02); }

      .badge {
        display: inline-block;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 20px;
        white-space: nowrap;
      }

      .badge-critical {
        background: rgba(248, 81, 73, 0.18);
        color: #f85149;
        border: 1px solid rgba(248, 81, 73, 0.4);
      }

      .badge-warning {
        background: rgba(227, 179, 65, 0.18);
        color: #e3b341;
        border: 1px solid rgba(227, 179, 65, 0.4);
      }

      .badge-info {
        background: rgba(121, 192, 255, 0.18);
        color: #79c0ff;
        border: 1px solid rgba(121, 192, 255, 0.4);
      }

      .col-category {
        color: #f0f6fc;
        font-weight: 600;
        white-space: nowrap;
      }

      .col-message { color: #c9d1d9; }

      .col-file { max-width: 200px; }

      .file-path {
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        font-size: 11px;
        color: #8b949e;
        word-break: break-all;
      }

      .no-file { color: #484f58; }

      .empty-state { color: #8b949e; font-style: italic; }

      /* ── Verdict ── */
      .verdict-block {
        border-left: 3px solid #30363d;
        padding: 16px 20px;
        background: #0d1117;
        border-radius: 0 8px 8px 0;
      }

      .verdict-text {
        font-size: 16px;
        font-style: italic;
        color: #c9d1d9;
        line-height: 1.7;
      }

      /* ── Footer ── */
      .footer {
        text-align: center;
        color: #484f58;
        font-size: 12px;
        margin-top: 40px;
      }

      .footer a { color: #58a6ff; text-decoration: none; }
      .footer a:hover { text-decoration: underline; }

      /* ── Filter bar ── */
      .filter-bar {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
        align-items: center;
      }

      .filter-label {
        font-size: 12px;
        color: #8b949e;
        margin-right: 4px;
      }

      .filter-btn {
        background: #0d1117;
        border: 1px solid #30363d;
        color: #8b949e;
        font-size: 12px;
        font-weight: 600;
        border-radius: 20px;
        padding: 3px 12px;
        cursor: pointer;
        transition: border-color 0.15s, color 0.15s;
      }

      .filter-btn:hover { border-color: #8b949e; color: #c9d1d9; }
      .filter-btn.active { border-color: #58a6ff; color: #58a6ff; }
      .filter-btn.active-critical { border-color: #f85149; color: #f85149; }
      .filter-btn.active-warning  { border-color: #e3b341; color: #e3b341; }
      .filter-btn.active-info     { border-color: #79c0ff; color: #79c0ff; }
    </style>`;
}

function renderScript(): string {
  return `
    <script>
      (function () {
        // ── Table sort ──
        var table = document.getElementById('findings-table');
        if (!table) return;

        var headers = table.querySelectorAll('th.sortable');
        var sortState = { col: -1, asc: true };

        headers.forEach(function (th) {
          th.addEventListener('click', function () {
            var col = parseInt(th.getAttribute('data-col'), 10);
            if (sortState.col === col) {
              sortState.asc = !sortState.asc;
            } else {
              sortState.col = col;
              sortState.asc = true;
            }

            headers.forEach(function (h) {
              h.classList.remove('sorted-asc', 'sorted-desc');
            });
            th.classList.add(sortState.asc ? 'sorted-asc' : 'sorted-desc');

            var tbody = table.querySelector('tbody');
            var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));

            var severityOrder = { critical: 0, warning: 1, info: 2 };

            rows.sort(function (a, b) {
              var aCell = a.querySelectorAll('td')[col];
              var bCell = b.querySelectorAll('td')[col];
              var aText = aCell ? aCell.textContent.trim().toLowerCase() : '';
              var bText = bCell ? bCell.textContent.trim().toLowerCase() : '';

              if (col === 0) {
                var aOrder = severityOrder[a.getAttribute('data-severity')] !== undefined
                  ? severityOrder[a.getAttribute('data-severity')] : 99;
                var bOrder = severityOrder[b.getAttribute('data-severity')] !== undefined
                  ? severityOrder[b.getAttribute('data-severity')] : 99;
                return sortState.asc ? aOrder - bOrder : bOrder - aOrder;
              }

              if (aText < bText) return sortState.asc ? -1 : 1;
              if (aText > bText) return sortState.asc ? 1 : -1;
              return 0;
            });

            rows.forEach(function (row) { tbody.appendChild(row); });
          });
        });

        // ── Filter buttons ──
        var filterBtns = document.querySelectorAll('.filter-btn');
        var currentFilter = 'all';

        filterBtns.forEach(function (btn) {
          btn.addEventListener('click', function () {
            var filter = btn.getAttribute('data-filter');
            currentFilter = filter;

            filterBtns.forEach(function (b) {
              b.classList.remove('active', 'active-critical', 'active-warning', 'active-info');
            });

            if (filter === 'all') {
              btn.classList.add('active');
            } else {
              btn.classList.add('active-' + filter);
            }

            var tbody = table.querySelector('tbody');
            var rows = tbody.querySelectorAll('tr');
            rows.forEach(function (row) {
              if (filter === 'all' || row.getAttribute('data-severity') === filter) {
                row.style.display = '';
              } else {
                row.style.display = 'none';
              }
            });
          });
        });

        // Activate "All" by default
        var allBtn = document.querySelector('.filter-btn[data-filter="all"]');
        if (allBtn) allBtn.classList.add('active');
      })();
    </script>`;
}

/**
 * Renders a self-contained HTML report for a RoastReport.
 * Returns a complete HTML string with all CSS and JS inline — no external dependencies.
 */
export function renderHtmlReport(report: RoastReport): string {
  const scoreColor = getScoreColor(report.health.score);
  const criticals = report.findings.filter((f) => f.severity === "critical").length;
  const warnings = report.findings.filter((f) => f.severity === "warning").length;
  const infos = report.findings.filter((f) => f.severity === "info").length;

  const hasFindings = report.findings.length > 0;
  const filterBar = hasFindings
    ? `
        <div class="filter-bar">
          <span class="filter-label">Filter:</span>
          <button class="filter-btn" data-filter="all">All (${report.findings.length})</button>
          ${criticals > 0 ? `<button class="filter-btn" data-filter="critical">Critical (${criticals})</button>` : ""}
          ${warnings > 0 ? `<button class="filter-btn" data-filter="warning">Warning (${warnings})</button>` : ""}
          ${infos > 0 ? `<button class="filter-btn" data-filter="info">Info (${infos})</button>` : ""}
        </div>`
    : "";

  const generatedAt = new Date().toUTCString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="generator" content="roast-my-codebase" />
  <title>Roast Report — ${escapeHtml(report.projectName)}</title>
  ${renderStyles(scoreColor)}
</head>
<body>
  <div class="container">

    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="project-label">Roast My Codebase</div>
        <div class="project-name" title="${escapeHtml(report.projectName)}">${escapeHtml(report.projectName)}</div>
        <div class="health-label">
          Health: <strong>${report.health.score}/100</strong> &mdash; ${escapeHtml(report.health.label)}
        </div>
      </div>
      <div class="gauge-wrap">
        ${renderGauge(report.health.score)}
        <div class="gauge-score">${report.health.score}</div>
        <div class="gauge-grade">Grade: ${escapeHtml(report.health.grade)}</div>
      </div>
    </div>

    <!-- Stats grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-value">${report.stats.totalFiles.toLocaleString()}</span>
        <span class="stat-label">Total Files</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${report.stats.totalLines.toLocaleString()}</span>
        <span class="stat-label">Lines of Code</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${report.stats.dependencies}</span>
        <span class="stat-label">Dependencies</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${report.findings.length}</span>
        <span class="stat-label">Findings</span>
      </div>
    </div>

    <!-- Severity breakdown -->
    <section class="section">
      <h2 class="section-title">Severity Breakdown</h2>
      ${renderSeverityBar(report.findings)}
    </section>

    <!-- Roasts -->
    ${renderRoastCards(report)}

    <!-- Findings table -->
    <section class="section">
      <h2 class="section-title">Findings <span class="count-badge">${report.findings.length}</span></h2>
      ${filterBar}
      ${report.findings.length === 0
        ? `<p class="empty-state">No findings. Your codebase passed with flying colors!</p>`
        : `<div class="table-wrap">
        <table id="findings-table" class="findings-table">
          <thead>
            <tr>
              <th class="sortable" data-col="0">Severity <span class="sort-icon">↕</span></th>
              <th class="sortable" data-col="1">Category <span class="sort-icon">↕</span></th>
              <th>Message</th>
              <th class="sortable" data-col="3">File <span class="sort-icon">↕</span></th>
            </tr>
          </thead>
          <tbody>
            ${report.findings
              .map(
                (f) => `            <tr data-severity="${escapeHtml(f.severity)}">
              <td><span class="badge badge-${escapeHtml(f.severity)}">${escapeHtml(f.severity)}</span></td>
              <td class="col-category">${escapeHtml(f.category)}</td>
              <td class="col-message" title="${escapeHtml(f.message)}">${escapeHtml(truncate(f.message, 120))}</td>
              <td class="col-file">${f.file ? `<span class="file-path">${escapeHtml(f.file)}</span>` : '<span class="no-file">—</span>'}</td>
            </tr>`
              )
              .join("\n")}
          </tbody>
        </table>
      </div>`}
    </section>

    <!-- Verdict -->
    <section class="section">
      <h2 class="section-title">Verdict</h2>
      <div class="verdict-block">
        <p class="verdict-text">&ldquo;${escapeHtml(report.verdict)}&rdquo;</p>
      </div>
    </section>

    <!-- Footer -->
    <div class="footer">
      Generated by <a href="https://github.com/itsrahul_8/roast-my-codebase" rel="noopener">roast-my-codebase</a>
      &middot; ${escapeHtml(generatedAt)}
    </div>

  </div>
  ${renderScript()}
</body>
</html>`;
}

/**
 * Writes the HTML report string to `.roast-report.html` in the given root directory.
 */
export function saveHtmlReport(html: string, rootDir: string): void {
  const outputPath = path.join(rootDir, ".roast-report.html");
  fs.writeFileSync(outputPath, html, "utf-8");
}
