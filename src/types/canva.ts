/** The user's Canva account. MOCK until the Canva Connect API keys are configured. */
export interface CanvaConnection {
  connected: boolean;
  mode: "MOCK" | "LIVE";
  display_name?: string | null;
  connected_at?: string | null;
}

export interface CanvaDesign {
  id: string;
  title: string;
  kind: "IMAGE" | "VIDEO";
  width: number;
  height: number;
  /** Goes up each time the design is edited in Canva. */
  revision: number;
  updated_at: string;
  thumbnail_url: string;
}
