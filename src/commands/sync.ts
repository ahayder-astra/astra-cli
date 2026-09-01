import pc from "picocolors";
import { readConfig } from "../lib/config";
import { readInstalled, writeInstalled } from "../lib/installed";
import { installSkill } from "../lib/registry";

/**
 * Download/update the skills required by `.astra/config.yml` into the repo, copying
 * real content from the registry, then record what was installed so `check`
 * can verify it.
 */
export function sync(): void {
  const config = readConfig();
  const installed = readInstalled();
  const entries = Object.entries(config.skills);

  if (entries.length === 0) {
    console.log(pc.dim("No skills listed in .astra/config.yml. Nothing to sync."));
    return;
  }

  let changed = 0;
  for (const [id] of entries) {
    let version: string;
    try {
      version = installSkill(id);
    } catch {
      // The skill isn't in the registry yet — e.g. a new project's own skill
      // whose registration PR hasn't merged. Keep any local copy and move on.
      console.log(
        `  ${pc.yellow("?")} ${id} ${pc.dim("pending central registration")}`
      );
      continue;
    }
    if (installed[id] === version) {
      console.log(`  ${pc.dim("=")} ${id} ${pc.dim(version)} (up to date)`);
    } else {
      installed[id] = version;
      changed++;
      console.log(`  ${pc.green("↓")} ${id} ${pc.dim(version)}`);
    }
  }

  writeInstalled(installed);

  console.log();
  console.log(
    changed === 0
      ? pc.green("Already in sync.")
      : pc.green(`Synced ${changed} skill(s).`)
  );
}
