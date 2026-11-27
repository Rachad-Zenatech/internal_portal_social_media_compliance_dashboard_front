import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/** Render the active review workspace once, inside its script's section when paired. */
export default function ScriptWorkspacePlacement({ host, children }: { host: HTMLElement | null; children: ReactNode }) {
  return host ? createPortal(children, host) : children;
}
