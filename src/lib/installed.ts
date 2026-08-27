import fs from "node:fs";
import path from "node:path";
import { SKILLS_DIR } from "./config";

/**
 * A manifest of what `sync` actually wrote into the repo.
 * Maps skill name -> installed version. This is how `check` knows
 * whether the repo matches its contract without re-downloading anything.
 */
export type InstalledManifest = Record<string, string>;

function manifestPath(repoRoot: string): string {
  return path.join(repoRoot, SKILLS_DIR, "manifest.json");
}

/** Read the installed-skills manifest. Returns {} if nothing is installed yet. */
export function readInstalled(
  repoRoot: string = process.cwd()
): InstalledManifest {
  const file = manifestPath(repoRoot);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as InstalledManifest;
  } catch {
    return {};
  }
}

/** Write the installed-skills manifest. */
export function writeInstalled(
  manifest: InstalledManifest,
  repoRoot: string = process.cwd()
): void {
  const dir = path.join(repoRoot, SKILLS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    manifestPath(repoRoot),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );
}
