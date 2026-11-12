import { Navigate, useParams, useSearchParams } from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";

/**
 * Old and shared links to a post (/submissions/:id) land on the right page for who is looking: reviewers on the
 * Content screener, everyone else (the creator, and a super admin viewing as a creator) on the post's own page.
 */
export default function PostRedirect() {
  const { id = "" } = useParams();
  const step = useSearchParams()[0].get("step");
  const { hasPermission, creatorView } = useAuth();
  const reviewing = hasPermission("CONTENT_REVIEW_VIEW") && !creatorView;
  return <Navigate to={reviewing ? `/compliance/scanner?id=${id}` : `/submissions/new?id=${id}${step ? `&step=${step}` : ""}`} replace />;
}
