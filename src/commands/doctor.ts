import pc from "picocolors";
import { CONFIG_FILE, configExists, readConfig } from "../lib/config";
import { readInstalled } from "../lib/installed";

/** Show the current repo's AI setup and any problems, at a glance. */
export function doctor(): void {
  console.log(pc.bold("Astra AI — doctor\n"));

  if (!configExists()) {
    console.log(`  ${pc.red("✗")} ${CONFIG_FILE} not found`);
    console.log(pc.dim("\n  Run `astra-ai init` to get started."));
    return;
  }
  console.log(`  ${pc.green("✓")} ${CONFIG_FILE} found`);

  const config = readConfig();
  console.log(`  ${pc.green("✓")} profile: ${pc.cyan(config.profile)}`);

  const required = Object.entries(config.skills);
  const installed = readInstalled();
  const missing = required.filter(([n, v]) => installed[n] !== v);

  console.log(
    `  ${missing.length === 0 ? pc.green("✓") : pc.yellow("!")} ` +
      `skills: ${required.length} required, ` +
      `${required.length - missing.length} in sync`
  );

  console.log();
  if (missing.length === 0) {
    console.log(pc.green("Everything looks good."));
  } else {
    console.log(
      pc.yellow(`${missing.length} skill(s) out of sync.`) +
        pc.dim("  Run `astra-ai sync`, then `astra-ai check`.")
    );
  }
}
