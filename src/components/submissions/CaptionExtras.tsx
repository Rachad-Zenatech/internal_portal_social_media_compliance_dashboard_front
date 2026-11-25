import PlatformCaptions from "@/components/submissions/PlatformCaptions";
import SourceLinksField from "@/components/submissions/SourceLinksField";
import type { SourceLinkCheck } from "@/types/sourceLink";
import type { SubmissionFile } from "@/types/submission";

interface Props {
  platforms: string[];
  platformCaptions: Record<string, string>;
  mainCaption: string;
  limitFor: (p: string) => number | undefined;
  sourceLinks: string[];
  submissionId: string | null;
  ensureSubmissionId: () => Promise<string | null>;
  readOnly?: boolean;
  linksOnly?: boolean;
  onPlatformCaptionsChange: (next: Record<string, string>) => void;
  onSourceLinksChange: (next: string[]) => void;
  onSourceCheckActivityChange?: (activities: string[]) => void;
  uploadedFiles?: SubmissionFile[];
  savedSourceChecks?: Record<string, SourceLinkCheck>;
  autoScanImageId?: string | null;
}

/** Per-platform caption overrides and source links placed at the bottom of the Details caption section. */
export default function CaptionExtras(props: Props) {
  return (
    <>
      {props.platforms.length > 1 && (
        <PlatformCaptions
          platforms={props.platforms}
          captions={props.platformCaptions}
          mainCaption={props.mainCaption}
          limitFor={props.limitFor}
          readOnly={props.readOnly}
          onChange={props.onPlatformCaptionsChange}
        />
      )}
      <SourceLinksField
        linksOnly={props.linksOnly}
        links={props.sourceLinks}
        submissionId={props.submissionId}
        ensureSubmissionId={props.ensureSubmissionId}
        readOnly={props.readOnly}
        onChange={props.onSourceLinksChange}
        uploadedFiles={props.uploadedFiles}
        savedResults={props.savedSourceChecks}
        onBackgroundActivityChange={props.onSourceCheckActivityChange}
        autoScanImageId={props.autoScanImageId}
      />
    </>
  );
}

