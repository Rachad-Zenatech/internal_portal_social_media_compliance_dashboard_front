/** Required rule sets follow the selected brand and target audience. */
export const PUBLIC_DISCLOSURE = "Public Company Disclosure";
const GENERAL = "ZenaTech General";
const DEFENSE = "ZenaDrone Defense";
const CEO = "Shaun CEO Thought Leadership";
const MANAGED = [PUBLIC_DISCLOSURE, GENERAL, DEFENSE, CEO];
const BRAND_SETS: Record<string, string> = {
  ZENATECH: GENERAL,
  SOFTWARE: GENERAL,
  ZENADRONE: DEFENSE,
  DAAS: DEFENSE,
  CEO_THOUGHT_LEADERSHIP: CEO,
};

export function requiredRuleSets(brands: readonly string[], audiences: readonly string[]): string[] {
  const selected = new Set([PUBLIC_DISCLOSURE]);
  for (const brand of brands) if (BRAND_SETS[brand]) selected.add(BRAND_SETS[brand]);
  if (audiences.includes("DEFENSE")) selected.add(DEFENSE);
  return MANAGED.filter((name) => selected.has(name));
}

export function resolveRuleSets(brands: readonly string[], audiences: readonly string[], selected: readonly string[] = []): string[] {
  return [...new Set([...requiredRuleSets(brands, audiences), ...selected.filter((name) => !MANAGED.includes(name))])];
}

export function ruleSetOptions(options: readonly string[], brands: readonly string[], audiences: readonly string[]): string[] {
  const required = requiredRuleSets(brands, audiences);
  return [...new Set([...required, ...options.filter((name) => !MANAGED.includes(name))])];
}
