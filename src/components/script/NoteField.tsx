import { memo, useEffect, useState, type ComponentProps, type MutableRefObject } from "react";

import { Textarea } from "@/components/ui/textarea";

/**
 * A comment box that keeps what is typed to itself. The page that holds it re-renders only when the box goes from
 * empty to filled (or back), so typing doesn't redraw the whole script on every key. The page reads the text from
 * `valueRef` when it needs it (to send).
 */
function NoteFieldBase({
  valueRef,
  onHasText,
  ...props
}: Omit<ComponentProps<typeof Textarea>, "value" | "defaultValue" | "onChange"> & {
  valueRef: MutableRefObject<string>;
  /** Called when the box becomes empty or gets text. */
  onHasText: (hasText: boolean) => void;
}) {
  const [value, setValue] = useState("");
  // A new box starts empty, so text from an earlier one is never sent.
  useEffect(() => {
    valueRef.current = "";
  }, [valueRef]);
  return (
    <Textarea
      {...props}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        const had = valueRef.current.trim().length > 0;
        valueRef.current = next;
        setValue(next);
        const has = next.trim().length > 0;
        if (has !== had) onHasText(has);
      }}
    />
  );
}

const NoteField = memo(NoteFieldBase);
export default NoteField;
