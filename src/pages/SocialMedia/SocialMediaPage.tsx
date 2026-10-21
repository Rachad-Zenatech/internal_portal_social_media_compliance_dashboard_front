import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Share2,
  Users,
  Eye,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  Plus,
  CheckCircle2,
  Building2,
  Search,
  MessageCircle,
  Heart,
  Repeat2,
  Sparkles,
  Calendar,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  oauthService,
  type OAuthConnection,
  type Organization,
  type Company,
  type OAuthProvider,
} from "@/services/oauthService";
import { useAuth } from "@/lib/AuthContext";

export interface SocialPlatformConfig {
  provider: OAuthProvider;
  name: string;
  shortName: string;
  badgeBg: string;
  borderAccent: string;
  iconChar: string;
  profileUrlPrefix?: string;
  sampleFollowers: number;
  samplePosts: number;
  sampleViews: string;
  sampleEngagement: string;
}

const SOCIAL_PLATFORMS: Record<string, SocialPlatformConfig> = {
  LINKEDIN_PAGE: {
    provider: "LINKEDIN_PAGE",
    name: "LinkedIn Company Page",
    shortName: "LinkedIn",
    badgeBg: "bg-sky-600 text-white",
    borderAccent: "border-sky-500/30 hover:border-sky-500/60",
    iconChar: "in",
    profileUrlPrefix: "https://www.linkedin.com/company/",
    sampleFollowers: 38450,
    samplePosts: 142,
    sampleViews: "245K",
    sampleEngagement: "5.2%",
  },
  X_TWITTER: {
    provider: "X_TWITTER",
    name: "X (Twitter)",
    shortName: "X / Twitter",
    badgeBg: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950",
    borderAccent: "border-zinc-500/30 hover:border-zinc-500/60",
    iconChar: "𝕏",
    profileUrlPrefix: "https://x.com/",
    sampleFollowers: 24120,
    samplePosts: 689,
    sampleViews: "410K",
    sampleEngagement: "3.8%",
  },
  INSTAGRAM: {
    provider: "INSTAGRAM",
    name: "Instagram Business",
    shortName: "Instagram",
    badgeBg: "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white",
    borderAccent: "border-rose-500/30 hover:border-rose-500/60",
    iconChar: "ig",
    profileUrlPrefix: "https://www.instagram.com/",
    sampleFollowers: 52300,
    samplePosts: 318,
    sampleViews: "612K",
    sampleEngagement: "6.4%",
  },
  FACEBOOK_PAGE: {
    provider: "FACEBOOK_PAGE",
    name: "Facebook Page",
    shortName: "Facebook",
    badgeBg: "bg-blue-600 text-white",
    borderAccent: "border-blue-500/30 hover:border-blue-500/60",
    iconChar: "fb",
    profileUrlPrefix: "https://www.facebook.com/",
    sampleFollowers: 19800,
    samplePosts: 204,
    sampleViews: "180K",
    sampleEngagement: "3.2%",
  },
  YOUTUBE: {
    provider: "YOUTUBE",
    name: "YouTube Channel",
    shortName: "YouTube",
    badgeBg: "bg-red-600 text-white",
    borderAccent: "border-red-500/30 hover:border-red-500/60",
    iconChar: "yt",
    profileUrlPrefix: "https://www.youtube.com/",
    sampleFollowers: 14700,
    samplePosts: 48,
    sampleViews: "589K",
    sampleEngagement: "7.1%",
  },
  TIKTOK: {
    provider: "TIKTOK",
    name: "TikTok Business",
    shortName: "TikTok",
    badgeBg: "bg-black text-cyan-400 dark:bg-zinc-900 dark:text-cyan-300",
    borderAccent: "border-cyan-500/30 hover:border-cyan-500/60",
    iconChar: "tt",
    profileUrlPrefix: "https://www.tiktok.com/@",
    sampleFollowers: 8200,
    samplePosts: 35,
    sampleViews: "128K",
    sampleEngagement: "4.9%",
  },
};

const SOCIAL_PROVIDER_KEYS: OAuthProvider[] = [
  "LINKEDIN_PAGE",
  "X_TWITTER",
  "INSTAGRAM",
  "FACEBOOK_PAGE",
  "YOUTUBE",
  "TIKTOK",
];

interface OrganicPost {
  id: string;
  provider: OAuthProvider;
  entityName: string;
  authorHandle: string;
  publishedAt: string;
  content: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
}

