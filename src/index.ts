#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { init } from "./commands/init";
import { sync } from "./commands/sync";
import { check } from "./commands/check";
import { doctor } from "./commands/doctor";

const program = new Command();

program
  .name("astra-ai")
  .description("Keep every repo on the required, up-to-date AI skills.")
  .version("0.1.0");

program
  .command("init")
  .description("Bootstrap Astra AI in the current repo (creates .astra-ai.yml).")
  .option("-p, --profile <profile>", "force a profile instead of detecting")
  .option("-y, --yes", "skip the confirmation prompt")
  .option("-f, --force", "overwrite an existing .astra-ai.yml")
  .action((opts) => init(opts));

program
  .command("sync")
  .description("Download/update the skills required by this repo.")
  .action(() => sync());

program
  .command("check")
  .description("Check for missing or outdated skills.")
  .option("--ci", "exit with a non-zero code on any problem (for CI)")
  .action((opts) => check(opts));

program
  .command("doctor")
  .description("Show this repo's AI setup and any problems.")
  .action(() => doctor());

// Turn thrown errors (e.g. missing config) into clean messages, not stack traces.
async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(pc.red((err as Error).message));
    process.exit(1);
  }
}

main();
