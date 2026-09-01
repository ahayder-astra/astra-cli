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
  splitSkillId,
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
 * via a pull request. `id` is a scoped skill id like `AnimoFrontend/conventions`
 * or `common/task-submission`. Refuses if the skill wasn't synced here or if
 * central has moved ahead of the version this repo synced from.
 */
export async function publish(
  id: string,
  options: PublishOptions = {}
): Promise<void> {
  const [, skillName] = splitSkillId(id);
  const rel = path.join(...id.split("/"));
  const consumerRoot = process.cwd();
  const consumerSkillsRoot = path.join(consumerRoot, SKILLS_DIR);
  const consumerSkillDir = path.join(consumerSkillsRoot, rel);

  // 1. The skill must have been synced into this repo.
  const installed = readInstalled(consumerRoot);
  const basedVersion = installed[id];
  if (!basedVersion || !fs.existsSync(consumerSkillDir)) {
    throw new Error(
      `"${id}" isn't installed in this repo. Run \`astra skills sync\` first.`
    );
  }

  // 2. Bring the central repo clone up to date (clean base to branch from).
  console.log(pc.dim("Preparing central repo…"));
  const regDir = ensureWorkRegistry();
  const central = readSkillMeta(id); // resolves from the fresh clone
  const centralVersion = central.version;

  // 3. Clobber protection: central must still be at the version we synced from.
  if (centralVersion !== basedVersion) {
    throw new Error(
      `You synced ${id}@${basedVersion}, but central is now ${centralVersion}. ` +
        `Run \`astra skills sync\`, re-apply your edit, then publish.`
    );
  }

  // 4. Nothing to do if the content is unchanged.
  const regSkillDir = path.join(regDir, "skills", rel);
  if (foldersEqual(consumerSkillDir, regSkillDir, ["skill.yml"])) {
    console.log(pc.dim(`No changes in ${id} to publish.`));
    return;
  }

  // 5. Decide the new version.
  const kind = chosenBump(options) ?? (options.yes ? "patch" : await promptBump(centralVersion));
  const newVersion = bump(centralVersion, kind);
  console.log(`Publishing ${pc.cyan(id)} ${pc.dim(`${centralVersion} → ${newVersion}`)}`);

  // 6. Stage the change in the clone (content + bumped skill.yml).
  copyFiles(consumerSkillDir, regSkillDir, ["skill.yml"]);
  const consumerMeta = readSkillMeta(id, consumerSkillsRoot);
  writeSkillMeta(regSkillDir, {
    name: skillName,
    version: newVersion,
    description: consumerMeta.description ?? central.description,
  });

  // 7. Branch, commit, push.
  const branch = `skill/${id.replace(/\//g, "-")}-${newVersion}`;
  const base = defaultBranch(regDir);
  try {
    gitIn(["checkout", "-b", branch], regDir);
    gitIn(["add", path.join("skills", rel)], regDir);
    gitIn(["commit", "-m", `Update ${id} to ${newVersion}`], regDir);
    gitIn(["push", "-u", "origin", branch], regDir);
  } catch (err) {
    throw new Error(
      `Git failed while publishing (${(err as Error).message.split("\n")[0]}). ` +
        `The branch may already exist — try again after a sync.`
    );
  }

  // 8. Open a PR (best effort; fall back to instructions if gh is unavailable).
  const title = `Update ${id} to ${newVersion}`;
  const body =
    `Publishes ${id}@${newVersion} (was ${centralVersion}).\n\n` +
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
