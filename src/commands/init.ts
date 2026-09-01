import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { CONFIG_FILE, configExists, writeConfig } from "../lib/config";
import { skillsForProject, knownProjects } from "../lib/policy";
import { confirm, promptText } from "../lib/prompt";
import {
  commitAndOpenPr,
  defaultBranch,
  ensureWorkRegistry,
  gitIn,
  installSkill,
  scaffoldProject,
} from "../lib/registry";
import { writeInstalled } from "../lib/installed";
import { reportPr } from "./publish";

interface InitOptions {
  project?: string;
  yes?: boolean;
  force?: boolean;
}

const NAME_RE = /^[A-Za-z0-9_-]+$/;

function validateName(name: string): string | null {
  if (!NAME_RE.test(name)) return "Use only letters, numbers, - and _.";
  if (name === "common") return '"common" is reserved.';
  return null;
}

/** Read the `name` field from ./package.json, if present. */
function packageName(repoRoot: string): string | undefined {
  const file = path.join(repoRoot, "package.json");
  if (!fs.existsSync(file)) return undefined;
  try {
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    return typeof pkg.name === "string" && pkg.name ? pkg.name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Interactive `init` wizard: suggest a project name from package.json, let the
 * user confirm or change it, then either adopt an existing central project or
 * register a brand-new one via PR. `--project`/`--yes` bypass the prompts.
 */
export async function init(options: InitOptions = {}): Promise<void> {
  const repoRoot = process.cwd();

  if (configExists() && !options.force) {
    console.log(
      pc.yellow(`${CONFIG_FILE} already exists.`) +
        pc.dim("  Use --force to overwrite.")
    );
    return;
  }

  // 1. Decide the project name (flag > wizard prompt seeded from package.json).
  let name: string;
  if (options.project) {
    const err = validateName(options.project);
    if (err) {
      console.log(pc.red(`Invalid project "${options.project}". ${err}`));
      process.exit(1);
    }
    name = options.project;
  } else {
    const suggestion = packageName(repoRoot);
    for (;;) {
      name = await promptText("Project name", suggestion);
      const err = validateName(name);
      if (!err) break;
      console.log(pc.red(err));
    }
  }

  // 2. Match against known projects; refresh the central clone before deciding
  //    it's new, so a recently-added project isn't re-created.
  let known = knownProjects();
  if (!known.includes(name)) {
    console.log(pc.dim("Checking central registry…"));
    ensureWorkRegistry();
    known = knownProjects();
  }

  if (known.includes(name)) {
    await adopt(name, options, repoRoot);
  } else {
    await createNew(name, options, repoRoot);
  }
}

/** Existing project: pin common + the project's skills and write .astra.yml. */
async function adopt(
  name: string,
  options: InitOptions,
  repoRoot: string
): Promise<void> {
  console.log(`Project: ${pc.cyan(name)} ${pc.dim("(existing)")}`);
  const skills = skillsForProject(name);
  console.log(pc.dim("Will require:"));
  for (const [id, version] of Object.entries(skills)) {
    console.log(pc.dim(`  - ${id} ${version}`));
  }
  console.log();

  if (!options.yes && !(await confirm(`Create ${CONFIG_FILE} with these skills?`))) {
    console.log(pc.dim("Aborted."));
    return;
  }

  writeConfig({ project: name, skills }, repoRoot);
  console.log(pc.green(`Created ${CONFIG_FILE}.`));
  console.log(pc.dim("Next: run `astra skills sync` to download the skills."));
}

/** New project: scaffold + register centrally via PR, then set up locally. */
async function createNew(
  name: string,
  options: InitOptions,
  repoRoot: string
): Promise<void> {
  console.log(`Project ${pc.cyan(name)} ${pc.yellow("isn't in Astra yet.")}`);
  if (!options.yes && !(await confirm(`Create and register project "${name}"?`))) {
    console.log(pc.dim("Aborted."));
    return;
  }

  // Register centrally: scaffold a starter skill + policy entry, open a PR.
  const regDir = ensureWorkRegistry();
  const addPaths = scaffoldProject(regDir, name);
  const branch = `project/${name}`;
  const url = commitAndOpenPr(regDir, {
    branch,
    addPaths,
    commitMsg: `Add project ${name}`,
    title: `Add project ${name}`,
    body:
      `Registers a new project "${name}" with a starter conventions skill.\n\n` +
      `Opened by \`astra skills init\`.`,
  });

  // Set up locally from the clone's working tree (which has the new skill on the
  // branch), so the repo works immediately — before the PR merges.
  const skills = skillsForProject(name);
  writeConfig({ project: name, skills }, repoRoot);
  const installed: Record<string, string> = {};
  for (const id of Object.keys(skills)) installed[id] = installSkill(id, repoRoot);
  writeInstalled(installed, repoRoot);

  // Leave the clone back on the default branch for later reads.
  try {
    gitIn(["checkout", defaultBranch(regDir)], regDir);
  } catch {
    /* best effort */
  }

  console.log(pc.green(`\nCreated ${CONFIG_FILE} and installed skills.`));
  reportPr(url, branch);
  console.log(
    pc.dim("Once the PR merges, the project is official for everyone.")
  );
}
