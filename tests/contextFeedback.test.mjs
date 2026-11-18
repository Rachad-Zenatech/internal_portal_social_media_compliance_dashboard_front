import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";
const sourceFacts = loadService("contextSourceFacts", {}, "lib");
const { contextFeedbackCards } = loadService("contextFeedback", { "@/lib/contextSourceFacts": sourceFacts }, "lib");

function report() {
  return {
    brand_voice: { verdict: "MOSTLY_ON_VOICE", summary: "A generic summary.", follows: [{ quote: "Pilot flights", why: "Names the current stage", title: "Voice guide" }], drifts: [{ quote: "The ultimate drone", why: "An unqualified superlative", rule: "Avoid unprovable superlatives", rewrite: "A drone designed for site inspections", title: "Voice guide" }] },
    facts: { verdict: "UNVERIFIED", summary: "Generic facts summary.", claims: [{ claim: "Cuts inspection time by 80%", result: "NO_FACT", note: "No measured trial is on file." }] },
    platform_norms: { verdict: "NEEDS_WORK", summary: "Generic platform summary.", checks: [{ aspect: "Opening", norm: "Lead with the practical outcome", observation: "The opening talks about company history instead of the inspection benefit.", status: "ADJUST", evidence: "Founded 25 years ago", improvement: "Open with: Inspect hard-to-reach roofs without sending a person up.", title: "LinkedIn guidance" }] },
    audiences: { verdict: "CAUTIOUS", summary: "Generic audience summary.", readings: [{ audience: "Investors", reading: "Could interpret this as a current commercial capability.", reaction: "CAUTIOUS", evidence: "Available today", improvement: "Say: Currently being tested in a pilot programme.", title: "Investor profile" }] }, gaps: [],
  };
}

test("four context cards lead with exact post evidence and specific improvements", () => {
  const cards = contextFeedbackCards(report());
  assert.deepEqual(Array.from(cards, (card) => card.title), ["Brand voice", "Facts", "Platform norms", "Audiences"]);
  assert.equal(cards[0].items[0].evidence, "The ultimate drone");
  assert.equal(cards[0].items[0].improvement, "A drone designed for site inspections");
  assert.match(cards[2].items[0].improvement, /Inspect hard-to-reach roofs/);
  assert.match(cards[3].items[0].improvement, /pilot programme/);
  assert.equal(cards[2].items[0].reference, "LinkedIn guidance");
});

test("unsupported facts request evidence for the exact claim instead of inventing facts", () => {
  const facts = contextFeedbackCards(report())[1];
  assert.equal(facts.status, "attention");
  assert.equal(facts.items[0].evidence, "Cuts inspection time by 80%");
  assert.doesNotMatch(facts.items[0].improvement, /Cuts inspection time by 80%/);
  assert.match(facts.items[0].improvement, /Add a source/);
});

test("missing guidance is shown as missing rather than a violation or a pass", () => {
  const value = report();
  value.brand_voice = { verdict: "NO_GUIDE", summary: "", drifts: [], follows: [] };
  value.platform_norms.checks = [];
  value.audiences.readings = [];
  const cards = contextFeedbackCards(value);
  for (const index of [0, 2, 3]) assert.equal(cards[index].status, "missing");
});

test("positive checks do not manufacture fixes", () => {
  const value = report();
  value.brand_voice.drifts = [];
  value.brand_voice.verdict = "ON_VOICE";
  value.facts.claims[0].result = "MATCHES";
  value.platform_norms.checks[0].status = "FITS";
  const cards = contextFeedbackCards(value);
  assert.equal(cards[0].status, "good");
  assert.equal(cards[1].items[0].improvement, undefined);
  assert.equal(cards[2].items[0].improvement, undefined);
});

test("observed visual brand issues retain their actual change recommendation", () => {
  const finding = { category: "BRAND", basis: "OBSERVED_VISUAL", title: "Logo placement", quote: "Logo covers the product label", why_it_matters: "The logo obscures the name", suggested_revision: "Move the logo to the lower-right safe margin." };
  const card = contextFeedbackCards(report(), [finding])[0];
  assert.ok(card.items.some((item) => item.evidenceType === "OBSERVED_VISUAL" && item.improvement.includes("safe margin")));
});

test("older audience results stay readable without inventing a suggested edit", () => {
  const value = report();
  delete value.audiences.readings[0].evidence;
  delete value.audiences.readings[0].improvement;
  assert.equal(contextFeedbackCards(value)[3].items[0].improvement, undefined);
});

test("card ordering leaves the saved analysis untouched", () => {
  const value = report();
  const before = JSON.stringify(value);
  contextFeedbackCards(value);
  assert.equal(JSON.stringify(value), before);
});

function checkedSource(verdict, reference = "ZenaTech newsroom") {
  return { reference, title: reference, where: "newsroom", status: "READ", url: "https://www.zenatech.com/newsroom/", claims: [{ claim: "Cuts inspection time by 80%", verdict, where: "image", confidence: 1, evidence: "The source describes the inspection trial.", note: verdict === "SUPPORTED" ? null : "Confirm the trial figures against the published report." }] };
}

test("Facts includes newsroom and cited-source comparisons when sentiment omitted its claims", () => {
  const value = report(); value.facts.claims = [];
  const facts = contextFeedbackCards(value, [], [checkedSource("SUPPORTED")])[1];
  assert.equal(facts.status, "good");
  assert.equal(facts.items[0].evidence, "Cuts inspection time by 80%");
  assert.equal(facts.items[0].reference, "ZenaTech newsroom");
  assert.equal(facts.items[0].sourceUrl, "https://www.zenatech.com/newsroom/");
});

test("newsroom support resolves an uncovered claim without hiding an explicit contradiction", () => {
  const supported = checkedSource("SUPPORTED");
  const missing = checkedSource("NOT_FOUND", "Product page");
  assert.equal(contextFeedbackCards(report(), [], [missing, supported])[1].status, "good");
  const conflict = checkedSource("CONTRADICTED", "Published trial");
  const facts = contextFeedbackCards(report(), [], [supported, conflict])[1];
  assert.equal(facts.status, "attention");
  assert.equal(facts.items[0].title, "Sources disagree on this claim");
});

test("unreadable sources do not become verified facts", () => {
  const value = report(); value.facts.claims = [];
  const source = { ...checkedSource("SUPPORTED"), status: "UNREADABLE" };
  const facts = contextFeedbackCards(value, [], [source])[1];
  assert.equal(facts.status, "neutral");
  assert.equal(facts.items.length, 0);
});


test("source suggestions do not repeat the whole caption already shown as evidence", () => {
  const source = checkedSource("NOT_FOUND"); source.claims[0].note = null;
  const facts = contextFeedbackCards(report(), [], [source])[1];
  assert.equal(facts.items[0].evidence, "Cuts inspection time by 80%");
  assert.doesNotMatch(facts.items[0].improvement, /Cuts inspection time by 80%/);
});
