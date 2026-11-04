import { displayText } from "@/lib/scriptDoc";

type Change = { removed: string; added: string };

const plain = (s: string) => displayText(s).replace(/\s+/g, " ").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * What a highlighted stretch of wording reads now, given the changes between the version the reviewer read and the one
 * being sent. `null` when none of those changes touched it; an empty string when it was removed.
 */
export function updatedWording(highlighted: string, changes: Change[]): string | null {
  const whole = plain(highlighted).toLowerCase();
  let out = highlighted;
  let touched = false;
  for (const c of changes) {
    const removed = plain(c.removed);
    if (!removed) continue; // wording only added elsewhere
    const added = plain(c.added);
    if (whole.includes(removed.toLowerCase())) {
      // The change is inside the highlighted wording.
      out = out.replace(new RegExp(escapeRe(removed), "i"), added);
      touched = true;
    } else if (removed.toLowerCase().includes(whole)) {
      // The whole highlighted wording sits inside a bigger rewrite.
      return added;
    }
  }
  return touched ? out.replace(/\s+/g, " ").trim() : null;
}
