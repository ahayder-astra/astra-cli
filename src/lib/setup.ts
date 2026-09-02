import pc from "picocolors";
import { CONFIG_FILE, configExists } from "./config";
import { confirm, isInteractive } from "./prompt";
import { init } from "../commands/init";

/**
 * Ensure this repo is initialized before a command that needs the contract.
 * If it isn't, offer to run `astra init` right here when a human is present;
 * under a pipe / CI, throw the precise "run init" message instead of prompting.
 * Returns true when the repo is ready to proceed.
 */
export async function ensureSetup(): Promise<boolean> {
  if (configExists()) return true;

  if (!isInteractive()) {
    throw new Error(`No ${CONFIG_FILE} found. Run \`astra init\` first.`);
  }

  console.log(pc.yellow("This repo isn't set up for Astra yet."));
  if (!(await confirm("Run `astra init` now?"))) {
    console.log(pc.dim("Run `astra init` when you're ready."));
    return false;
  }

  await init();
  return configExists();
}
