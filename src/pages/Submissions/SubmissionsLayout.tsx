import { Outlet } from "react-router-dom";

/** One content area: the portal and the new-submission form. The portal's own "New Submission" button links between them. */
export default function SubmissionsLayout() {
  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-4 sm:space-y-5">
      <Outlet />
    </div>
  );
}
