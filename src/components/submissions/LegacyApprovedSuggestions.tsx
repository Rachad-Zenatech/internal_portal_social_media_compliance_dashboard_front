import ApprovalActions from "./ApprovalActions";
import PostApprovalSuggestionNotice from "./PostApprovalSuggestionNotice";
import { useAuth } from "@/lib/AuthContext";
import type { useApprovedPostAccess } from "@/hooks/usePostApprovalSuggestions";

export default function LegacyApprovedSuggestions({ access }: { access: ReturnType<typeof useApprovedPostAccess> }) {
  const { user } = useAuth();
  if (!access.post) return null;
  return (
    <div className="mt-2 space-y-2">
      <PostApprovalSuggestionNotice access={access} />
      <ApprovalActions target={access.post} isCreator={access.post.created_by === user?.id} />
    </div>
  );
}
