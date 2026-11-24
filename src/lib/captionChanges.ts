/** Preserve the exact text and highlight the changed span between shared word boundaries. */
export function captionChanges(before: string, after: string) {
  const oldWords = before.match(/\s+|\S+/g) ?? [];
  const newWords = after.match(/\s+|\S+/g) ?? [];
  let start = 0;
  while (start < oldWords.length && start < newWords.length && oldWords[start] === newWords[start]) start++;
  let end = 0;
  while (end < oldWords.length - start && end < newWords.length - start
    && oldWords[oldWords.length - 1 - end] === newWords[newWords.length - 1 - end]) end++;
  return {
    prefix: oldWords.slice(0, start).join(""),
    removed: oldWords.slice(start, oldWords.length - end).join(""),
    added: newWords.slice(start, newWords.length - end).join(""),
    suffix: end ? oldWords.slice(-end).join("") : "",
  };
}

export interface CaptionDiffPart { text: string; changed: boolean }

const tokens = (text: string) => text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
const isSpace = (text: string) => /^\s+$/.test(text);
const tokenKey = (text: string) => isSpace(text) ? " " : text;

function appendPart(parts: CaptionDiffPart[], text: string, changed: boolean) {
  if (!text) return;
  const last = parts.at(-1);
  if (last?.changed === changed) last.text += text;
  else parts.push({ text, changed });
}

/** Word-level changes, retaining exact spacing without marking rewrapped lines as rewritten wording. */
export function captionDiff(before: string, after: string) {
  const oldTokens = tokens(before), newTokens = tokens(after);
  const words = (items: string[]) => items.filter((item) => !isSpace(item)).join("\0");
  const formattingOnly = before !== after && words(oldTokens) === words(newTokens);
  if (formattingOnly || before === after) return {
    before: [{ text: before, changed: false }], after: [{ text: after, changed: false }], formattingOnly,
  };
  if ((oldTokens.length + 1) * (newTokens.length + 1) > 500_000) {
    const span = captionChanges(before, after);
    return { before: [{ text: span.prefix, changed: false }, { text: span.removed, changed: true }, { text: span.suffix, changed: false }],
      after: [{ text: span.prefix, changed: false }, { text: span.added, changed: true }, { text: span.suffix, changed: false }], formattingOnly };
  }
  const width = newTokens.length + 1;
  const table = new Uint32Array((oldTokens.length + 1) * width);
  for (let i = oldTokens.length - 1; i >= 0; i--) {
    for (let j = newTokens.length - 1; j >= 0; j--) {
      table[i * width + j] = tokenKey(oldTokens[i]) === tokenKey(newTokens[j])
        ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const left: CaptionDiffPart[] = [], right: CaptionDiffPart[] = [];
  let i = 0, j = 0;
  while (i < oldTokens.length || j < newTokens.length) {
    if (i < oldTokens.length && j < newTokens.length && tokenKey(oldTokens[i]) === tokenKey(newTokens[j])) {
      appendPart(left, oldTokens[i++], false); appendPart(right, newTokens[j++], false);
    } else if (i < oldTokens.length && (j === newTokens.length || table[(i + 1) * width + j] >= table[i * width + j + 1])) {
      appendPart(left, oldTokens[i], !isSpace(oldTokens[i])); i++;
    } else {
      appendPart(right, newTokens[j], !isSpace(newTokens[j])); j++;
    }
  }
  return { before: left, after: right, formattingOnly };
}