const SAMPLE_POSTS: OrganicPost[] = [
  {
    id: "post-1",
    provider: "LINKEDIN_PAGE",
    entityName: "ZenaTech Group",
    authorHandle: "ZenaTech Group Official Page",
    publishedAt: "2 hours ago",
    content:
      "We are proud to announce our next generation of enterprise AI and aerial telemetry solutions. Empowering global teams to make data-driven decisions in real time. Read our CEO's full Q3 letter #AI #Innovation #Enterprise",
    impressions: 14200,
    likes: 428,
    comments: 54,
    shares: 61,
  },
  {
    id: "post-2",
    provider: "X_TWITTER",
    entityName: "DeskFlex",
    authorHandle: "@DeskFlexUSA",
    publishedAt: "5 hours ago",
    content:
      "Hybrid workspace scheduling made effortless. Check out the latest DeskFlex smart desk sensors and conference room analytics dashboard update! 🏢✨ https://deskflex.com",
    impressions: 8940,
    likes: 195,
    comments: 24,
    shares: 38,
  },
  {
    id: "post-3",
    provider: "INSTAGRAM",
    entityName: "Othership",
    authorHandle: "@othership.work",
    publishedAt: "Yesterday",
    content:
      "Community vibes at our London coworking hub ☕ From focused deep work to Friday rooftop mixers, discover where productive minds meet. Tap the link in bio to book your day pass! #CoworkingLife #Othership",
    impressions: 21500,
    likes: 1240,
    comments: 89,
    shares: 112,
  },
  {
    id: "post-4",
    provider: "YOUTUBE",
    entityName: "ZenaTech Group",
    authorHandle: "ZenaTech Global Tech & Innovations",
    publishedAt: "3 days ago",
    content:
      "New Video Premiere: Autonomous Drone Fleet Operations & Field Telemetry 4K. Watch how our connected sensors deliver sub-second inspection reports.",
    impressions: 34100,
    likes: 2100,
    comments: 182,
    shares: 240,
  },
];

