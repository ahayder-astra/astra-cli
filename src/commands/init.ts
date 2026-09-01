import pc from "picocolors";
import { CONFIG_FILE, configExists, writeConfig } from "../lib/config";
import { skillsForProject, knownProjects } from "../lib/policy";
import { confirm } from "../lib/prompt";

interface InitOptions {
  project?: string;
  yes?: boolean;
  force?: boolean;
}

/**
 * Bootstrap Astra in the current repo: pick the project, confirm, and write
 * `.astra.yml`. Refuses to overwrite an existing config unless --force.
 *
 * The project can't be reliably auto-detected (AnimoFrontend vs AnimoNext both
 * look like React), so it must be given explicitly via --project.
 */
export async function init(options: InitOptions = {}): Promise<void> {
  if (configExists() && !options.force) {
    console.log(
      pc.yellow(`${CONFIG_FILE} already exists.`) +
        pc.dim("  Use --force to overwrite.")
    );
    return;
  }

  const known = knownProjects();
  const project = options.project;

  if (!project) {
    console.log(
      pc.yellow("Specify which project this repo is with --project.") +
        pc.dim(`\n  Known projects: ${known.join(", ")}`)
    );
    process.exit(1);
  }

  if (!known.includes(project)) {
    console.log(
      pc.red(`Unknown project "${project}".`) +
        pc.dim(`\n  Known projects: ${known.join(", ")}`)
    );
    process.exit(1);
  }

  console.log(`Project: ${pc.cyan(project)}`);
  const skills = skillsForProject(project);
  console.log(pc.dim("Will require:"));
  for (const [id, version] of Object.entries(skills)) {
    console.log(pc.dim(`  - ${id} ${version}`));
  }
  console.log();

  if (!options.yes) {
    const ok = await confirm("Create .astra.yml with these skills?");
    if (!ok) {
      console.log(pc.dim("Aborted."));
      return;
    }
  }

  writeConfig({ project, skills });
  console.log(pc.green(`Created ${CONFIG_FILE}.`));
  console.log(pc.dim("Next: run `astra skills sync` to download the skills."));
}
