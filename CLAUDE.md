# Astra CLI

Internal CLI that keeps every repo on Astra's required, up-to-date AI skills.
Source in `src/` (Commander + TypeScript), compiled to `dist/`. Per-repo state
lives under `.astra/` (`config.yml` contract, `skills/` content, `skills/manifest.json`).

## CLI UX principle — no dead-ends

The CLI is meant to be intuitive and reactive, not the "world way" that rejects
you for a missing argument. Follow this everywhere you take input:

- **Never dead-end on missing or ambiguous input.** When a human is at the
  terminal, discover what's available and ask (a menu, a fuzzy match,
  confirm-and-run) instead of erroring.
- **Interactive vs. CI split.** Gate every prompt on `isInteractive()`
  (`src/lib/prompt.ts`). With no TTY (a pipe / CI), never prompt — throw a precise
  message that names the exact argument or flag to supply. Prompts must never hang.
- **Every error ends with the next action** (e.g. "Run `astra skills sync`.").
- **Reach for the shared helpers before adding a required argument:**
  - Prompts: `promptSelect`, `promptText`, `confirm`, `promptBump` — built on
    `@clack/prompts` (arrow-key UI, Ctrl-C = clean cancel). Add prompts here, not ad hoc.
  - Resolve a skill argument to an installed scoped id: `resolveInstalledSkill()`
    in `src/lib/resolve.ts` (handles missing/partial/ambiguous input).
  - Ensure the repo is set up: `ensureSetup()` in `src/lib/setup.ts` (offers to
    run `astra init` when interactive; throws precisely under CI).
- Commander args that a human might omit should be **optional** (`[name]`, not
  `<name>`); resolve them at runtime with the helpers above.

## Build & run

```bash
npm run build          # tsc → dist/
node dist/index.js ... # run the built CLI
npm run dev -- ...     # tsx, no build
```
