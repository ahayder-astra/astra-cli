import readline from "node:readline";
import type { BumpKind } from "./semver";

// A single readline interface with a persistent `line` listener feeding a
// queue. Using rl.question directly loses lines that arrive (e.g. from a pipe)
// between questions; buffering every line into a queue avoids that race.
let rl: readline.Interface | null = null;
let closed = false;
const lineQueue: string[] = [];
const waiters: ((line: string) => void)[] = [];

function ensureReadline(): void {
  if (rl) return;
  rl = readline.createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter(line);
    else lineQueue.push(line);
  });
  rl.on("close", () => {
    closed = true;
    while (waiters.length) waiters.shift()!("");
  });
}

function nextLine(): Promise<string> {
  ensureReadline();
  if (lineQueue.length) return Promise.resolve(lineQueue.shift()!);
  if (closed) return Promise.resolve("");
  return new Promise((resolve) => waiters.push(resolve));
}

async function ask(question: string): Promise<string> {
  ensureReadline();
  process.stdout.write(question);
  return (await nextLine()).trim();
}

/** Close the shared prompt interface so the process can exit. Safe if unused. */
export function closePrompts(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}

/** Ask a yes/no question on the terminal. Returns true for yes. */
export async function confirm(question: string): Promise<boolean> {
  const answer = await ask(`${question} (y/N) `);
  return /^y(es)?$/i.test(answer);
}

/**
 * Ask for a line of text. If a default is given, an empty answer returns it;
 * otherwise the prompt repeats until non-empty. Throws at end-of-input rather
 * than looping when there's no default (e.g. piped stdin ran out).
 */
export async function promptText(
  question: string,
  defaultValue?: string
): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  for (;;) {
    const answer = await ask(`${question}${suffix}: `);
    if (answer) return answer;
    if (defaultValue) return defaultValue;
    if (closed) throw new Error("No project name provided.");
  }
}

/** Ask which part of the version to bump. Empty answer defaults to patch. */
export async function promptBump(current: string): Promise<BumpKind> {
  const answer = (
    await ask(`Version bump for ${current}? [patch]/minor/major: `)
  ).toLowerCase();
  if (answer === "minor" || answer === "major") return answer;
  return "patch";
}
