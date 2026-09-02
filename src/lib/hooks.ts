import fs from "node:fs";
import path from "node:path";
import { ASTRA_DIR } from "./config";

/** Directory (inside a repo) that holds the telemetry hook script. */
export const HOOKS_DIR = path.join(ASTRA_DIR, "hooks");

/** The telemetry hook script, relative to the repo root. */
export const REPORT_JS_PATH = path.join(HOOKS_DIR, "report.js");

/** Local JSONL sink report.js writes to when no endpoint is configured. */
export const LOCAL_TELEMETRY_DIR = path.join(ASTRA_DIR, "telemetry");

/** Claude Code project settings file wired up with the hooks. */
export const CLAUDE_SETTINGS_PATH = path.join(".claude", "settings.json");

/** Command Claude Code runs for each hook event (repo-relative, portable). */
const HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.astra/hooks/report.js"';

/** Hook events the report script is wired into. */
const HOOK_EVENTS = ["PostToolUse", "Stop"] as const;

/**
 * Contents of `.astra/hooks/report.js` — a zero-dependency Node script (consumer
 * repos won't have our deps installed). Reads a Claude Code hook payload on
 * stdin and fire-and-forget POSTs a small activity event to the Astra endpoint.
 * It never throws and always exits 0, so telemetry can never block Claude.
 */
export const REPORT_JS = `#!/usr/bin/env node
// Astra activity telemetry — installed by \`astra init\`. Do not edit by hand;
// re-run \`astra init\` to refresh. Fire-and-forget, never blocks Claude.
//
// Destination: ASTRA_TELEMETRY_URL (POST) when set, otherwise a local JSONL
// sink at <project>/.astra/telemetry/events.jsonl.
"use strict";

const url = process.env.ASTRA_TELEMETRY_URL;

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function git(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function projectName() {
  try {
    const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const text = fs.readFileSync(path.join(dir, ".astra", "config.yml"), "utf8");
    const m = text.match(/^project:\\s*(.+)$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

async function main() {
  let payload = {};
  try {
    payload = JSON.parse(readStdin() || "{}");
  } catch {
    payload = {};
  }

  const event = {
    agent: payload.session_id || "",
    tool: payload.tool_name || "",
    event: payload.hook_event_name || "",
    project: projectName(),
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    commit: git(["rev-parse", "HEAD"]),
    at: new Date().toISOString(),
  };

  if (url) {
    // Remote: fire-and-forget POST with a short timeout.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event),
        signal: controller.signal,
      });
    } catch {
      // best effort — telemetry must never disrupt the session
    } finally {
      clearTimeout(timer);
    }
    return;
  }

  // Local fallback: append one line to <project>/.astra/telemetry/events.jsonl.
  try {
    const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const dir = path.join(root, ".astra", "telemetry");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "events.jsonl"), JSON.stringify(event) + "\\n");
  } catch {
    // best effort
  }
}

main().finally(() => process.exit(0));
`;

interface HookEntry {
  type?: string;
  command?: string;
}
interface HookGroup {
  matcher?: string;
  hooks?: HookEntry[];
}

/** True if any group under this event already runs our hook command. */
function alreadyWired(groups: HookGroup[]): boolean {
  return groups.some((g) =>
    (g.hooks ?? []).some((h) => h.command === HOOK_COMMAND)
  );
}

/**
 * Install the telemetry hook (idempotent): write `.astra/hooks/report.js` and
 * wire it into `.claude/settings.json` under PostToolUse + Stop without
 * clobbering any existing settings or hooks.
 *
 * @returns "installed" if wiring was added, "already" if it was all present.
 */
export function installTelemetryHooks(
  repoRoot: string = process.cwd()
): "installed" | "already" {
  // 1. Write the (dependency-free) hook script.
  fs.mkdirSync(path.join(repoRoot, HOOKS_DIR), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, REPORT_JS_PATH), REPORT_JS, "utf8");

  // 2. Merge into .claude/settings.json, preserving everything else.
  const settingsFile = path.join(repoRoot, CLAUDE_SETTINGS_PATH);
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsFile)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    } catch {
      settings = {};
    }
  }

  const hooks = (settings.hooks ??= {}) as Record<string, HookGroup[]>;
  let changed = false;
  for (const event of HOOK_EVENTS) {
    const groups = (hooks[event] ??= []);
    if (alreadyWired(groups)) continue;
    groups.push({ hooks: [{ type: "command", command: HOOK_COMMAND }] });
    changed = true;
  }

  if (changed) {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n", "utf8");
  }

  return changed ? "installed" : "already";
}
