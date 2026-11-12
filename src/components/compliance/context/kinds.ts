import { BookOpenText, Megaphone, Smartphone, Users } from "lucide-react";

import type { ContextEntryInput, ContextKind } from "@/types/context";

export interface KindInfo {
  value: ContextKind;
  label: string;
  icon: typeof Megaphone;
  tone: string;
  active: string;
  help: string;
}

/** A value and its display name, as used by the brand, audience and platform pickers. */
export interface Option {
  value: string;
  label: string;
}

// Each kind keeps its own colour: on its tab, its entries and the help line.
export const KINDS: KindInfo[] = [
  {
    value: "BRAND_VOICE",
    tone: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    active: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200",
    label: "Brand voice",
    icon: Megaphone,
    help: "How each brand should sound: tone, words it uses and avoids, and examples. Scope it to the brand.",
  },
  {
    value: "FACT",
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    active: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200",
    label: "Facts",
    icon: BookOpenText,
    help: "What's true about products, partners and the company (e.g. which products are shipping vs in trials). Add the date and source.",
  },
  {
    value: "PLATFORM_NORM",
    tone: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    active: "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-200",
    label: "Platform norms",
    icon: Smartphone,
    help: "What each platform's audience expects, so tone is judged against where it's posted.",
  },
  {
    value: "AUDIENCE_PROFILE",
    tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    active: "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200",
    label: "Audience profiles",
    icon: Users,
    help: "What each audience cares about and how they tend to read things.",
  },
];

export const kindInfo = (kind: ContextKind) => KINDS.find((k) => k.value === kind)!;

export const EMPTY = (kind: ContextKind): ContextEntryInput => ({
  kind,
  title: "",
  body: "",
  do_examples: null,
  dont_examples: null,
  brands: [],
  audiences: [],
  platforms: [],
  source: null,
  as_of: null,
  is_active: true,
});
