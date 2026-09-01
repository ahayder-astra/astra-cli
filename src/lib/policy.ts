import { currentVersion, readPolicy } from "./registry";

/** Names of the profiles defined in the central policy. */
export function knownProfiles(): string[] {
  return Object.keys(readPolicy().profiles);
}

/**
 * Resolve the full set of required skills for a profile (baseline + profile),
 * pinned to each skill's current registry version.
 */
export function skillsForProfile(profile: string): Record<string, string> {
  const policy = readPolicy();
  const names = [...policy.baseline, ...(policy.profiles[profile] ?? [])];
  const skills: Record<string, string> = {};
  for (const name of names) {
    skills[name] = currentVersion(name);
  }
  return skills;
}
