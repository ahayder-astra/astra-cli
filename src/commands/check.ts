import pc from "picocolors";
import { readConfig } from "../lib/config";
import { readInstalled } from "../lib/installed";
import { ensureSetup } from "../lib/setup";

interface CheckOptions {
  ci?: boolean;
}

type Status = "ok" | "missing" | "outdated";

interface Row {
  name: string;
  required: string;
  installed: string | null;
  status: Status;
}

/**
 * Compare what `.astra/config.yml` requires against what is actually installed.
 * Prints a report. In --ci mode, exits non-zero if anything is wrong so the
 * pipeline fails — this is the "hard enforcement" layer.
 */
export async function check(options: CheckOptions = {}): Promise<void> {
  if (!(await ensureSetup())) return;
  const config = readConfig();
  const installed = readInstalled();

  const rows: Row[] = Object.entries(config.skills).map(([name, required]) => {
    const have = installed[name] ?? null;
    let status: Status;
    if (have === null) status = "missing";
    else if (have !== required) status = "outdated";
    else status = "ok";
    return { name, required, installed: have, status };
  });

  for (const row of rows) {
    if (row.status === "ok") {
      console.log(`  ${pc.green("✓")} ${row.name} ${pc.dim(row.required)}`);
    } else if (row.status === "outdated") {
      console.log(
        `  ${pc.yellow("↑")} ${row.name} ${pc.dim(
          `installed ${row.installed}, requires ${row.required}`
        )}`
      );
    } else {
      console.log(
        `  ${pc.red("✗")} ${row.name} ${pc.dim(
          `missing, requires ${row.required}`
        )}`
      );
    }
  }

  const problems = rows.filter((r) => r.status !== "ok");

  console.log();
  if (problems.length === 0) {
    console.log(pc.green("All skills present and up to date."));
    return;
  }

  console.log(
    pc.red(`${problems.length} skill(s) missing or outdated.`) +
      pc.dim("  Run `astra skills sync` to fix.")
  );

  if (options.ci) {
    process.exit(1);
  }
}
