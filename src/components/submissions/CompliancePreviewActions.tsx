import { Button } from "@/components/ui/button";

interface Props {
  textOnly: boolean;
  script: boolean;
  video: boolean;
  onEditText: () => void;
  onReplaceMedia: () => void;
}

/** Text-only posts expose text editing without image, video or script replacement controls. */
export default function CompliancePreviewActions({ textOnly, script, video, onEditText, onReplaceMedia }: Props) {
  const editLabel = script ? "Edit post details" : "Edit text";
  const replaceLabel = script ? "Replace script" : video ? "Replace video" : "Replace image";
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" className="rounded-lg text-[13px] font-semibold" onClick={onEditText}>{editLabel}</Button>
      {!textOnly && <Button type="button" variant="outline" size="sm" className="rounded-lg text-[13px] font-semibold" onClick={onReplaceMedia}>{replaceLabel}</Button>}
    </div>
  );
}
