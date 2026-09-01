export type BumpKind = "patch" | "minor" | "major";

/** Parse a strict "MAJOR.MINOR.PATCH" string. Throws on anything else. */
function parse(version: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!m) throw new Error(`Invalid version "${version}" (expected x.y.z).`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Return `version` bumped by the given kind. */
export function bump(version: string, kind: BumpKind): string {
  const [major, minor, patch] = parse(version);
  switch (kind) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}
