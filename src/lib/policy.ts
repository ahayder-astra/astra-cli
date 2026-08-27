/**
 * The central skill policy.
 *
 * In the real system this is fetched from the central git repo. For now it's
 * inlined so the CLI works end-to-end. Versions here are the "latest known"
 * versions the central repo publishes.
 */
export interface Policy {
  baseline: Record<string, string>;
  profiles: Record<string, Record<string, string>>;
}

export const POLICY: Policy = {
  baseline: {
    "velox-submit": "1.2.0",
    testing: "1.4.0",
  },
  profiles: {
    frontend: {
      "frontend-conventions": "2.1.0",
    },
    backend: {
      "backend-conventions": "1.0.0",
    },
  },
};

/** Resolve the full set of required skills for a profile (baseline + profile). */
export function skillsForProfile(profile: string): Record<string, string> {
  const profileSkills = POLICY.profiles[profile] ?? {};
  return { ...POLICY.baseline, ...profileSkills };
}
