# Astra AI CLI

Internal CLI that keeps every repo on the required, up-to-date AI skills.
Local runs help developers; **CI is the final enforcement layer.**

## Develop

```bash
npm install
npm run dev -- doctor      # run from source (tsx), no build needed
npm run build              # compile to dist/
node dist/index.js doctor  # run the built CLI
```

## Commands

| Command | What it does |
|---|---|
| `astra skills init` | Detect repo type, suggest a profile, create `.astra.yml`. |
| `astra skills sync` | Download/update the skills this repo requires. |
| `astra skills check` | Report missing or outdated skills. |
| `astra skills check --ci` | Same, but exit non-zero on any problem (fails the PR). |
| `astra skills doctor` | Show this repo's AI setup and any problems. |

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

## Where things live in the code

```
src/
  index.ts            # commander setup — wires up the 4 commands
  commands/           # one file per command
  lib/
    config.ts         # read/write .astra.yml
    installed.ts      # tracks what sync actually wrote (manifest.json)
    policy.ts         # central baseline + profile skills  (TODO: load from git)
    detect.ts         # guess profile from package.json / go.mod / etc.
    registry.ts       # fetch a skill  (TODO: git clone/pull the central repo)
```

## Not built yet (the real seams)

- `policy.ts` — fetch the central policy from the skills git repo instead of the
  inlined constant.
- `registry.ts` — clone/pull the central skills repo into a cache and copy the
  tagged version, instead of writing a placeholder.
