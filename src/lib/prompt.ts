import {
  confirm as clackConfirm,
  select,
  text,
  isCancel,
  cancel,
} from "@clack/prompts";
import { bump, type BumpKind } from "./semver";

/**
 * The prompt layer, built on @clack/prompts. Interactive prompts assume a real
 * terminal — callers should gate on `isInteractive()` and fail with a precise,
 * actionable message when there isn't one (a pipe or CI), rather than letting a
 * prompt hang. Every prompt handles Ctrl-C as a clean cancel, not a stack trace.
 */

/** True when a human is at the terminal (vs. a pipe / CI redirect). */
export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY);
}

/** Unwrap a clack answer, exiting cleanly if the user cancelled (Ctrl-C). */
function guard<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  return value as T;
}

/** Guard against a prompt being reached without a terminal (would hang). */
function requireTty(): void {
  if (!isInteractive()) {
    throw new Error("This step needs an interactive terminal.");
  }
}

/** Kept for callers' `finally` blocks; clack needs no teardown. */
export function closePrompts(): void {
  /* no-op */
}

/** Ask a yes/no question. Returns true for yes. */
export async function confirm(question: string): Promise<boolean> {
  requireTty();
  return guard(await clackConfirm({ message: question }));
}

/** One choice in a `promptSelect` list. */
export interface SelectOption {
  value: string;
  label?: string;
  hint?: string;
}

/**
 * Arrow-key single-select. Options may be plain strings or `{value,label,hint}`.
 * Returns the chosen value.
 */
export async function promptSelect(
  message: string,
  options: (string | SelectOption)[]
): Promise<string> {
  requireTty();
  const opts = options.map((o) => (typeof o === "string" ? { value: o } : o));
  return guard(await select({ message, options: opts })) as string;
}

/**
 * Ask for a line of text. With a default, an empty answer returns it; without
 * one, the answer is required.
 */
export async function promptText(
  question: string,
  defaultValue?: string
): Promise<string> {
  requireTty();
  const answer = guard(
    await text({
      message: question,
      placeholder: defaultValue,
      defaultValue,
      validate: defaultValue
        ? undefined
        : (v) => (v && v.length ? undefined : "Please enter a value."),
    })
  );
  return answer || defaultValue || "";
}

/** Ask which part of the version to bump, showing the resulting version. */
export async function promptBump(current: string): Promise<BumpKind> {
  requireTty();
  const kinds: BumpKind[] = ["patch", "minor", "major"];
  return guard(
    await select<BumpKind>({
      message: `Version bump for ${current}?`,
      initialValue: "patch",
      options: kinds.map((kind) => ({
        value: kind,
        label: kind,
        hint: `${current} → ${bump(current, kind)}`,
      })),
    })
  );
}
