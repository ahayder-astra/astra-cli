import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

/** The Astra directory that holds all per-repo settings. */
export const ASTRA_DIR = ".astra";

/** The per-repo contract file (inside the Astra directory). */
export const CONFIG_FILE = path.join(ASTRA_DIR, "config.yml");

/** Pre-consolidation location, still read for backward compatibility. */
export const LEGACY_CONFIG_FILE = ".astra.yml";

/** Where synced skills get written inside a repo. */
export const SKILLS_DIR = path.join(ASTRA_DIR, "skills");

/**
 * Shape of `.astra/config.yml`.
 *
 * project: which project this repo is (AnimoFrontend, Velox, ...).
 * skills:  the contract — a map of scoped skill id (`scope/name`, e.g.
 *          `common/testing` or `AnimoFrontend/conventions`) -> required version.
 */
export interface AstraConfig {
  project: string;
  skills: Record<string, string>;
}

/** Absolute path to the config file for a given repo root (default: cwd). */
export function configPath(repoRoot: string = process.cwd()): string {
  return path.join(repoRoot, CONFIG_FILE);
}

function legacyPath(repoRoot: string): string {
  return path.join(repoRoot, LEGACY_CONFIG_FILE);
}

/** The config path that actually exists (new preferred), or null. */
function existingConfigPath(repoRoot: string): string | null {
  const current = configPath(repoRoot);
  if (fs.existsSync(current)) return current;
  const legacy = legacyPath(repoRoot);
  if (fs.existsSync(legacy)) return legacy;
  return null;
}

/** True if this repo has already been initialized. */
export function configExists(repoRoot: string = process.cwd()): boolean {
  return existingConfigPath(repoRoot) !== null;
}

/** Read and parse the contract. Throws a friendly error if missing/invalid. */
export function readConfig(repoRoot: string = process.cwd()): AstraConfig {
  const file = existingConfigPath(repoRoot);
  if (!file) {
    throw new Error(`No ${CONFIG_FILE} found. Run \`astra skills init\` first.`);
  }

  const raw = yaml.load(fs.readFileSync(file, "utf8"));
  if (!raw || typeof raw !== "object") {
    throw new Error(`${file} is empty or invalid.`);
  }

  const cfg = raw as Partial<AstraConfig>;
  return {
    project: cfg.project ?? "unknown",
    skills: cfg.skills ?? {},
  };
}

/**
 * Serialize and write the contract to `.astra/config.yml`, creating the Astra
 * directory. Removes a legacy root `.astra.yml` if present (migrating it).
 */
export function writeConfig(
  config: AstraConfig,
  repoRoot: string = process.cwd()
): void {
  const header =
    "# .astra/config.yml — this repo's AI requirements contract.\n" +
    "# Committed and version-controlled like package.json.\n\n";
  const body = yaml.dump(config, { sortKeys: false, lineWidth: 80 });
  fs.mkdirSync(path.join(repoRoot, ASTRA_DIR), { recursive: true });
  fs.writeFileSync(configPath(repoRoot), header + body, "utf8");

  const legacy = legacyPath(repoRoot);
  if (fs.existsSync(legacy)) fs.rmSync(legacy);
}
