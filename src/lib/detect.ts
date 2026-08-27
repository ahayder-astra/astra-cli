import fs from "node:fs";
import path from "node:path";

/**
 * Best-effort guess of the repo's profile by inspecting its files.
 * Returns a known profile name, or null if it can't tell.
 */
export function detectProfile(repoRoot: string = process.cwd()): string | null {
  const pkgPath = path.join(repoRoot, "package.json");

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const deps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      };
      const frontendHints = ["react", "vue", "svelte", "next", "@angular/core"];
      if (frontendHints.some((d) => d in deps)) return "frontend";
      // A package.json without a frontend framework is most likely a Node backend.
      return "backend";
    } catch {
      // fall through
    }
  }

  // Common backend markers for non-Node repos.
  const backendMarkers = ["go.mod", "requirements.txt", "pom.xml", "Cargo.toml"];
  if (backendMarkers.some((f) => fs.existsSync(path.join(repoRoot, f)))) {
    return "backend";
  }

  return null;
}
