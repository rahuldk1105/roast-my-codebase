/**
 * AI-powered roast generation using Claude API
 */

import Anthropic from "@anthropic-ai/sdk";
import { Finding } from "../types/index.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface AIRoastConfig {
  enabled: boolean;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  cacheEnabled?: boolean;
  cachePath?: string;
}

export interface CachedRoast {
  findingHash: string;
  roast: string;
  timestamp: number;
}

const DEFAULT_MODEL = "claude-3-5-sonnet-20241022";
const DEFAULT_MAX_TOKENS = 150;
const DEFAULT_TEMPERATURE = 1.0;
const CACHE_FILE = ".roast-ai-cache.json";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate AI-powered roast for a finding
 */
export async function generateAIRoast(
  finding: Finding,
  config: AIRoastConfig,
  rootDir: string
): Promise<string | null> {
  // Check if AI roasts are enabled
  if (!config.enabled) {
    return null;
  }

  // Get API key from config or environment
  const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(
      "Warning: AI roasts enabled but ANTHROPIC_API_KEY not found. Set via environment variable or .roastrc.json"
    );
    return null;
  }

  // Check cache first
  if (config.cacheEnabled !== false) {
    const cached = getCachedRoast(finding, rootDir, config.cachePath);
    if (cached) {
      return cached;
    }
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const prompt = buildRoastPrompt(finding);

    const response = await anthropic.messages.create({
      model: config.model || DEFAULT_MODEL,
      max_tokens: config.maxTokens || DEFAULT_MAX_TOKENS,
      temperature: config.temperature || DEFAULT_TEMPERATURE,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const roast =
      response.content[0].type === "text" ? response.content[0].text : null;

    if (roast && config.cacheEnabled !== false) {
      cacheRoast(finding, roast, rootDir, config.cachePath);
    }

    return roast;
  } catch (error) {
    console.warn(
      `Warning: Failed to generate AI roast: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Generate AI-powered roasts for multiple findings in batch
 */
export async function generateAIRoastsBatch(
  findings: Finding[],
  config: AIRoastConfig,
  rootDir: string,
  maxConcurrent: number = 3
): Promise<Map<string, string>> {
  const roasts = new Map<string, string>();

  // Process in batches to avoid rate limits
  for (let i = 0; i < findings.length; i += maxConcurrent) {
    const batch = findings.slice(i, i + maxConcurrent);

    const promises = batch.map(async (finding) => {
      const roast = await generateAIRoast(finding, config, rootDir);
      if (roast) {
        roasts.set(finding.id, roast);
      }
    });

    await Promise.all(promises);
  }

  return roasts;
}

/**
 * Build prompt for roast generation
 */
function buildRoastPrompt(finding: Finding): string {
  const severityContext =
    finding.severity === "critical"
      ? "This is a critical issue that needs immediate attention."
      : finding.severity === "warning"
      ? "This is a warning-level issue."
      : "This is an informational finding.";

  let context = `Generate a witty, humorous but constructive roast for this code issue.

Category: ${finding.category}
Severity: ${finding.severity}
${severityContext}

Issue: ${finding.message}`;

  if (finding.file) {
    context += `\nFile: ${finding.file}`;
  }

  if (finding.detail) {
    context += `\nDetails: ${finding.detail}`;
  }

  context += `

Requirements:
- Be funny and witty, but not mean-spirited
- Make it specific to the actual issue
- Keep it under 2 sentences
- Use developer humor (references to coffee, late nights, etc. are welcome)
- Be constructive - the roast should make the developer want to fix the issue
- Don't use generic statements - reference the specific problem

Examples of good roasts:
- For a 1,847-line file: "This file is doing more jobs than a Swiss Army knife. Pick a lane."
- For circular dependencies: "These files are more codependent than a reality TV couple."
- For 50 TODOs: "Your code has more TODOs than a grocery list. Maybe start with the ones from 2019?"

Generate only the roast, no explanations or meta-commentary.`;

  return context;
}

/**
 * Generate hash for finding to use as cache key
 */
function getFindingHash(finding: Finding): string {
  const key = `${finding.category}-${finding.severity}-${finding.message}-${finding.file || ""}`;
  return crypto.createHash("md5").update(key).digest("hex");
}

/**
 * Get cached roast if available
 */
function getCachedRoast(
  finding: Finding,
  rootDir: string,
  cachePath?: string
): string | null {
  const cacheFile = path.join(rootDir, cachePath || CACHE_FILE);

  if (!fs.existsSync(cacheFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(cacheFile, "utf-8");
    const cache: CachedRoast[] = JSON.parse(content);

    const findingHash = getFindingHash(finding);
    const now = Date.now();

    const cached = cache.find(
      (c) => c.findingHash === findingHash && now - c.timestamp < CACHE_TTL
    );

    return cached ? cached.roast : null;
  } catch {
    return null;
  }
}

/**
 * Cache a generated roast
 */
function cacheRoast(
  finding: Finding,
  roast: string,
  rootDir: string,
  cachePath?: string
): void {
  const cacheFile = path.join(rootDir, cachePath || CACHE_FILE);

  try {
    let cache: CachedRoast[] = [];

    if (fs.existsSync(cacheFile)) {
      const content = fs.readFileSync(cacheFile, "utf-8");
      cache = JSON.parse(content);
    }

    const findingHash = getFindingHash(finding);

    // Remove existing cache for this finding
    cache = cache.filter((c) => c.findingHash !== findingHash);

    // Add new cache entry
    cache.push({
      findingHash,
      roast,
      timestamp: Date.now(),
    });

    // Prune old entries
    const now = Date.now();
    cache = cache.filter((c) => now - c.timestamp < CACHE_TTL);

    // Keep max 100 cached roasts
    if (cache.length > 100) {
      cache = cache.slice(-100);
    }

    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // Silently fail - caching is not critical
  }
}

/**
 * Clear AI roast cache
 */
export function clearAIRoastCache(rootDir: string, cachePath?: string): void {
  const cacheFile = path.join(rootDir, cachePath || CACHE_FILE);

  if (fs.existsSync(cacheFile)) {
    fs.unlinkSync(cacheFile);
  }
}
