import { currentVersion, readPolicy } from "./registry";

/** Names of the projects defined in the central policy. */
export function knownProjects(): string[] {
  return Object.keys(readPolicy().projects);
}

/**
 * Resolve the full set of required skills for a project — common skills plus
 * the project's own — as a map of scoped id (`scope/name`) to current version.
 */
export function skillsForProject(project: string): Record<string, string> {
  const policy = readPolicy();
  const ids = [
    ...policy.common.map((name) => `common/${name}`),
    ...(policy.projects[project] ?? []).map((name) => `${project}/${name}`),
  ];
  const skills: Record<string, string> = {};
  for (const id of ids) {
    skills[id] = currentVersion(id);
  }
  return skills;
}
