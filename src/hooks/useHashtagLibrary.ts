import { useQuery } from "@tanstack/react-query";

import { submissionService } from "@/services/submissionService";

/** The hashtag library for a post's brand, audience, region, platforms and rule sets. */
export function useHashtagLibrary(p: { brand: string; audiences: string[]; region: string; platforms: string[]; ruleSets: string[] }) {
  return useQuery({
    queryKey: ["hashtag-library", p.brand, [...p.audiences].sort(), p.region, [...p.platforms].sort(), [...p.ruleSets].sort()],
    queryFn: () => submissionService.hashtagLibrary(p),
    staleTime: 5 * 60_000,
  });
}
