import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { SKILLS_DIR } from "../lib/config";
import { copyFiles, foldersEqual } from "../lib/fsutil";
import { promptBump } from "../lib/prompt";
import {
  defaultBranch,
  ensureWorkRegistry,
  gitIn,
  readSkillMeta,
  writeSkillMeta,
} from "../lib/registry";
import { bump, BumpKind } from "../lib/semver";
import { readInstalled } from "../lib/installed";

interface PublishOptions {
  patch?: boolean;
  minor?: boolean;
  major?: boolean;
  yes?: boolean;
}

function chosenBump(options: PublishOptions): BumpKind | null {
  if (options.major) return "major";
  if (options.minor) return "minor";
  if (options.patch) return "patch";
  return null;
}

/**
 * Publish local edits to a skill back to the central repo as a new version,
 * via a pull request. Refuses if the skill wasn't synced here or if central has
 * moved ahead of the version this repo synced from (clobber protection).
 */
export async function publish(
  name: string,
  options: PublishOptions = {}
): Promise<void> {
  const consumerRoot = process.cwd();
  const consumerSkillsRoot = path.join(consumerRoot, SKILLS_DIR);
  const consumerSkillDir = path.join(consumerSkillsRoot, name);

  // 1. The skill must have been synced into this repo.
  const installed = readInstalled(consumerRoot);
  const basedVersion = installed[name];
  if (!basedVersion || !fs.existsSync(consumerSkillDir)) {
    throw new Error(
      `"${name}" isn't installed in this repo. Run \`astra skills sync\` first.`
    );
  }

  // 2. Bring the central repo clone up to date (clean base to branch from).
  console.log(pc.dim("Preparing central repo…"));
  const regDir = ensureWorkRegistry();
  const central = readSkillMeta(name); // resolves from the fresh clone
  const centralVersion = central.version;

  // 3. Clobber protection: central must still be at the version we synced from.
  if (centralVersion !== basedVersion) {
    throw new Error(
      `You synced ${name}@${basedVersion}, but central is now ${centralVersion}. ` +
        `Run \`astra skills sync\`, re-apply your edit, then publish.`
    );
  }

  // 4. Nothing to do if the content is unchanged.
  const regSkillDir = path.join(regDir, "skills", name);
  if (foldersEqual(consumerSkillDir, regSkillDir, ["skill.yml"])) {
    console.log(pc.dim(`No changes in ${name} to publish.`));
    return;
  }

  // 5. Decide the new version.
  const kind = chosenBump(options) ?? (options.yes ? "patch" : await promptBump(centralVersion));
  const newVersion = bump(centralVersion, kind);
  console.log(`Publishing ${pc.cyan(name)} ${pc.dim(`${centralVersion} → ${newVersion}`)}`);

  // 6. Stage the change in the clone (content + bumped skill.yml).
  copyFiles(consumerSkillDir, regSkillDir, ["skill.yml"]);
  const consumerMeta = readSkillMeta(name, consumerSkillsRoot);
  writeSkillMeta(regSkillDir, {
    name,
    version: newVersion,
    description: consumerMeta.description ?? central.description,
  });

  // 7. Branch, commit, push.
  const branch = `skill/${name}-${newVersion}`;
  const base = defaultBranch(regDir);
  try {
    gitIn(["checkout", "-b", branch], regDir);
    gitIn(["add", path.join("skills", name)], regDir);
    gitIn(["commit", "-m", `Update ${name} to ${newVersion}`], regDir);
    gitIn(["push", "-u", "origin", branch], regDir);
  } catch (err) {
    throw new Error(
      `Git failed while publishing (${(err as Error).message.split("\n")[0]}). ` +
        `The branch may already exist — try again after a sync.`
    );
  }

  // 8. Open a PR (best effort; fall back to instructions if gh is unavailable).
  const title = `Update ${name} to ${newVersion}`;
  const body =
    `Publishes ${name}@${newVersion} (was ${centralVersion}).\n\n` +
    `Opened by \`astra skills publish\`.`;
  try {
    const url = execFileSync(
      "gh",
      ["pr", "create", "--base", base, "--head", branch, "--title", title, "--body", body],
      { cwd: regDir, encoding: "utf8" }
    ).trim();
    console.log(pc.green("\nOpened PR:"), url);
  } catch {
    console.log(
      pc.yellow("\nPushed branch ") +
        pc.cyan(branch) +
        pc.yellow(" but could not open a PR automatically.")
    );
    console.log(pc.dim("Open it manually with: ") + pc.cyan(`gh pr create --head ${branch}`));
  }
}
