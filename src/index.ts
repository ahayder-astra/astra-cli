#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { init } from "./commands/init";
import { sync } from "./commands/sync";
import { check } from "./commands/check";
import { doctor } from "./commands/doctor";
import { publish } from "./commands/publish";
import { closePrompts } from "./lib/prompt";

const program = new Command();

program
  .name("astra")
  .description("Astra CLI — keep every repo on Astra's engineering standards.")
  .version("0.1.0");

// `astra skills ...` — the skills command group. New groups (e.g. `astra config`)
// can be added alongside this one without touching existing commands.
const skills = program
  .command("skills")
  .description("Manage this repo's required AI skills.");

skills
  .command("init")
  .description("Set up this repo (interactive wizard; creates .astra.yml).")
  .option("-p, --project <project>", "skip the name prompt and use this project")
  .option("-y, --yes", "skip confirmation prompts")
  .option("-f, --force", "overwrite an existing .astra.yml")
  .action((opts) => init(opts));

skills
  .command("sync")
  .description("Download/update the skills required by this repo.")
  .action(() => sync());

skills
  .command("check")
  .description("Check for missing or outdated skills.")
  .option("--ci", "exit with a non-zero code on any problem (for CI)")
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
  .action((name, opts) => publish(name, opts));

// Turn thrown errors (e.g. missing config) into clean messages, not stack traces.
async function main() {
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
