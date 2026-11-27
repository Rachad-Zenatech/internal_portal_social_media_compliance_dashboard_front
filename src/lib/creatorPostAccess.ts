/** A creator's saved edit permission never overrides a locked workflow status. */
export function creatorContentReadOnly(status: string, serverReadOnly: boolean) {
  return serverReadOnly || !["DRAFT", "CHANGES_REQUESTED"].includes(status);
}
