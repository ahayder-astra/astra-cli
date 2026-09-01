# Astra CLI

Internal CLI that keeps every repo on the required, up-to-date AI skills.
Local runs help developers; **CI is the final enforcement layer.**

This repo is both the **CLI** (`src/`) and the **central source of truth for the
skills** (`skills/`) — a monorepo. Consumer repos sync skills from here and
publish improvements back here as versioned PRs.

## Develop

```bash
npm install
npm run dev -- skills doctor   # run from source (tsx), no build needed
npm run build                  # compile to dist/
node dist/index.js skills doctor
```

## Commands

| Command | Direction | What it does |
|---|---|---|
| `astra skills init` | — | Detect repo type, suggest a profile, create `.astra.yml`. |
| `astra skills sync` | ⬇ pull | Download/update the skills this repo requires. |
| `astra skills check` | — | Report missing or outdated skills. |
| `astra skills check --ci` | — | Same, but exit non-zero on any problem (fails the PR). |
| `astra skills doctor` | — | Show this repo's AI setup and any problems. |
| `astra skills publish <name>` | ⬆ push | Publish local edits to a skill back to central as a new version (via PR). |

## The contract: `.astra.yml`

Committed to each repo and version-controlled like `package.json`. It is the
source of truth for what that repo requires — never changed silently.

```yaml
profile: frontend
skills:
  velox-submit: 1.2.0
  testing: 1.4.0
  frontend-conventions: 2.1.0
```

## The skills registry: `skills/`

Each skill owns its version in its own `skill.yml`; `policy.yml` maps repo
profiles to the skills they get (no versions there — "latest" is whatever each
`skill.yml` declares).

```
skills/
  policy.yml                     # baseline + profiles -> which skills
  frontend-conventions/
    skill.yml                    # name, version, description
    SKILL.md                     # the content agents follow
```

## Publishing a skill change

From inside a consumer repo where the skill is synced:

```bash
# 1. edit the skill in place
$EDITOR .astra/skills/frontend-conventions/SKILL.md
# 2. push it back up as a new version (prompts patch/minor/major)
astra skills publish frontend-conventions
```

`publish` clones/updates the central repo in `~/.astra/registry`, bumps the
skill's version, and opens a PR. It refuses if the skill wasn't synced here, or
if central has moved ahead of the version you synced from (clobber protection).

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
    registry.ts       # read policy/skills; clone & manage central for publish
    policy.ts         # resolve profile -> required skills (+ versions)
    detect.ts         # guess profile from package.json / go.mod / etc.
    semver.ts         # version bumping
    fsutil.ts         # copy / compare skill folders
    prompt.ts         # y/N and patch/minor/major prompts
```

## Not built yet

- `astra skills upgrade` — bump `.astra.yml` to central's latest versions (for
  now, hand-edit `.astra.yml` then `sync`).
- Strict historical pinning — `sync` installs central's current version; exact
  older versions via git tags is a future enhancement.
