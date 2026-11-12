import PlatformCaptions from "@/components/submissions/PlatformCaptions";
import SourceLinksField from "@/components/submissions/SourceLinksField";

interface Props {
  platforms: string[];
  platformCaptions: Record<string, string>;
  mainCaption: string;
  limitFor: (p: string) => number | undefined;
  sourceLinks: string[];
  submissionId: string | null;
  ensureSubmissionId: () => Promise<string | null>;
  readOnly?: boolean;
  onPlatformCaptionsChange: (next: Record<string, string>) => void;
  onSourceLinksChange: (next: string[]) => void;
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
        links={props.sourceLinks}
        submissionId={props.submissionId}
        ensureSubmissionId={props.ensureSubmissionId}
        readOnly={props.readOnly}
        onChange={props.onSourceLinksChange}
      />
    </>
  );
}

