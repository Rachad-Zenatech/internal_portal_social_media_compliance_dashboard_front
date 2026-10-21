import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  ArrowRight,
  Lock,
  KeyRound,
  Megaphone,
  Share2,
  Radio,
} from 'lucide-react';

import {
  oauthService,
  type OAuthProvider,
  type OAuthConnection,
} from '@/services/oauthService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import HelpIcon from '@/components/ui/HelpIcon';
import { useAuth } from '@/lib/AuthContext';
const isAdSyncProvider = (_provider?: string | null): boolean => false;
const AdSyncModeBadge = (_props: any) => null;
const AdPlatformLastSynced = (_props: any) => null;
const SyncAdPlatformButton = (_props: any) => null;

export type IntegrationCategory = 'PAID_ADS' | 'SOCIAL_MEDIA';

interface ProviderMeta {
  name: string;
  category: 'PAID_ADS' | 'SOCIAL_MEDIA';
  description: string;
  defaultScope: string;
  iconBg: string;
  iconChar: string;
  idLabel: string;
  idPlaceholder: string;
  authPermissions: string[];
}

const PROVIDER_METADATA: Record<OAuthProvider, ProviderMeta> = {
  // --- Paid Advertising ---
  GOOGLE_ADS: {
    name: 'Google Ads',
    category: 'PAID_ADS',
    description: 'Search, Display, YouTube, and Performance Max advertising data',
    iconBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    iconChar: 'G',
    defaultScope: 'https://www.googleapis.com/auth/adwords',
    idLabel: 'Customer / MCC ID',
    idPlaceholder: 'e.g. 123-456-7890',
    authPermissions: [
      'Read ad performance & campaign reporting',
      'Discover Customer IDs and MCC accounts',
      'Automatic offline refresh token renewal',
    ],
  },
  MICROSOFT_ADS: {
    name: 'Microsoft Ads (Bing)',
    category: 'PAID_ADS',
    description: 'Bing Search, Microsoft Audience Network, and Copilot ads',
    iconBg: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400',
    iconChar: 'M',
    defaultScope: 'https://ads.microsoft.com/msads.manage offline_access',
    idLabel: 'Account ID',
    idPlaceholder: 'e.g. MS-1234-567',
    authPermissions: [
      'Access Bing Search and Audience Network metrics',
      'Discover linked Microsoft Advertising accounts',
      'Manage offline token renewal lifecycle',
    ],
  },
  META_ADS: {
    name: 'Meta Ads (Facebook & IG)',
    category: 'PAID_ADS',
    description: 'Facebook, Instagram, Messenger, and Audience Network campaigns',
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
    iconChar: 'f',
    defaultScope: 'ads_management,ads_read',
    idLabel: 'Ad Account ID',
    idPlaceholder: 'e.g. act_1234567890',
    authPermissions: [
      'Read Meta Pixel and Ads Manager conversions',
      'Access ad sets, reach, and CPM spend telemetry',
      'Long-lived 60-day token auto-management',
    ],
  },
  LINKEDIN_ADS: {
    name: 'LinkedIn Ads',
    category: 'PAID_ADS',
    description: 'B2B sponsored content, lead gen forms, and InMail campaigns',
    iconBg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400',
    iconChar: 'in',
    defaultScope: 'r_ads,r_ads_reporting',
    idLabel: 'Sponsored Account ID',
    idPlaceholder: 'e.g. 501234567',
    authPermissions: [
      'Read sponsored content and lead form metrics',
      'Access B2B campaign ROI analytics',
      'Auto-renew access via LinkedIn OAuth 2.0',
    ],
  },

  // --- Organic Social Media ---
  LINKEDIN_PAGE: {
    name: 'LinkedIn Company Page',
    category: 'SOCIAL_MEDIA',
    description: 'Company updates, organic post publishing, analytics, and follower growth',
    iconBg: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300',
    iconChar: 'in',
    defaultScope: 'w_organization_social,r_organization_social',
    idLabel: 'Organization URN / Page ID',
    idPlaceholder: 'e.g. urn:li:organization:1234567',
    authPermissions: [
      'Read organic company page updates & impressions',
      'Sync engagement, comments, and follower metrics',
      'Offline renewal support',
    ],
  },
  X_TWITTER: {
    name: 'X (Twitter)',
    category: 'SOCIAL_MEDIA',
    description: 'Company tweets, thread publishing, timeline impressions, and engagement',
    iconBg: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100',
    iconChar: '𝕏',
    defaultScope: 'tweet.read,tweet.write,users.read,offline.access',
    idLabel: 'Handle / User ID',
    idPlaceholder: 'e.g. @ZenaTechUSA',
    authPermissions: [
      'Read company timeline tweets and impressions',
      'Access profile statistics and engagement rates',
      'PKCE OAuth 2.0 secure session handling',
    ],
  },
  FACEBOOK_PAGE: {
    name: 'Facebook Page',
    category: 'SOCIAL_MEDIA',
    description: 'Official brand pages, feed posts, community updates, and page metrics',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
    iconChar: 'fb',
    defaultScope: 'pages_manage_posts,pages_read_engagement',
    idLabel: 'Page ID',
    idPlaceholder: 'e.g. 109283746501928',
    authPermissions: [
      'Read organic page feed posts & reach',
      'Aggregate reactions, comments, and shares',
    ],
  },
  INSTAGRAM: {
    name: 'Instagram Business',
    category: 'SOCIAL_MEDIA',
    description: 'Feed posts, reels publishing, story insights, and audience demographics',
    iconBg: 'bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400',
    iconChar: 'ig',
    defaultScope: 'instagram_basic,instagram_content_publish',
    idLabel: 'IG Business ID / Handle',
    idPlaceholder: 'e.g. @othership.work',
    authPermissions: [
      'Read business account media insights',
      'Sync audience growth and demographic telemetry',
    ],
  },
  YOUTUBE: {
    name: 'YouTube Channel',
    category: 'SOCIAL_MEDIA',
    description: 'Corporate video uploads, views, watch time, and subscriber telemetry',
    iconBg: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400',
    iconChar: 'yt',
    defaultScope: 'https://www.googleapis.com/auth/youtube.readonly',
    idLabel: 'Channel ID',
    idPlaceholder: 'e.g. UC_x5XG1OV2P6uZZ5FSM9Ttw',
    authPermissions: [
      'Read channel watch time, views, and subscribers',
      'Discover official corporate brand channels',
    ],
  },
  TIKTOK: {
    name: 'TikTok Business',
    category: 'SOCIAL_MEDIA',
    description: 'Organic video publishing, sound insights, and engagement analytics',
    iconBg: 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100',
    iconChar: 'tt',
    defaultScope: 'user.info.basic,video.list',
    idLabel: 'Open ID / Username',
    idPlaceholder: 'e.g. @zenatech_official',
    authPermissions: [
      'Read video views and profile analytics',
      'Sync engagement telemetry across video catalog',
    ],
  },
};

