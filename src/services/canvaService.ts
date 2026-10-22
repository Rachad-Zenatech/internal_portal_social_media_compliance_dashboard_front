import { apiClient } from "@/services/apiClient";
import type { CanvaConnection, CanvaDesign } from "@/types/canva";
import type { Submission } from "@/types/submission";

const quiet = { skipGlobalLoading: true };

export const canvaService = {
  connection: () => apiClient.get<CanvaConnection>("/api/canva/connection", quiet),

  /** The mock connects straight away; the live Canva will start its sign-in flow here instead. */
  connect: () => apiClient.post<CanvaConnection>("/api/canva/connection", undefined, quiet),

  disconnect: () => apiClient.delete<null>("/api/canva/connection", quiet),

  designs: () => apiClient.get<CanvaDesign[]>("/api/canva/designs", quiet),

  /** Mock Canva only: pretend the design was edited, so the next export is a new revision. */
  simulateEdit: (designId: string) =>
    apiClient.post<CanvaDesign>(`/api/canva/designs/${encodeURIComponent(designId)}/simulate-edit`, undefined, quiet),

  /** Export the design and add it as the submission's main file. */
  importDesign: (submissionId: string, designId: string) =>
    apiClient.post<Submission>(`/api/submissions/${submissionId}/canva/import`, { design_id: designId }, quiet),

  /** Bring in the linked design's latest revision; with resubmit, send it straight back for review. */
  reimport: (submissionId: string, resubmit = false) =>
    apiClient.post<Submission>(`/api/submissions/${submissionId}/canva/reimport`, { resubmit }, quiet),
};
