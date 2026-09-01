import readline from "node:readline";
import type { BumpKind } from "./semver";

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Ask a yes/no question on the terminal. Returns true for yes. */
export async function confirm(question: string): Promise<boolean> {
  const answer = await ask(`${question} (y/N) `);
  return /^y(es)?$/i.test(answer);
}

/** Ask which part of the version to bump. Empty answer defaults to patch. */
export async function promptBump(current: string): Promise<BumpKind> {
  const answer = (
    await ask(`Version bump for ${current}? [patch]/minor/major: `)
  ).toLowerCase();
  if (answer === "minor" || answer === "major") return answer;
  return "patch";
}
