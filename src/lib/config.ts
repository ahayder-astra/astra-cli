import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

/** The name of the per-repo contract file. */
export const CONFIG_FILE = ".astra.yml";

/** Where synced skills get written inside a repo. */
export const SKILLS_DIR = ".astra/skills";

/**
 * Shape of `.astra.yml`.
 *
 * profile: the repo type (frontend, backend, ...) — informational after init.
 * skills:  the contract — a map of skill name -> required version.
 */
export interface AstraConfig {
  profile: string;
  skills: Record<string, string>;
}

/** Absolute path to the config file for a given repo root (default: cwd). */
export function configPath(repoRoot: string = process.cwd()): string {
  return path.join(repoRoot, CONFIG_FILE);
}

/** True if this repo has already been initialized. */
export function configExists(repoRoot: string = process.cwd()): boolean {
  return fs.existsSync(configPath(repoRoot));
}

/** Read and parse `.astra.yml`. Throws a friendly error if missing/invalid. */
export function readConfig(repoRoot: string = process.cwd()): AstraConfig {
  const file = configPath(repoRoot);
  if (!fs.existsSync(file)) {
    throw new Error(
      `No ${CONFIG_FILE} found. Run \`astra skills init\` first.`
    );
  }

  const raw = yaml.load(fs.readFileSync(file, "utf8"));
  if (!raw || typeof raw !== "object") {
    throw new Error(`${CONFIG_FILE} is empty or invalid.`);
  }

  const cfg = raw as Partial<AstraConfig>;
  return {
    profile: cfg.profile ?? "unknown",
    skills: cfg.skills ?? {},
  };
}

/** Serialize and write `.astra.yml`. */
export function writeConfig(
  config: AstraConfig,
  repoRoot: string = process.cwd()
): void {
  const header =
    "# .astra.yml — this repo's AI requirements contract.\n" +
    "# Committed and version-controlled like package.json.\n\n";
  const body = yaml.dump(config, { sortKeys: false, lineWidth: 80 });
  fs.writeFileSync(configPath(repoRoot), header + body, "utf8");
}
