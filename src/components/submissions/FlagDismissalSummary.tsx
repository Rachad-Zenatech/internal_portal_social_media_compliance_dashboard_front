interface Props {
  kind: "requested" | "dismissed";
  name: string;
  reason: string;
  note?: string | null;
  age?: string;
}

/** Keep dismissal metadata readable without encoding-dependent punctuation. */
export default function FlagDismissalSummary({ kind, name, reason, note, age }: Props) {
  const label = kind === "requested" ? "Dismissal requested" : "Dismissed";
  return (
    <span>
      <strong>{label}</strong> by {name}{" - "}{reason}
      {note ? `: "${note}"` : ""}{age ? ` - ${age}` : ""}
    </span>
  );
}
