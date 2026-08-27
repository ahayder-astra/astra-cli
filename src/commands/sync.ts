import pc from "picocolors";
import { readConfig } from "../lib/config";
import { readInstalled, writeInstalled } from "../lib/installed";
import { fetchSkill } from "../lib/registry";

/**
 * Download/update the skills required by `.astra-ai.yml` into the repo,
 * then record what was installed in the manifest so `check` can verify it.
 */
export function sync(): void {
  const config = readConfig();
  const installed = readInstalled();
  const entries = Object.entries(config.skills);

  if (entries.length === 0) {
    console.log(pc.dim("No skills listed in .astra-ai.yml. Nothing to sync."));
    return;
  }

  let changed = 0;
  for (const [name, version] of entries) {
    if (installed[name] === version) {
      console.log(`  ${pc.dim("=")} ${name} ${pc.dim(version)} (up to date)`);
      continue;
    }
    fetchSkill(name, version);
    installed[name] = version;
    changed++;
    console.log(`  ${pc.green("↓")} ${name} ${pc.dim(version)}`);
  }

  writeInstalled(installed);

  console.log();
  console.log(
    changed === 0
      ? pc.green("Already in sync.")
      : pc.green(`Synced ${changed} skill(s).`)
  );
}
