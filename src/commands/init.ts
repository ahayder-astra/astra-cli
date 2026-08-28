import pc from "picocolors";
import { CONFIG_FILE, configExists, writeConfig } from "../lib/config";
import { detectProfile } from "../lib/detect";
import { skillsForProfile, POLICY } from "../lib/policy";
import { confirm } from "../lib/prompt";

interface InitOptions {
  profile?: string;
  yes?: boolean;
  force?: boolean;
}

/**
 * Bootstrap Astra AI in the current repo: detect the profile, confirm, and
 * write `.astra.yml`. Refuses to overwrite an existing config unless --force.
 */
export async function init(options: InitOptions = {}): Promise<void> {
  if (configExists() && !options.force) {
    console.log(
      pc.yellow(`${CONFIG_FILE} already exists.`) +
        pc.dim("  Use --force to overwrite.")
    );
    return;
  }

  const known = Object.keys(POLICY.profiles);
  let profile = options.profile ?? detectProfile() ?? null;

  if (options.profile && !known.includes(options.profile)) {
    console.log(
      pc.red(`Unknown profile "${options.profile}".`) +
        pc.dim(`  Known profiles: ${known.join(", ")}`)
    );
    process.exit(1);
  }

  if (!profile) {
    console.log(
      pc.yellow("Could not detect repo type.") +
        pc.dim(`  Pass --profile <${known.join("|")}>`)
    );
    process.exit(1);
  }

  console.log(`Detected profile: ${pc.cyan(profile)}`);
  const skills = skillsForProfile(profile);
  console.log(pc.dim("Will require:"));
  for (const [name, version] of Object.entries(skills)) {
    console.log(pc.dim(`  - ${name} ${version}`));
  }
  console.log();

  if (!options.yes) {
    const ok = await confirm("Create .astra.yml with these skills?");
    if (!ok) {
      console.log(pc.dim("Aborted."));
      return;
    }
  }

  writeConfig({ profile, skills });
  console.log(pc.green(`Created ${CONFIG_FILE}.`));
  console.log(pc.dim("Next: run `astra skills sync` to download the skills."));
}
