import type { SentimentFinding, SentimentResult } from "@/types/sentiment";

export type MessagingReport = NonNullable<SentimentResult["context_report"]>;
export type ContextFeedback = { title: string; evidence?: string | null; evidenceType?: string; reason: string; improvement?: string | null; rule?: string | null; reference?: string | null; sourceUrl?: string | null; attention: boolean };
export type ContextCard = { key: string; title: string; status: "attention" | "good" | "missing" | "neutral"; label: string; items: ContextFeedback[]; empty: string };

function suggestedEdit(findings: SentimentFinding[], evidence?: string | null): string | undefined {
  if (!evidence?.trim()) return undefined;
  const normal = evidence.trim().toLowerCase();
  return findings.find((finding) => finding.suggested_revision && finding.quote.trim().toLowerCase() === normal)?.suggested_revision ?? undefined;
}

function brandCard(report: MessagingReport, findings: SentimentFinding[]): ContextCard {
  const voice = report.brand_voice;
  const drifts: ContextFeedback[] = voice.drifts.map((line) => ({ title: line.rule || "Wording to adjust", evidence: line.quote, reason: line.why, improvement: line.rewrite || suggestedEdit(findings, line.quote), reference: line.title, attention: true }));
  const visuals = findings.filter((finding) => finding.category === "BRAND" && ["OBSERVED_VISUAL", "OBSERVED_AUDIO"].includes(finding.basis));
  drifts.push(...visuals.map((finding) => ({ title: finding.title, evidence: finding.quote, evidenceType: finding.basis, reason: finding.why_it_matters, improvement: finding.suggested_revision, attention: true })));
  const positive = voice.follows.map((line) => ({ title: "Works well", evidence: line.quote, reason: line.why, reference: line.title, attention: false }));
  const missing = voice.verdict === "NO_GUIDE";
  return { key: "brand", title: "Brand voice", status: missing ? "missing" : drifts.length ? "attention" : "good", label: missing ? "No voice guide" : drifts.length ? "Needs attention" : "Fits your voice", items: [...drifts, ...positive], empty: missing ? "No brand voice guide was available for this check. Add your guide to assess this post against it." : voice.summary };
}

function platformCard(report: MessagingReport, findings: SentimentFinding[]): ContextCard {
  const norms = report.platform_norms;
  const items: ContextFeedback[] = norms.checks.map((check) => ({
    title: check.aspect, evidence: check.evidence, evidenceType: check.evidence_type, reason: check.observation,
    rule: check.norm, reference: check.title, attention: check.status === "ADJUST",
    improvement: check.status === "ADJUST" ? check.improvement || suggestedEdit(findings, check.evidence) || `Adjust the ${check.aspect.toLowerCase()} to follow this guidance: ${check.norm}` : undefined,
  }));
  const attention = items.some((item) => item.attention);
  return { key: "platforms", title: "Platform norms", status: !items.length ? "missing" : attention ? "attention" : "good", label: !items.length ? "No platform guidance" : attention ? "Adjust for the platform" : "Fits the platform", items, empty: "No platform-specific guidance was available. Add norms for the platform you selected to check this post against them." };
}

function audienceCard(report: MessagingReport, findings: SentimentFinding[]): ContextCard {
  const items: ContextFeedback[] = report.audiences.readings.map((reading) => ({
    title: reading.audience, evidence: reading.evidence, evidenceType: reading.evidence_type,
    reason: reading.reading, reference: reading.title, attention: ["CAUTIOUS", "NEGATIVE"].includes(reading.reaction),
    improvement: reading.improvement || suggestedEdit(findings.filter((finding) => finding.category === "AUDIENCE"), reading.evidence),
  }));
  const attention = items.some((item) => item.attention);
  return { key: "audiences", title: "Audiences", status: !items.length ? "missing" : attention ? "attention" : "good", label: !items.length ? "No audience profiles" : attention ? "May be misunderstood" : "Fits your audiences", items, empty: "No audience profiles were available for this check. Add profiles for your selected audiences to get specific feedback." };
}

/** Each card leads with an observed issue and its fix, rather than a generic assessment. */
export function contextFeedbackCards(report: MessagingReport, findings: SentimentFinding[] = []): ContextCard[] {
  const cards = [brandCard(report, findings), platformCard(report, findings), audienceCard(report, findings)];
  return cards.map((card) => ({ ...card, items: [...card.items].sort((a, b) => Number(b.attention) - Number(a.attention)) }));
}
