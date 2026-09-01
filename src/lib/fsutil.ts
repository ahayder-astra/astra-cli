import fs from "node:fs";
import path from "node:path";

/** List file names (not dirs) directly inside a folder. Empty if missing. */
function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort();
}

/**
 * Copy every file from src into dest (creating dest), overwriting.
 * Shallow — skills are flat folders of files. `exclude` skips names.
 */
export function copyFiles(
  src: string,
  dest: string,
  exclude: string[] = []
): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of listFiles(src)) {
    if (exclude.includes(name)) continue;
    fs.copyFileSync(path.join(src, name), path.join(dest, name));
  }
}

/**
 * True if two folders hold the same files with identical contents,
 * ignoring names in `exclude`. Used to detect whether a skill actually changed.
 */
export function foldersEqual(
  a: string,
  b: string,
  exclude: string[] = []
): boolean {
  const filesA = listFiles(a).filter((n) => !exclude.includes(n));
  const filesB = listFiles(b).filter((n) => !exclude.includes(n));
  if (filesA.length !== filesB.length) return false;
  if (filesA.some((n, i) => n !== filesB[i])) return false;
  return filesA.every((name) =>
    fs.readFileSync(path.join(a, name)).equals(fs.readFileSync(path.join(b, name)))
  );
}
