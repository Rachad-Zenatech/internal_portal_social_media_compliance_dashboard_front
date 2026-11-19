/** Development-only Message Hub addresses. Production receives these from its API. */
const isDevelopment = import.meta.env.DEV;

export const HUB_SERVERS = [
  { id: "ma", name: "M&A", user: "acquisition_service", port: 8003 },
  { id: "administration", name: "Administration", user: "administration_service", port: 8002 },
  { id: "ceo", name: "CEO Dashboard", user: "ceo_service", port: 8000 },
  { id: "social_media_compliance", name: "Social Media Compliance", user: "compliance_service", port: 8009 },
  { id: "finance", name: "Finance (Enterprise System)", user: "finance_service", port: 8001 },
  { id: "marketing", name: "Marketing Management", user: "marketing_service", port: 8010 },
  { id: "sec_filing", name: "SEC Filing (Share Document)", user: "sec_filing_service", port: 8006 },
  { id: "travel", name: "Travel Management", user: "travel_service", port: 8008 },
  { id: "real_estate", name: "Real Estate", user: "real_estate_service", port: 8007 },
];

export const peerBackendUrls = (currentAppId: string) => isDevelopment
  ? ["travel", "marketing", "administration", "ceo"]
      .filter((id) => id !== currentAppId)
      .map((id) => `http://127.0.0.1:${HUB_SERVERS.find((server) => server.id === id)!.port}`)
  : [];

export const localHubFallback = isDevelopment
  ? { host: "127.0.0.1:5672", managementUrl: "http://127.0.0.1:15672" }
  : { host: "Not configured", managementUrl: "" };
