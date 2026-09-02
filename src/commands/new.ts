import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { SKILLS_DIR, readConfig, writeConfig } from "../lib/config";
import { readInstalled, writeInstalled } from "../lib/installed";
import { writeSkillMeta } from "../lib/registry";
import { isInteractive, promptSelect, promptText } from "../lib/prompt";
import { ensureSetup } from "../lib/setup";

const NAME_RE = /^[A-Za-z0-9_-]+$/;

/**
 * Scaffold a brand-new skill in this repo. It's authored locally and committed
 * like any file; `astra skills publish <id>` later registers it centrally.
 *
 * `arg` is either a bare name (scoped to this repo's project), `scope/name`
 * (scope = `common` or this repo's project), or omitted — in which case a human
 * is prompted for the name and scope.
 */
export async function newSkill(arg?: string): Promise<void> {
  if (!(await ensureSetup())) return;
  const config = readConfig();
  const repoRoot = process.cwd();

  // Resolve scope + name.
  let scope: string;
  let name: string;
  if (arg && arg.includes("/")) {
    const slash = arg.indexOf("/");
    scope = arg.slice(0, slash);
    name = arg.slice(slash + 1);
    if (scope !== "common" && scope !== config.project) {
      throw new Error(
        `Scope must be "common" or "${config.project}" (this repo's project).`
      );
    }
  } else if (arg) {
    scope = config.project;
    name = arg;
  } else {
    // No argument: ask, rather than erroring on a missing required arg.
    if (!isInteractive()) {
      throw new Error(
        "Pass a skill name, e.g. `astra skills new my-skill` or " +
          "`astra skills new common/my-skill`."
      );
    }
    name = await promptText("Skill name");
    scope = await promptSelect("Scope", [
      { value: config.project, label: config.project, hint: "this repo's project" },
      { value: "common", label: "common", hint: "shared across all projects" },
    ]);
  }

  if (!NAME_RE.test(name)) {
    throw new Error(`Invalid skill name "${name}". Use letters, numbers, - and _.`);
  }

  const id = `${scope}/${name}`;
  const dir = path.join(repoRoot, SKILLS_DIR, scope, name);
  if (fs.existsSync(dir) || config.skills[id]) {
    throw new Error(`Skill "${id}" already exists here.`);
  }

  // Scaffold the skill folder.
  fs.mkdirSync(dir, { recursive: true });
  writeSkillMeta(dir, { name, version: "1.0.0", description: `TODO: describe ${id}.` });
  fs.writeFileSync(
    path.join(dir, "SKILL.md"),
    `# ${name}\n\n> TODO: write this skill.\n\n## Rules\n\n- \n`,
    "utf8"
  );

  // Require it in this repo, and mark it installed so `check` stays green.
  config.skills[id] = "1.0.0";
  writeConfig(config, repoRoot);
  const installed = readInstalled(repoRoot);
  installed[id] = "1.0.0";
  writeInstalled(installed, repoRoot);

  console.log(pc.green(`Created skill ${pc.cyan(id)} at ${path.relative(repoRoot, dir)}/`));
  console.log(pc.dim("Edit SKILL.md, then run:"));
  console.log(pc.cyan(`  astra skills publish ${id}`));
}
