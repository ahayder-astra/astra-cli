import pc from "picocolors";
import { readInstalled } from "./installed";
import { isInteractive, promptSelect } from "./prompt";

/** Installed skill ids (scoped, e.g. `Velox/conventions`), sorted. */
function installedIds(repoRoot: string = process.cwd()): string[] {
  return Object.keys(readInstalled(repoRoot)).sort();
}

/** Skills whose name segment or full id matches `input` (case-insensitive). */
function matches(input: string, ids: string[]): string[] {
  const q = input.toLowerCase();
  return ids.filter((id) => {
    const name = id.slice(id.indexOf("/") + 1).toLowerCase();
    return id.toLowerCase() === q || name === q || id.toLowerCase().endsWith(`/${q}`);
  });
}

/** Bullet list of ids for error messages. */
function listing(ids: string[]): string {
  return ids.map((id) => `  - ${id}`).join("\n");
}

/**
 * Resolve a user-supplied skill argument to a full scoped id that is installed
 * in this repo, asking the human to pick when the input is missing or ambiguous.
 *
 * - No input: one installed skill → use it; otherwise show a picker.
 * - Bare/partial input (e.g. `commit-skill`): resolve to the scoped id, or
 *   disambiguate when several scopes share the name.
 * - Under a pipe / CI (no TTY): never prompts — throws a precise message naming
 *   what to pass instead.
 */
export async function resolveInstalledSkill(
  input?: string,
  repoRoot: string = process.cwd()
): Promise<string> {
  const ids = installedIds(repoRoot);
  if (ids.length === 0) {
    throw new Error(
      "No skills are installed in this repo yet.\n" +
        "Run `astra skills sync` to pull required skills, or " +
        "`astra skills new <name>` to scaffold one."
    );
  }

  // No argument: pick from everything installed.
  if (!input) {
    if (ids.length === 1) {
      console.log(pc.dim(`Using the only installed skill: ${pc.cyan(ids[0])}`));
      return ids[0];
    }
    if (!isInteractive()) {
      throw new Error(
        `Pass a skill name. Installed in this repo:\n${listing(ids)}`
      );
    }
    return promptSelect("Which skill do you want to publish?", ids);
  }

  // Exact scoped id — use it as-is.
  if (ids.includes(input)) return input;

  // Fuzzy: match the bare name or a `/name` suffix.
  const hits = matches(input, ids);
  if (hits.length === 1) {
    if (hits[0] !== input) {
      console.log(pc.dim(`Resolved "${input}" → ${pc.cyan(hits[0])}`));
    }
    return hits[0];
  }
  if (hits.length > 1) {
    if (!isInteractive()) {
      throw new Error(
        `"${input}" matches several installed skills:\n${listing(hits)}\n` +
          "Pass the full scoped id (scope/name)."
      );
    }
    return promptSelect(`Which "${input}"?`, hits);
  }

  // No match at all.
  if (!isInteractive()) {
    throw new Error(
      `No installed skill matches "${input}". Installed in this repo:\n${listing(ids)}`
    );
  }
  console.log(pc.yellow(`No skill matches "${input}".`));
  return promptSelect("Pick one to publish:", ids);
}
