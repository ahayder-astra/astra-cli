import pc from "picocolors";
import { readConfig } from "../lib/config";
import { readInstalled, writeInstalled } from "../lib/installed";
import { installSkill } from "../lib/registry";

/**
 * Download/update the skills required by `.astra.yml` into the repo, copying
 * real content from the registry, then record what was installed so `check`
 * can verify it.
 */
export function sync(): void {
  const config = readConfig();
  const installed = readInstalled();
  const entries = Object.entries(config.skills);

  if (entries.length === 0) {
    console.log(pc.dim("No skills listed in .astra.yml. Nothing to sync."));
    return;
  }

  let changed = 0;
  for (const [name] of entries) {
    const version = installSkill(name);
    if (installed[name] === version) {
      console.log(`  ${pc.dim("=")} ${name} ${pc.dim(version)} (up to date)`);
    } else {
      installed[name] = version;
      changed++;
      console.log(`  ${pc.green("↓")} ${name} ${pc.dim(version)}`);
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
