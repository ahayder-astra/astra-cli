import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Default central repo to publish skills to / sync them from. */
export const DEFAULT_REGISTRY_URL = "git@github.com:ahayder/astra-cli.git";

/** Root of the installed CLI package (one level above dist/ or src/lib/..). */
export function packageRoot(): string {
  // __dirname is <root>/dist/lib (built) or <root>/src/lib (tsx). Both resolve
  // to the package root two levels up.
  return path.resolve(__dirname, "..", "..");
}

/** Base dir for CLI state (~/.astra), overridable for tests via ASTRA_HOME. */
export function astraHome(): string {
  return process.env.ASTRA_HOME ?? path.join(os.homedir(), ".astra");
}

/** Local checkout of the central repo used for publishing (a real git clone). */
export function registryDir(): string {
  return process.env.ASTRA_REGISTRY_DIR ?? path.join(astraHome(), "registry");
}

/** Git URL of the central repo to clone/pull for publishing. */
export function registryUrl(): string {
  return process.env.ASTRA_REGISTRY_URL ?? DEFAULT_REGISTRY_URL;
}

/**
 * Resolve the directory that holds `policy.yml` and one subfolder per skill.
 *
 * Prefers a local registry checkout (fresh, used in real deployments); falls
 * back to the skills bundled in the package (the dev/in-repo case).
 */
export function skillsRoot(): string {
  const candidates = [
    path.join(registryDir(), "skills"),
    path.join(packageRoot(), "skills"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "policy.yml"))) return dir;
  }
  throw new Error(
    "Could not locate the skills registry (no policy.yml found). " +
      "Set ASTRA_REGISTRY_DIR or run inside the astra-cli repo."
  );
}
