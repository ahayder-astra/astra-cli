import fs from "node:fs";
import path from "node:path";
import { SKILLS_DIR } from "./config";

/**
 * Fetches a single skill at a given version into the repo.
 *
 * TODO (real implementation): clone/pull the central skills git repo into a
 * local cache (e.g. ~/.astra/cache), check out the tag matching `version`, and
 * copy that skill's folder into SKILLS_DIR. For now we write a placeholder so
 * the whole flow runs end-to-end without network access.
 */
export function fetchSkill(
  name: string,
  version: string,
  repoRoot: string = process.cwd()
): void {
  const dir = path.join(repoRoot, SKILLS_DIR, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "SKILL.md"),
    `# ${name}\n\nversion: ${version}\n\n> Placeholder. Real content comes from the central skills repo.\n`,
    "utf8"
  );
}
