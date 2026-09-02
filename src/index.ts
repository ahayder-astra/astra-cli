#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { init } from "./commands/init";
import { sync } from "./commands/sync";
import { check } from "./commands/check";
import { doctor } from "./commands/doctor";
import { publish } from "./commands/publish";
import { newSkill } from "./commands/new";
import { closePrompts } from "./lib/prompt";

/** Render a dim "Examples:" block for a command's after-help text. */
function examples(...lines: string[]): string {
  return "\n" + pc.bold("Examples:") + "\n" + lines.map((l) => pc.dim("  " + l)).join("\n") + "\n";
}

const program = new Command();

program
  .name("astra")
  .description("Astra CLI — keep every repo on Astra's engineering standards.")
  .version("0.1.0", "-V, --version", "print the version and exit")
  .showHelpAfterError("(run `astra --help` for usage)")
  .showSuggestionAfterError()
  .addHelpText(
    "after",
    examples(
      "astra init                       set up this repo (wizard + activity hooks)",
      "astra init -p AnimoFrontend -y   non-interactive setup",
      "astra skills sync                pull the skills this repo requires",
      "astra skills check --ci          fail CI when skills drift",
      "astra skills publish common/testing --minor"
    )
  );

// `astra init` — wire up the repo: run the project wizard (skills in) and install
// the activity hooks (telemetry out). Skills and hooks are peers of `init`.
program
  .command("init")
  .description("Set up this repo: project wizard (.astra/config.yml) + activity hooks.")
  .option("-p, --project <project>", "skip the name prompt and use this project")
  .option("-y, --yes", "skip confirmation prompts")
  .option("-f, --force", "overwrite an existing .astra/config.yml")
  .addHelpText(
    "after",
    examples(
      "astra init                 interactive wizard",
      "astra init -p Velox -y     skip prompts, use project Velox",
      "astra init --force         re-run and overwrite .astra/config.yml"
    )
  )
  .action((opts) => init(opts));

// `astra skills ...` — the skills command group. New groups (e.g. `astra config`)
// can be added alongside this one without touching existing commands.
// No `.action`: bare `astra skills` prints this group's help, and an unknown
// subcommand still errors with a "did you mean …?" suggestion.
const skills = program
  .command("skills")
  .description("Manage this repo's required AI skills.");

skills
  .command("sync")
  .description("Download/update the skills required by this repo.")
  .addHelpText("after", examples("astra skills sync"))
  .action(() => sync());

skills
  .command("check")
  .description("Check for missing or outdated skills.")
  .option("--ci", "exit with a non-zero code on any problem (for CI)")
  .addHelpText(
    "after",
    examples(
      "astra skills check          report drift",
      "astra skills check --ci     fail the build on any drift"
    )
  )
  .action((opts) => check(opts));

skills
  .command("doctor")
  .description("Show this repo's AI setup and any problems.")
  .action(() => doctor());

skills
  .command("publish <name>")
  .description("Publish local edits to a skill back to central as a new version (via PR).")
  .option("--patch", "bump the patch version")
  .option("--minor", "bump the minor version")
  .option("--major", "bump the major version")
  .option("-y, --yes", "accept the default (patch) without prompting")
  .addHelpText(
    "after",
    examples(
      "astra skills publish AnimoFrontend/conventions",
      "astra skills publish common/testing --minor"
    )
  )
  .action((name, opts) => publish(name, opts));

skills
  .command("new <name>")
  .description("Scaffold a new skill in this repo (publish it later to register centrally).")
  .addHelpText(
    "after",
    examples(
      "astra skills new test-skill            scope to this repo's project",
      "astra skills new common/formatting     a shared (common) skill"
    )
  )
  .action((name) => newSkill(name));

// Turn thrown errors (e.g. missing config) into clean messages, not stack traces.
async function main() {
  // Bare `astra` with no command: show help instead of doing nothing.
  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(pc.red((err as Error).message));
    process.exit(1);
  } finally {
    closePrompts();
  }
}

main();