const ALL_PROVIDERS: OAuthProvider[] = [
  'GOOGLE_ADS',
  'MICROSOFT_ADS',
  'META_ADS',
  'LINKEDIN_ADS',
  'LINKEDIN_PAGE',
  'X_TWITTER',
  'FACEBOOK_PAGE',
  'INSTAGRAM',
  'YOUTUBE',
  'TIKTOK',
];

export default function OAuthIntegrations() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  // Super admins pass every permission check
  const canManage = hasPermission('CONFIG_ROLES_UPDATE');
  const canSyncAds = hasPermission('INITIATIVES_UPDATE');
  // Platforms with a campaign sync (Google Ads, Microsoft Ads) show their mode and last sync on their cards
  const canViewAdSync = hasPermission('INITIATIVES_VIEW');
  // ... and suggest syncing once they're connected

  // Back from the sign-in (OAuthCallbackPage adds ?connected=GOOGLE_ADS or MICROSOFT_ADS): suggest syncing once
  const connectedParam = searchParams.get('connected');
  useEffect(() => {
    if (!isAdSyncProvider(connectedParam)) return;
    const next = new URLSearchParams(searchParams);
    next.delete('connected');
    setSearchParams(next, { replace: true });
    // Runs once per return from the sign-in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedParam]);

  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('ALL');

  // Sub-nav category: defaults to PAID_ADS if not specified or unrecognized
  const categoryParam = searchParams.get('category');
  const activeCategory: IntegrationCategory =
    categoryParam === 'SOCIAL_MEDIA' ? 'SOCIAL_MEDIA' : 'PAID_ADS';

  // Ensure category is reflected in the URL so sidebar sub-nav link highlights
  useEffect(() => {
    if (!categoryParam) {
      const next = new URLSearchParams(searchParams);
      next.set('category', 'PAID_ADS');
      setSearchParams(next, { replace: true });
    }
  }, [categoryParam, searchParams, setSearchParams]);

  const [resolvingProvider, setResolvingProvider] = useState<OAuthProvider | null>(null);
  const [isMqttSyncing, setIsMqttSyncing] = useState(false);

  const handleMqttSync = async () => {
    setIsMqttSyncing(true);
    try {
      const res = await oauthService.syncMqtt();
      toast.success(`Successfully synchronized ${res?.synced_count || 0} accounts via MQTT bus from Social Media App`);
      queryClient.invalidateQueries({ queryKey: ['oauth-connections'] });
    } catch (err: any) {
      toast.error('MQTT Sync failed: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setIsMqttSyncing(false);
    }
  };

  // Queries
  const { data: organizations = [], isLoading: loadingOrgs } = useQuery({
    queryKey: ['oauth-organizations'],
    queryFn: () => oauthService.getOrganizations(),
  });

  const fallbackOrgId = organizations[0]?.id || '00000000-0000-0000-0000-000000000001';
  const activeOrgId = selectedOrgId || fallbackOrgId;

  const { data: companies = [] } = useQuery({
    queryKey: ['oauth-companies', activeOrgId],
    queryFn: () => oauthService.getCompanies(activeOrgId),
    enabled: !!activeOrgId,
  });

  const { data: connections = [], isLoading: loadingConnections } = useQuery({
    queryKey: ['oauth-connections', activeOrgId],
    queryFn: () => oauthService.getConnections({ organization_id: activeOrgId }),
    enabled: !!activeOrgId,
  });



  const refreshMutation = useMutation({
    mutationFn: (id: string) => oauthService.refreshConnection(id),
    onSuccess: () => {
      toast.success('OAuth token refreshed successfully');
      queryClient.invalidateQueries({ queryKey: ['oauth-connections'] });
    },
    onError: (err: any) => {
      toast.error('Token refresh failed: ' + (err?.response?.data?.detail || err.message));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => oauthService.disconnectConnection(id),
    onSuccess: () => {
      toast.success('Connection disconnected and credentials purged');
      queryClient.invalidateQueries({ queryKey: ['oauth-connections'] });
    },
    onError: (err: any) => {
      toast.error('Disconnect failed: ' + (err?.response?.data?.detail || err.message));
    },
  });

  const handleTestResolution = async (provider: OAuthProvider) => {
    if (!activeOrgId) return;
    setResolvingProvider(provider);
    try {
      const companyId = selectedCompanyId === 'ALL' ? null : selectedCompanyId;
      const res = await oauthService.resolveConnection(activeOrgId, companyId, provider);
      if (res) {
        const entityLabel = companyId
          ? companies.find((c) => c.id === companyId)?.name || 'Selected Entity'
          : 'Organization Fallback';
        toast.success(
          PROVIDER_METADATA[provider].name + ' resolved at ' + res.scope_level + ' level for ' + entityLabel + '!'
        );
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err.message || 'No active connection found for ' + PROVIDER_METADATA[provider].name);
    } finally {
      setResolvingProvider(null);
    }
  };

  const providerConnections = useMemo(() => {
    const map: Record<string, { direct?: OAuthConnection; fallback?: OAuthConnection }> = {};
    ALL_PROVIDERS.forEach((p) => {
      map[p] = {};
    });

    connections.forEach((conn) => {
      if (conn.status === 'REVOKED') return;
      if (!map[conn.provider]) map[conn.provider] = {};
      if (selectedCompanyId !== 'ALL' && conn.company_id === selectedCompanyId) {
        map[conn.provider].direct = conn;
      }
      if (!conn.company_id) {
        map[conn.provider].fallback = conn;
      }
    });

    return map;
  }, [connections, selectedCompanyId]);

  // Filter strictly to current sub-nav category
  const filteredProviders = useMemo(() => {
    return ALL_PROVIDERS.filter((p) => PROVIDER_METADATA[p].category === activeCategory);
  }, [activeCategory]);

  const counts = useMemo(() => {
    let paidCount = 0;
    let socialCount = 0;
    ALL_PROVIDERS.forEach((p) => {
      const info = providerConnections[p];
      if (info && (info.direct || info.fallback)) {
        if (PROVIDER_METADATA[p].category === 'PAID_ADS') paidCount++;
        else socialCount++;
      }
    });
    return { paidCount, socialCount, total: paidCount + socialCount };
  }, [providerConnections]);

  const isPaidAds = activeCategory === 'PAID_ADS';

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              {isPaidAds ? (
                <>
                  <Megaphone className="w-6 h-6 text-primary" />
                  Paid Advertising OAuth Integrations
                </>
              ) : (
                <>
                  <Share2 className="w-6 h-6 text-primary" />
                  Organic Social Media OAuth Integrations
                </>
              )}
            </h1>
            <HelpIcon
              text={
                isPaidAds
                  ? 'Connect and manage OAuth 2.0 authorization for Google Ads, Microsoft Ads, Meta Ads, and LinkedIn Ads. Supports both live third-party OAuth 2.0 sign-in and simulated sandbox testing with fake data.'
                  : 'Connect and manage OAuth 2.0 authorization for LinkedIn Pages, X (Twitter), Facebook Pages, Instagram, YouTube, and TikTok Business.'
              }
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isPaidAds
              ? 'Multi-entity advertising account authorization. Connect with real OAuth 2.0 or test instantly with simulated sandbox data.'
              : 'Multi-entity organic social profile authorization. Connect with real OAuth 2.0 or test instantly with simulated sandbox data.'}
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleMqttSync}
              disabled={isMqttSyncing}
              className="gap-1.5 shadow-sm bg-blue-600 text-white hover:bg-blue-700 font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${isMqttSyncing ? 'animate-spin' : ''}`} />
              {isMqttSyncing ? 'Syncing via MQTT...' : 'Sync Channels via MQTT'}
            </Button>
          </div>
        )}
      </div>

      {/* MQTT Microservice Bus Status Banner */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50/70 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-zinc-900/30 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 mt-0.5">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">MQTT Social Media Microservice Event Bus</h3>
              <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200">
                Active (127.0.0.1:1883)
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connected social media channels and advertising accounts are synchronized in real-time from the Marketing & Social Media application via MQTT messaging. Direct OAuth authorization redirects are handled centrally by the social media app.
            </p>
          </div>
        </div>
        <Button
          onClick={handleMqttSync}
          disabled={isMqttSyncing}
          variant="outline"
          className="gap-2 bg-background hover:bg-muted text-xs font-medium border-blue-200 dark:border-blue-800 shrink-0 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isMqttSyncing ? 'animate-spin text-blue-600' : 'text-blue-600'}`} />
          {isMqttSyncing ? 'Syncing...' : 'Sync Accounts via MQTT'}
        </Button>
      </div>

      {/* Sub-Nav Menu Switcher (matching sidebar sub-navigation) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/configurations/integrations?category=PAID_ADS"
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all ${isPaidAds
              ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 font-medium'
              }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Paid Advertising</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${isPaidAds
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
                }`}
            >
              {counts.paidCount} / 4
            </span>
          </Link>

          <Link
            to="/configurations/integrations?category=SOCIAL_MEDIA"
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all ${!isPaidAds
              ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 font-medium'
              }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Organic Social Media</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${!isPaidAds
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
                }`}
            >
              {counts.socialCount} / 6
            </span>
          </Link>
        </div>

        <span className="text-xs text-muted-foreground hidden md:inline">
          {filteredProviders.length} platforms available in this section
        </span>
      </div>

      {/* Entity Selector Bar */}
      <Card className="border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex flex-wrap items-center gap-2 sm:min-w-[200px]">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Organization:
                </Label>
                <Select
                  value={activeOrgId}
                  onValueChange={(val) => {
                    setSelectedOrgId(val);
                    setSelectedCompanyId('ALL');
                  }}
                  disabled={loadingOrgs}
                >
                  <SelectTrigger className="h-9 w-full sm:w-[180px]">
                    <SelectValue placeholder="Select Org" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="h-4 w-px bg-border hidden sm:block" />

              <div className="flex flex-wrap items-center gap-2 sm:min-w-[240px]">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Entity Filter:
                </Label>
                <Select
                  value={selectedCompanyId}
                  onValueChange={setSelectedCompanyId}
                  disabled={loadingConnections}
                >
                  <SelectTrigger className="h-9 w-full sm:w-[220px]">
                    <SelectValue placeholder="Select Entity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">
                      🏢 Organization Master + All Subsidiaries
                    </SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs gap-1 font-normal py-1 px-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-semibold text-foreground">
                  {isPaidAds ? counts.paidCount : counts.socialCount}
                </span>
                <span className="text-muted-foreground">active</span>
              </Badge>
              <Badge variant="outline" className="text-xs gap-1 font-normal py-1 px-2.5">
                <Lock className="w-3.5 h-3.5 text-primary" />
                <span>AES-256-GCM Encrypted</span>
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-5">
        {filteredProviders.map((provider) => {
          const meta = PROVIDER_METADATA[provider];
          const info = providerConnections[provider];
          const directConn = info?.direct;
          const fallbackConn = info?.fallback;
          const activeConn = directConn || fallbackConn;

          const isDirect = !!directConn;
          const isConnected = !!activeConn && activeConn.status === 'CONNECTED';

          return (
            <Card
              key={provider}
              className="border border-border/70 hover:border-border transition-all shadow-sm flex flex-col justify-between overflow-hidden"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-base shadow-xs ${meta.iconBg}`}>
                      {meta.iconChar}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-sm font-semibold">{meta.name}</CardTitle>
                        {isAdSyncProvider(provider) && <AdSyncModeBadge provider={provider} enabled={canViewAdSync} />}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[9px] mt-0.5 px-1.5 py-0 font-normal uppercase tracking-wider text-muted-foreground"
                      >
                        {meta.category === 'PAID_ADS' ? 'Paid Advertising' : 'Social Media'}
                      </Badge>
                    </div>
                  </div>

                  {isConnected ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 gap-1 text-[11px]">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </Badge>
                  ) : activeConn ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-300 dark:border-amber-800 gap-1 text-[11px]">
                      <AlertTriangle className="w-3 h-3" />
                      {activeConn.status}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[11px] text-muted-foreground">
                      Not Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="py-2 space-y-3 flex-1 text-sm">
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {meta.description}
                </p>

                {activeConn ? (
                  <div className="p-3 rounded-md bg-muted/40 border border-border/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="shrink-0 text-muted-foreground">Hierarchy Scope:</span>
                      {isDirect ? (
                        <Badge variant="default" className="text-[10px] bg-primary/90">
                          Dedicated Company
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] bg-secondary/80">
                          Org Fallback (Master)
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="shrink-0 text-muted-foreground">Authorized Account:</span>
                      <span className="min-w-0 truncate text-right font-medium text-foreground" title={activeConn.account_name || undefined}>
                        {activeConn.account_name || 'Active Account'}
                      </span>
                    </div>

                    {activeConn.provider_account_id && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="shrink-0 text-muted-foreground">{meta.idLabel}:</span>
                        <span className="min-w-0 truncate text-right font-mono text-foreground">
                          {activeConn.provider_account_id}
                        </span>
                      </div>
                    )}

                    {isAdSyncProvider(provider) && isConnected && canViewAdSync && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="shrink-0 text-muted-foreground">Campaign Data:</span>
                        <AdPlatformLastSynced provider={provider} />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                      <span className="shrink-0 text-muted-foreground">Token Life:</span>
                      <span className="shrink-0 text-muted-foreground">
                        {activeConn.expires_at
                          ? 'Expires ' + new Date(activeConn.expires_at).toLocaleDateString()
                          : 'Auto-refreshing via OAuth 2.0'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-md border border-dashed border-border/80 text-center text-xs text-muted-foreground bg-muted/10 space-y-1.5">
                    <p className="font-medium text-foreground/80">Awaiting MQTT Synchronization</p>
                    <p className="text-[11px]">Channels are managed in the Social Media suite and synced automatically via MQTT.</p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-3 border-t border-border/40 bg-muted/10 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {isAdSyncProvider(provider) && isConnected && canSyncAds && (
                    <SyncAdPlatformButton provider={provider} className="h-8 text-xs gap-1" label="Sync now" />
                  )}
                  {activeConn && canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      disabled={refreshMutation.isPending}
                      onClick={() => refreshMutation.mutate(activeConn.id)}
                      title="Renew the sign-in token for this connection"
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                      Refresh token
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    disabled={resolvingProvider === provider}
                    onClick={() => handleTestResolution(provider)}
                  >
                    <ArrowRight className="w-3 h-3" />
                    {resolvingProvider === provider ? 'Checking...' : 'Resolve'}
                  </Button>
                </div>

                {canManage && (
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                    {activeConn ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => handleMqttSync()}
                          title="Switch account or re-authenticate via MQTT"
                        >
                          <KeyRound className="w-3 h-3 text-muted-foreground" />
                          Reconnect
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-destructive hover:bg-destructive/10"
                          disabled={disconnectMutation.isPending}
                          onClick={() => {
                            if (confirm(`Disconnect and revoke ${meta.name} connection?`)) {
                              disconnectMutation.mutate(activeConn.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5 border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-medium"
                          disabled={isMqttSyncing}
                          onClick={handleMqttSync}
                          title="Sync this channel from Social Media application over MQTT"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isMqttSyncing ? 'animate-spin text-blue-600' : 'text-blue-600'}`} />
                          Sync via MQTT
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
