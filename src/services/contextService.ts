import { apiClient } from "@/services/apiClient";
import type { BrandVoice, BrandVoiceInput, ContextEntry, ContextEntryInput, ContextSync } from "@/types/context";

export const contextService = {
  list: () => apiClient.get<ContextEntry[]>("/api/messaging-context"),
  create: (data: ContextEntryInput) => apiClient.post<ContextEntry>("/api/messaging-context", data),
  update: (id: string, data: ContextEntryInput) => apiClient.put<ContextEntry>(`/api/messaging-context/${id}`, data),
  remove: (id: string) => apiClient.delete<null>(`/api/messaging-context/${id}`),
  /** The newsroom sync running now, or the last one (null before the first). */
  newsroomSync: () => apiClient.get<ContextSync | null>("/api/messaging-context/newsroom-sync"),
  startNewsroomSync: () => apiClient.post<ContextSync>("/api/messaging-context/newsroom-sync", {}),
  /** Every brand's voice (read from its manual, or written by hand). */
  brandVoices: () => apiClient.get<BrandVoice[]>("/api/messaging-context/brand-voices"),
  /** Upload a brand's manual (PDF); its voice, colours, typefaces and logo are read in the background. */
  uploadBrandManual: (brand: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post<BrandVoice>(`/api/messaging-context/brand-voices/${brand}/manual`, form);
  },
  rereadBrandManual: (brand: string) => apiClient.post<BrandVoice>(`/api/messaging-context/brand-voices/${brand}/read`, {}),
  updateBrandVoice: (brand: string, data: BrandVoiceInput) =>
    apiClient.put<BrandVoice>(`/api/messaging-context/brand-voices/${brand}`, data),
  brandLogoUrl: (brand: string) => `/api/messaging-context/brand-voices/${brand}/logo`,
  brandManualUrl: (brand: string) => `/api/messaging-context/brand-voices/${brand}/manual`,
};