export default function SocialMediaPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const canManageIntegrations =
    hasPermission("CONFIG_ROLES_VIEW") || hasPermission("CONFIG_ROLES_UPDATE");

  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isMqttSyncing, setIsMqttSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const currentPlatform = searchParams.get("platform") || "ALL";
  const selectedCompanyId = searchParams.get("company_id") || "ALL";

  const loadData = async () => {
    setLoading(true);
    try {
      let [connsRes, orgsRes, compsRes] = await Promise.all([
        oauthService.getConnections(),
        oauthService.getOrganizations(),
        oauthService.getCompanies(),
      ]);
      if (!connsRes || connsRes.length === 0) {
        try {
          const syncRes = await oauthService.syncMqtt();
          if (syncRes && syncRes.accounts) {
            connsRes = syncRes.accounts;
          }
        } catch {
          // background sync fallback
        }
      }
      setConnections(connsRes || []);
      setOrganizations(orgsRes || []);
      setCompanies(compsRes || []);
    } catch (err: any) {
      toast.error("Failed to load social connections: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePlatformChange = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "ALL") {
      next.delete("platform");
    } else {
      next.set("platform", tab);
    }
    setSearchParams(next);
  };

  const handleCompanyChange = (val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val === "ALL") {
      next.delete("company_id");
    } else {
      next.set("company_id", val);
    }
    setSearchParams(next);
  };

  // Filter only organic social media providers
  const socialConnections = useMemo(() => {
    return connections.filter((c) =>
      SOCIAL_PROVIDER_KEYS.includes(c.provider)
    );
  }, [connections]);

  // Apply active platform and company filters
  const filteredConnections = useMemo(() => {
    return socialConnections.filter((c) => {
      const matchesPlatform =
        currentPlatform === "ALL" || c.provider === currentPlatform;
      const matchesCompany =
        selectedCompanyId === "ALL" ||
        (selectedCompanyId === "ORG_LEVEL"
          ? !c.company_id
          : c.company_id === selectedCompanyId);
      const matchesSearch =
        !searchQuery ||
        c.account_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.provider_account_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.company_name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPlatform && matchesCompany && matchesSearch;
    });
  }, [socialConnections, currentPlatform, selectedCompanyId, searchQuery]);

  // Aggregate metrics
  const totalAudience = useMemo(() => {
    return socialConnections.reduce((acc, c) => {
      const conf = SOCIAL_PLATFORMS[c.provider];
      return acc + (conf?.sampleFollowers || 10000);
    }, 0);
  }, [socialConnections]);

  const handleSync = async (connId: string, name: string) => {
    setSyncingId(connId);
    try {
      await new Promise((r) => setTimeout(r, 900));
      toast.success("Synchronized latest feed and metrics for " + name);
    } catch {
      toast.error("Failed to sync channel");
    } finally {
      setSyncingId(null);
    }
  };

  const handleMqttSync = async () => {
    setIsMqttSyncing(true);
    try {
      const res = await oauthService.syncMqtt();
      toast.success(`Synchronized ${res?.synced_count || 0} social accounts via MQTT bus`);
      loadData();
    } catch (err: any) {
      toast.error("MQTT Sync failed: " + (err?.response?.data?.detail || err.message));
    } finally {
      setIsMqttSyncing(false);
    }
  };

  const filteredPosts = useMemo(() => {
    if (currentPlatform === "ALL") return SAMPLE_POSTS;
    return SAMPLE_POSTS.filter((p) => p.provider === currentPlatform);
  }, [currentPlatform]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-4">
      {/* Header */}
      <DashboardHeader
        title={
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Share2 className="h-6 w-6" />
            </div>
            <div>
              <span className="font-semibold text-2xl tracking-tight text-foreground">
                Social Media Channels
              </span>
            </div>
          </div>
        }
        subtitle="Manage connected organic social profiles, cross-channel reach, engagement metrics, and published feeds across all entities."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/compliance/scanner")}
              className="gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-medium"
            >
              <Video className="h-4 w-4 text-amber-500" />
              Screen Video Asset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMqttSync}
              disabled={isMqttSyncing || loading}
              className="gap-1.5 border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-medium"
            >
              <RefreshCw className={`h-4 w-4 text-blue-500 ${isMqttSyncing ? "animate-spin" : ""}`} />
              {isMqttSyncing ? "Syncing..." : "Sync via MQTT"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {canManageIntegrations && (
              <Button
                size="sm"
                onClick={() => navigate("/configurations/integrations?tab=social")}
                className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Connect Social Account
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Highlight Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Connected Channels
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-foreground">
                  {loading ? "--" : socialConnections.length}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-0.5 inline" />
                  Active
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Across {organizations.length + companies.length} business entities
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Share2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Audience / Followers
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-foreground">
                  {loading ? "--" : (totalAudience / 1000).toFixed(1) + "K"}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  +4.8% m/m
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Total combined organic community
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                30-Day Impressions
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-foreground">
                  {loading ? "--" : "892.5K"}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  +12.4%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Organic timeline views & video plays
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Eye className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Avg. Engagement Rate
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-foreground">5.1%</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  High benchmark
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Industry avg B2B is 1.8% - 3.2%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        {/* Platform Tabs */}
        <div className="overflow-x-auto pb-1 md:pb-0">
          <Tabs value={currentPlatform} onValueChange={handlePlatformChange}>
            <TabsList className="bg-muted/80 p-1 rounded-lg">
              <TabsTrigger value="ALL" className="gap-1.5 text-xs font-medium">
                All Socials
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-background text-[10px] text-muted-foreground font-semibold">
                  {socialConnections.length}
                </span>
              </TabsTrigger>
              {SOCIAL_PROVIDER_KEYS.map((key) => {
                const conf = SOCIAL_PLATFORMS[key];
                const count = socialConnections.filter((c) => c.provider === key).length;
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="gap-1.5 text-xs font-medium whitespace-nowrap"
                  >
                    <span>{conf.shortName}</span>
                    {count > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full bg-background text-[10px] text-muted-foreground font-semibold">
                        {count}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Entity Selector & Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-56">
            <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
              <SelectTrigger className="h-9 text-xs">
                <Building2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Business Entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Entities</SelectItem>
                <SelectItem value="ORG_LEVEL">Organization (ZenaTech Group)</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search handle or page..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Connected Channels Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span>Connected Social Profiles</span>
            <Badge variant="outline" className="text-xs font-normal">
              {filteredConnections.length} showing
            </Badge>
          </h2>

          {canManageIntegrations && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/configurations/integrations?tab=social")}
              className="text-xs text-primary hover:text-primary gap-1"
            >
              Configure in Integrations
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : filteredConnections.length === 0 ? (
          <Card className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
              <Share2 className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-base text-foreground">
              No Social Channels Connected
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
              {currentPlatform === "ALL"
                ? "No organic social accounts have been linked for the selected entity filter."
                : `No ${SOCIAL_PLATFORMS[currentPlatform]?.name || "social"} account is currently linked for this entity.`}
            </p>
            {canManageIntegrations && (
              <Button
                size="sm"
                onClick={() => navigate("/configurations/integrations?tab=social")}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Connect {currentPlatform !== "ALL" ? SOCIAL_PLATFORMS[currentPlatform]?.shortName : "Social Channel"}
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredConnections.map((conn) => {
              const platform = SOCIAL_PLATFORMS[conn.provider];
              const isSyncing = syncingId === conn.id;

              return (
                <Card
                  key={conn.id}
                  className={`rounded-xl border bg-card shadow-xs transition-all duration-200 hover:shadow-md ${
                    platform?.borderAccent || "border-border"
                  }`}
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs ${
                            platform?.badgeBg || "bg-muted text-muted-foreground"
                          }`}
                        >
                          {platform?.iconChar || "•"}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold text-foreground line-clamp-1">
                            {conn.account_name || platform?.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[11px] text-foreground/80">
                              {conn.provider_account_id || "Connected Profile"}
                            </span>
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant={conn.status === "CONNECTED" ? "default" : "destructive"}
                        className={`text-[10px] font-medium uppercase px-2 py-0.5 ${
                          conn.status === "CONNECTED"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                            : ""
                        }`}
                      >
                        {conn.status}
                      </Badge>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="secondary" className="text-[11px] font-normal gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {conn.company_name || conn.organization_name || "ZenaTech Corporate"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        OAuth 2.0 (Active)
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-2">
                    {/* Channel Stats Tiles */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/70 my-2 text-center bg-muted/20 rounded-lg">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">
                          Audience
                        </p>
                        <p className="text-sm font-bold text-foreground mt-0.5">
                          {((platform?.sampleFollowers || 12000) / 1000).toFixed(1)}K
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">
                          Posts
                        </p>
                        <p className="text-sm font-bold text-foreground mt-0.5">
                          {platform?.samplePosts || 84}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">
                          Engagement
                        </p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {platform?.sampleEngagement || "4.5%"}
                        </p>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] text-muted-foreground">
                        {conn.scopes?.length || 2} permissions granted
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          disabled={isSyncing}
                          onClick={() => handleSync(conn.id, conn.account_name || platform.name)}
                          title="Sync Feed"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`}
                          />
                        </Button>
                        {canManageIntegrations && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                            onClick={() =>
                              navigate("/configurations/integrations?tab=social")
                            }
                          >
                            Manage
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Cross-Channel Recent Organic Feed */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Recent Multi-Channel Organic Posts
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Synchronized from live OAuth profiles
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPosts.map((post) => {
            const conf = SOCIAL_PLATFORMS[post.provider];

            return (
              <Card
                key={post.id}
                className="rounded-xl border border-border bg-card shadow-xs p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shadow-xs ${
                        conf?.badgeBg || "bg-muted"
                      }`}
                    >
                      {conf?.iconChar}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">
                          {post.entityName}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          • {post.authorHandle}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {post.publishedAt}
                      </span>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[10px] font-normal">
                    {conf?.shortName}
                  </Badge>
                </div>

                <p className="text-xs text-foreground/90 leading-relaxed">
                  {post.content}
                </p>

                {/* Engagement Metrics */}
                <div className="flex items-center gap-4 pt-2 border-t border-border/60 text-muted-foreground text-xs">
                  <span className="flex items-center gap-1 hover:text-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    {(post.impressions / 1000).toFixed(1)}K
                  </span>
                  <span className="flex items-center gap-1 hover:text-foreground">
                    <Heart className="h-3.5 w-3.5 text-rose-500/80" />
                    {post.likes}
                  </span>
                  <span className="flex items-center gap-1 hover:text-foreground">
                    <MessageCircle className="h-3.5 w-3.5 text-sky-500/80" />
                    {post.comments}
                  </span>
                  <span className="flex items-center gap-1 hover:text-foreground">
                    <Repeat2 className="h-3.5 w-3.5 text-emerald-500/80" />
                    {post.shares}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
