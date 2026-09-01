import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { SKILLS_DIR } from "./config";
import { copyFiles } from "./fsutil";
import { registryDir, registryUrl, skillsRoot } from "./paths";

/**
 * policy.yml shape.
 * `common` skills apply to every repo. `projects` maps each project to the
 * skills specific to it (on top of common). Entries are skill names within
 * their scope.
 */
export interface Policy {
  common: string[];
  projects: Record<string, string[]>;
}

/** skill.yml shape: a skill owns its own version. */
export interface SkillMeta {
  name: string;
  version: string;
  description?: string;
}

/** Read policy.yml from the skills registry. */
export function readPolicy(): Policy {
  const file = path.join(skillsRoot(), "policy.yml");
  const raw = yaml.load(fs.readFileSync(file, "utf8")) as Partial<Policy>;
  return { common: raw.common ?? [], projects: raw.projects ?? {} };
}

/**
 * Split a scoped skill id (`scope/name`) into its parts, e.g.
 * `common/testing` -> ["common", "testing"]. Throws on an unscoped id.
 */
export function splitSkillId(id: string): [scope: string, name: string] {
  const slash = id.indexOf("/");
  if (slash <= 0 || slash === id.length - 1) {
    throw new Error(`Skill id "${id}" must be scoped as "scope/name".`);
  }
  return [id.slice(0, slash), id.slice(slash + 1)];
}

/** Relative path (within skills root or `.astra/skills`) for a scoped id. */
function skillRelPath(id: string): string {
  const [scope, name] = splitSkillId(id);
  return path.join(scope, name);
}

/** Read a skill's metadata (name, version, description) from its skill.yml. */
export function readSkillMeta(id: string, root = skillsRoot()): SkillMeta {
  const file = path.join(root, skillRelPath(id), "skill.yml");
  if (!fs.existsSync(file)) {
    throw new Error(`Unknown skill "${id}" (no ${skillRelPath(id)}/skill.yml in registry).`);
  }
  const raw = yaml.load(fs.readFileSync(file, "utf8")) as Partial<SkillMeta>;
  if (!raw.version) throw new Error(`${id}/skill.yml is missing a version.`);
  const [, name] = splitSkillId(id);
  return { name: raw.name ?? name, version: raw.version, description: raw.description };
}

/** The current (latest) version the registry holds for a skill. */
export function currentVersion(id: string, root = skillsRoot()): string {
  return readSkillMeta(id, root).version;
}

/**
 * Copy a skill's content from the registry into a consumer repo's
 * `.astra/skills/<scope>/<name>/`. Returns the version that was installed.
 */
export function installSkill(
  id: string,
  consumerRoot: string = process.cwd()
): string {
  const root = skillsRoot();
  const src = path.join(root, skillRelPath(id));
  if (!fs.existsSync(src)) throw new Error(`Unknown skill "${id}".`);
  const dest = path.join(consumerRoot, SKILLS_DIR, skillRelPath(id));
  copyFiles(src, dest);
  return currentVersion(id, root);
}

/** Write a skill.yml with a given version (preserving name/description). */
export function writeSkillMeta(dir: string, meta: SkillMeta): void {
  fs.writeFileSync(
    path.join(dir, "skill.yml"),
    yaml.dump(meta, { sortKeys: false }),
    "utf8"
  );
}

// --- Publish-side: the git clone of the central repo -----------------------

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function isGitRepo(dir: string): boolean {
  return fs.existsSync(path.join(dir, ".git"));
}

/**
 * Ensure a clean, up-to-date clone of the central repo exists locally and
 * return its path. Clones on first use, otherwise fetches and hard-resets to
 * the remote default branch so publishes always start from a clean base.
 */
export function ensureWorkRegistry(): string {
  const dir = registryDir();
  if (!isGitRepo(dir)) {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    execFileSync("git", ["clone", registryUrl(), dir], { stdio: "pipe" });
  } else {
    git(["fetch", "origin", "--quiet"], dir);
    git(["checkout", defaultBranch(dir), "--quiet"], dir);
    git(["reset", "--hard", `origin/${defaultBranch(dir)}`, "--quiet"], dir);
  }
  return dir;
}

/** Best-effort detection of the remote's default branch (main/master). */
export function defaultBranch(dir: string): string {
  try {
    const ref = git(
      ["symbolic-ref", "refs/remotes/origin/HEAD"],
      dir
    );
    return ref.split("/").pop() || "main";
  } catch {
    return "main";
  }
}

export const gitIn = git;

/** True if a project folder (`skills/<name>/`) exists in the given root. */
export function projectExists(name: string, root = skillsRoot()): boolean {
  return fs.existsSync(path.join(root, name));
}

/**
 * Scaffold a brand-new project in a registry clone: create a starter
 * `conventions` skill and register the project in policy.yml. Returns the
 * relative paths that were created/changed (for `git add`).
 */
export function scaffoldProject(regDir: string, name: string): string[] {
  const skillDir = path.join(regDir, "skills", name, "conventions");
  fs.mkdirSync(skillDir, { recursive: true });
  writeSkillMeta(skillDir, {
    name: "conventions",
    version: "1.0.0",
    description: `${name} coding conventions.`,
  });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `# ${name} conventions\n\nConventions for the ${name} project.\n\n## Rules\n\n- TODO: add this project's conventions.\n`,
    "utf8"
  );

  // Register the project in policy.yml (js-yaml round-trip; header re-added).
  const policyPath = path.join(regDir, "skills", "policy.yml");
  const policy = yaml.load(fs.readFileSync(policyPath, "utf8")) as Policy;
  policy.projects = policy.projects ?? {};
  policy.projects[name] = ["conventions"];
  const header =
    "# policy.yml — the central skill policy.\n" +
    "# `common` applies to every repo; `projects` lists each project's own skills.\n" +
    "# Versions live in each skill's skill.yml, not here.\n\n";
  fs.writeFileSync(policyPath, header + yaml.dump(policy, { sortKeys: false }), "utf8");

  return [path.join("skills", name), path.join("skills", "policy.yml")];
}

export interface PrRequest {
  branch: string;
  addPaths: string[];
  commitMsg: string;
  title: string;
  body: string;
}

/**
 * Commit the given paths on a new branch, push, and open a PR. Returns the PR
 * URL, or null if the branch pushed but `gh` could not open the PR (caller
 * prints fallback instructions). Throws if the git steps themselves fail.
 */
export function commitAndOpenPr(regDir: string, req: PrRequest): string | null {
  const base = defaultBranch(regDir);
  try {
    git(["checkout", "-b", req.branch], regDir);
    git(["add", ...req.addPaths], regDir);
    git(["commit", "-m", req.commitMsg], regDir);
    git(["push", "-u", "origin", req.branch], regDir);
  } catch (err) {
    throw new Error(
      `Git failed while publishing (${(err as Error).message.split("\n")[0]}). ` +
        `The branch may already exist — try again after a sync.`
    );
  }
  try {
    return execFileSync(
      "gh",
      ["pr", "create", "--base", base, "--head", req.branch, "--title", req.title, "--body", req.body],
      { cwd: regDir, encoding: "utf8" }
    ).trim();
  } catch {
    return null;
  }
}
