import { Button } from "@/components/ui/button";

const ACCOUNTS = [
  { id: "creator", label: "Test creator", email: "test.creator@example.com" },
  { id: "manager", label: "Content manager", email: "test.manager@example.com" },
  { id: "reviewer", label: "Test reviewer", email: "test.reviewer@example.com" },
  { id: "reviewer2", label: "Test reviewer 2", email: "test.reviewer2@example.com" },
  { id: "reviewer3", label: "Test reviewer 3", email: "test.reviewer3@example.com" },
  { id: "suggester", label: "Suggesting reviewer", email: "test.suggester@example.com" },
] as const;

export type TestAccount = (typeof ACCOUNTS)[number]["id"];

export function TestLoginAccounts({ disabled, onSignIn }: {
  disabled: boolean;
  onSignIn: (account: TestAccount) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-amber-400/70 bg-amber-50/60 p-3 dark:border-amber-500/40 dark:bg-amber-500/5">
      <p className="text-center text-xs font-medium text-amber-800 dark:text-amber-300">Local test accounts</p>
      <div className="grid grid-cols-2 gap-2">
        {ACCOUNTS.map((account) => (
          <Button key={account.id} variant="outline" className="h-auto min-h-12 flex-col rounded-lg px-2 py-2" disabled={disabled} onClick={() => onSignIn(account.id)}>
            <span className="text-sm">{account.label}</span>
            <span className="text-[10px] font-normal">{account.email}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
