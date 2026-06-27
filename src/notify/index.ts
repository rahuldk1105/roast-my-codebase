import https from 'https';
import http from 'http';
import { RoastReport } from '../types/index.js';

export type WebhookPlatform = 'slack' | 'teams' | 'discord' | 'generic';

export interface NotifyConfig {
  url: string;
  platform?: WebhookPlatform;
  onlyOnRegression?: boolean;
  threshold?: number;
}

export function detectPlatform(url: string): WebhookPlatform {
  if (url.includes('hooks.slack.com')) return 'slack';
  if (url.includes('webhook.office.com') || url.includes('outlook.office.com')) return 'teams';
  if (url.includes('discord.com/api/webhooks')) return 'discord';
  return 'generic';
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

function getTopFindings(report: RoastReport, limit: number) {
  const criticals = report.findings.filter(f => f.severity === 'critical');
  const warnings = report.findings.filter(f => f.severity === 'warning');
  return [...criticals, ...warnings].slice(0, limit);
}

function findingCounts(report: RoastReport) {
  const critical = report.findings.filter(f => f.severity === 'critical').length;
  const warning = report.findings.filter(f => f.severity === 'warning').length;
  const info = report.findings.filter(f => f.severity === 'info').length;
  return { critical, warning, info };
}

export function formatSlackPayload(report: RoastReport): object {
  const { health, verdict, projectName } = report;
  const counts = findingCounts(report);
  const top5 = getTopFindings(report, 5);

  const findingsText =
    [
      counts.critical > 0 ? `${counts.critical} critical` : '',
      counts.warning > 0 ? `${counts.warning} warnings` : '',
      counts.info > 0 ? `${counts.info} info` : '',
    ]
      .filter(Boolean)
      .join(' · ') || 'none';

  const topIssueLines = top5.map(f => {
    const icon = f.severity === 'critical' ? '🔴' : '⚠️';
    return `• ${icon} ${truncate(f.message, 80)}`;
  });

  return {
    text: `Roast My Codebase — Health: ${health.score}/100 ${health.grade} ${health.label}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🔥 Roast My Codebase — ${projectName}` },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Health Score*\n${health.score}/100 — ${health.grade} — ${health.label}`,
          },
          {
            type: 'mrkdwn',
            text: `*Findings*\n${findingsText}`,
          },
        ],
      },
      ...(top5.length > 0
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Top Issues*\n${topIssueLines.join('\n')}`,
              },
            },
          ]
        : []),
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `_${verdict}_` }],
      },
    ],
  };
}

export function formatTeamsPayload(report: RoastReport): object {
  const { health, verdict, projectName } = report;
  const counts = findingCounts(report);

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              size: 'Large',
              weight: 'Bolder',
              text: `🔥 Roast My Codebase — ${projectName}`,
            },
            {
              type: 'FactSet',
              facts: [
                {
                  title: 'Health Score',
                  value: `${health.score}/100 — ${health.grade} — ${health.label}`,
                },
                { title: 'Critical', value: String(counts.critical) },
                { title: 'Warnings', value: String(counts.warning) },
              ],
            },
            {
              type: 'TextBlock',
              text: verdict,
              isSubtle: true,
              wrap: true,
            },
          ],
        },
      },
    ],
  };
}

export function formatDiscordPayload(report: RoastReport): object {
  const { health, verdict, projectName } = report;
  const counts = findingCounts(report);
  const top5 = getTopFindings(report, 5);

  // Color: red < 60, orange < 80, green >= 80
  let color: number;
  if (health.score < 60) {
    color = 0xff0000; // red
  } else if (health.score < 80) {
    color = 0xff8800; // orange
  } else {
    color = 0x00cc44; // green
  }

  const findingsValue =
    [
      counts.critical > 0 ? `${counts.critical} critical` : '',
      counts.warning > 0 ? `${counts.warning} warnings` : '',
    ]
      .filter(Boolean)
      .join(' · ') || 'none';

  const topIssuesValue =
    top5.length > 0
      ? top5.map(f => `• ${truncate(f.message, 80)}`).join('\n')
      : 'No critical or warning findings';

  const fields = [
    { name: 'Grade', value: `${health.grade} — ${health.label}`, inline: true },
    { name: 'Findings', value: findingsValue, inline: true },
    { name: 'Top Issues', value: topIssuesValue, inline: false },
  ];

  return {
    username: 'Roast My Codebase',
    embeds: [
      {
        title: `🔥 ${projectName} — Health: ${health.score}/100`,
        color,
        fields,
        footer: { text: verdict },
      },
    ],
  };
}

export function formatGenericPayload(report: RoastReport): object {
  const { health, verdict, projectName } = report;
  const counts = findingCounts(report);
  const top5 = getTopFindings(report, 5);

  return {
    projectName,
    score: health.score,
    grade: health.grade,
    label: health.label,
    findings: {
      critical: counts.critical,
      warning: counts.warning,
      info: counts.info,
    },
    topFindings: top5.map(f => ({
      severity: f.severity,
      message: truncate(f.message, 80),
      file: f.file,
    })),
    verdict,
  };
}

function postWebhook(url: string, payload: object): Promise<void> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`Invalid webhook URL: ${url}`));
      return;
    }

    const body = JSON.stringify(payload);
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'roast-my-codebase',
        },
      },
      res => {
        // Drain the response to free the socket
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Webhook returned ${res.statusCode}`));
        }
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function sendNotification(
  report: RoastReport,
  config: NotifyConfig
): Promise<void> {
  // Skip if score is at or above threshold
  if (config.threshold !== undefined && report.health.score >= config.threshold) {
    return;
  }

  // Validate URL before continuing
  try {
    new URL(config.url);
  } catch {
    throw new Error(`Invalid webhook URL: ${config.url}`);
  }

  const platform = config.platform ?? detectPlatform(config.url);

  let payload: object;
  switch (platform) {
    case 'slack':
      payload = formatSlackPayload(report);
      break;
    case 'teams':
      payload = formatTeamsPayload(report);
      break;
    case 'discord':
      payload = formatDiscordPayload(report);
      break;
    default:
      payload = formatGenericPayload(report);
  }

  await postWebhook(config.url, payload);
}
