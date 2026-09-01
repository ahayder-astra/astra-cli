# Astra CLI

Internal CLI that keeps every repo on the required, up-to-date AI skills.
Local runs help developers; **CI is the final enforcement layer.**

This repo is both the **CLI** (`src/`) and the **central source of truth for the
skills** (`skills/`) — a monorepo. Consumer repos sync skills from here and
publish improvements back here as versioned PRs.

## Install in your repo

Add it as a **dev dependency** — no global or separate install needed. It builds
itself on install and links an `astra` command into `node_modules/.bin`.

```bash
npm install -D github:ahayder/astra-cli
```

Then run it with `npx`, or wire it into your scripts and CI:

```jsonc
// package.json
"scripts": {
  "skills:sync": "astra skills sync",
  "skills:check": "astra skills check --ci"   // fails the build on drift
}
```

```bash
npx astra skills init      # onboard the repo (writes .astra.yml)
npx astra skills sync       # pull the skills this repo requires
```

## Develop

Working on the CLI itself (this repo):

```bash
npm install
npm run dev -- skills doctor   # run from source (tsx), no build needed
npm run build                  # compile to dist/
node dist/index.js skills doctor
```

## Commands

| Command | Direction | What it does |
|---|---|---|
| `astra skills init` | — | Interactive wizard: pick the project (suggested from package.json), create `.astra.yml`; registers a brand-new project via PR. |
| `astra skills sync` | ⬇ pull | Download/update the skills this repo requires. |
| `astra skills check` | — | Report missing or outdated skills. |
| `astra skills check --ci` | — | Same, but exit non-zero on any problem (fails the PR). |
| `astra skills doctor` | — | Show this repo's AI setup and any problems. |
| `astra skills new <name>` | — | Scaffold a new skill in this repo (publish it later to register centrally). |
| `astra skills publish <name>` | ⬆ push | Publish a skill to central via PR — bumps an existing skill, or registers a brand-new one. |

## The contract: `.astra.yml`

Committed to each repo and version-controlled like `package.json`. It is the
source of truth for what that repo requires — never changed silently.

```yaml
project: AnimoFrontend
skills:
  common/task-submission: 1.2.0
  common/testing: 1.4.0
  AnimoFrontend/conventions: 1.0.0
```

## The skills registry: `skills/`

Skills are organized in two layers. **`common/`** skills apply to every repo;
each **project** folder holds the skills specific to that project. Skills are
addressed by a scoped id — `scope/name` — so names never collide across
projects. Each skill owns its version in its own `skill.yml`; `policy.yml` maps
projects to the skills they get (no versions there — "latest" is whatever each
`skill.yml` declares).

```
skills/
  policy.yml                     # common + projects -> which skills
  common/
    task-submission/             # the "velox submit" workflow, shared
      skill.yml                  # name, version, description
      SKILL.md                   # the content agents follow
    testing/
  AnimoFrontend/
    conventions/
  AnimoMobileApp/ · AnimoOrion/ · Velox/ · AnimoNext/
```

Rule of thumb: a skill lives in `common/` if the rule is the same across repos;
it lives in a project folder only if that project genuinely does it differently.

## Onboarding a repo (`init` wizard)

`astra skills init` runs a short wizard — no flags to remember:

1. It suggests a project name from `package.json`'s `name` (if present); you
   press Enter to accept or type a different one (or type one from scratch when
   there's no `package.json`).
2. If the name **matches** an existing project, it pins that project's skills and
   writes `.astra.yml`.
3. If the name is **new**, it scaffolds `skills/<name>/conventions/`, adds the
   project to `policy.yml`, and opens a **PR** on the central repo to register
   it — while setting the repo up locally right away. Until that PR merges,
   `sync` shows the project's own skill as *pending central registration*.

Non-interactive use (CI/scripts): `--project <name>` skips the prompt and
`--yes` skips confirmations.

## Publishing a skill change

From inside a consumer repo where the skill is synced:

```bash
# 1. edit the skill in place
$EDITOR .astra/skills/AnimoFrontend/conventions/SKILL.md
# 2. push it back up as a new version (prompts patch/minor/major)
astra skills publish AnimoFrontend/conventions
```

`publish` clones/updates the central repo in `~/.astra/registry`, bumps the
skill's version, and opens a PR. It refuses if central has moved ahead of the
version you synced from (clobber protection).

## Creating a new skill

`.astra/skills/` is committed to each repo (not gitignored — nothing to change
per repo). The manifest tells managed skills (synced from central) apart from
new ones you author locally, so `sync` never clobbers your work.

```bash
# scaffold a skill scoped to this repo's project (or common/<name>)
astra skills new test-skill
$EDITOR .astra/skills/<Project>/test-skill/SKILL.md
# the first publish registers it centrally (adds it to policy.yml) via PR;
# later publishes bump its version
astra skills publish <Project>/test-skill
```

Until the registration PR merges, `sync` shows the new skill as *pending central
registration* and leaves your local copy untouched.

### Configuration

| Env var | Default | Purpose |
|---|---|---|
| `ASTRA_REGISTRY_URL` | `git@github.com:ahayder/astra-cli.git` | Central repo to clone/push. |
| `ASTRA_REGISTRY_DIR` | `~/.astra/registry` | Local clone used for publishing. |
| `ASTRA_HOME` | `~/.astra` | Base dir for CLI state. |

## Where things live in the code

```
src/
  index.ts            # commander — wires up `astra skills <cmd>`
  commands/           # init · sync · check · doctor · publish
  lib/
    config.ts         # read/write .astra.yml
    installed.ts      # tracks what sync wrote (manifest.json)
    paths.ts          # package/registry path + config resolution
    registry.ts       # read policy/skills; scoped ids; clone central for publish
    policy.ts         # resolve project -> required skills (+ versions)
    semver.ts         # version bumping
    fsutil.ts         # copy / compare skill folders
    prompt.ts         # y/N and patch/minor/major prompts
```

## Not built yet

- `astra skills upgrade` — bump `.astra.yml` to central's latest versions (for
  now, hand-edit `.astra.yml` then `sync`).
- Strict historical pinning — `sync` installs central's current version; exact
  older versions via git tags is a future enhancement.
