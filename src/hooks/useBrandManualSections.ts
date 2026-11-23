import { useQuery } from "@tanstack/react-query";
import { contextService } from "@/services/contextService";

/** Read the selected brand's full manual independently of AI extraction status. */
export function useBrandManualSections(brand: string, uploadedAt?: string | null) {
  return useQuery({
    queryKey: ["brand-manual-sections", brand, uploadedAt],
    queryFn: () => contextService.brandManualSections(brand),
    staleTime: Infinity,
    retry: false,
  });
}
