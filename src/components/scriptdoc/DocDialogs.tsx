import { CheckInDialog, DecisionDialog, Level2Dialog, SubmitDialog } from "@/components/scriptdoc/ReviewDialogs";
import type { Capacity, DocDetail, Vote } from "@/types/scriptDoc";

export type DialogName = "submit" | "bulk" | "checkIn" | "level2" | "decide";

type Reviewers = { user_id: string; capacity: Capacity }[];

/** Every dialog of the review: send (one script or all), check in, where it goes next, and the manager's decision. */
export default function DocDialogs({
  doc,
  open,
  onOpen,
  busy,
  changedBy,
  handlers,
}: {
  doc: DocDetail;
  open: Record<DialogName, boolean>;
  onOpen: (name: DialogName, value: boolean) => void;
  busy: boolean;
  changedBy: string | null;
  handlers: {
    submit: (reviewers: Reviewers, note: string) => void;
    sendAll: (reviewers: Reviewers, note: string) => void;
    checkIn: (vote: Vote, note: string) => void;
    finalize: (route: "LEVEL2" | "CREATOR", note: string) => void;
    decide: (decision: "APPROVE" | "SEND_BACK", note: string) => void;
  };
}) {
  const sendable = doc.pages.filter((p) => p.status === "DRAFT" || p.status === "CHANGES_REQUESTED").length;
  return (
    <>
      <SubmitDialog doc={doc} open={open.submit} onOpenChange={(o) => onOpen("submit", o)} busy={busy} onSubmit={handlers.submit} />
      <SubmitDialog doc={doc} open={open.bulk} onOpenChange={(o) => onOpen("bulk", o)} busy={busy} bulkCount={sendable} onSubmit={handlers.sendAll} />
      <CheckInDialog
        doc={doc}
        open={open.checkIn}
        onOpenChange={(o) => onOpen("checkIn", o)}
        changedBy={changedBy}
        busy={busy}
        onCheckIn={handlers.checkIn}
      />
      <Level2Dialog doc={doc} open={open.level2} onOpenChange={(o) => onOpen("level2", o)} busy={busy} onFinalize={handlers.finalize} />
      <DecisionDialog doc={doc} open={open.decide} onOpenChange={(o) => onOpen("decide", o)} busy={busy} onDecide={handlers.decide} />
    </>
  );
}
