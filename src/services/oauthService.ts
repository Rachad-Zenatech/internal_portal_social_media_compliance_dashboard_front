import { apiClient } from '@/services/apiClient';

export type OAuthProvider =
  | 'GOOGLE_ADS'
  | 'MICROSOFT_ADS'
  | 'META_ADS'
  | 'LINKEDIN_ADS'
  | 'LINKEDIN_PAGE'
  | 'X_TWITTER'
  | 'FACEBOOK_PAGE'
  | 'INSTAGRAM'
  | 'YOUTUBE'
  | 'TIKTOK';
export type ConnectionStatus = 'CONNECTED' | 'NEEDS_REAUTH' | 'EXPIRED' | 'REVOKED' | 'ERROR';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Company {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  parent_company_id?: string | null;
  brand_id?: number | null;
  currency: string;
  is_active: boolean;
  organization_name?: string;
  brand_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyCreate {
  organization_id: string;
  name: string;
  code: string;
  parent_company_id?: string | null;
  brand_id?: number | null;
  currency?: string;
  is_active?: boolean;
}

export interface CompanyUpdate {
  organization_id?: string;
  name?: string;
  code?: string;
  parent_company_id?: string | null;
  brand_id?: number | null;
  currency?: string;
  is_active?: boolean;
}

export interface OAuthConnection {
  id: string;
  organization_id: string;
  organization_name?: string;
  company_id?: string | null;
  company_name?: string | null;
  company_code?: string | null;
  provider: OAuthProvider;
  provider_account_id?: string | null;
  account_name?: string | null;
  token_type: string;
  expires_at?: string | null;
  is_expired: boolean;
  scopes: string[];
  status: ConnectionStatus;
  error_detail?: string | null;
  connection_metadata?: Record<string, any>;
  has_refresh_token: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OAuthConnectionCreate {
  organization_id: string;
  company_id?: string | null;
  provider: OAuthProvider;
  provider_account_id?: string;
  account_name?: string;
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: string;
  scopes?: string[];
  connection_metadata?: Record<string, any>;
}

export interface ResolvedConnection {
  connection: OAuthConnection;
  scope_level: 'COMPANY' | 'ORGANIZATION';
  access_token: string;
  provider: OAuthProvider;
}

export interface OAuthAuthorizeResponse {
  provider: OAuthProvider;
  authorization_url: string;
  state: string;
  is_configured: boolean;
}

export interface OAuthConnectResponse {
  connection: OAuthConnection;
  discovered_accounts: Array<{
    account_id: string;
    account_name: string;
    currency?: string;
    time_zone?: string;
  }>;
}

export const oauthService = {
  getOrganizations: () => apiClient.get<Organization[]>('/api/oauth/organizations'),
  getCompanies: (orgId?: string) =>
    apiClient.get<Company[]>(orgId ? '/api/oauth/companies?organization_id=' + orgId : '/api/oauth/companies'),
  createCompany: (data: CompanyCreate) =>
    apiClient.post<Company>('/api/oauth/companies', data),
  updateCompany: (id: string, data: CompanyUpdate) =>
    apiClient.put<Company>('/api/oauth/companies/' + id, data),
  deleteCompany: (id: string) =>
    apiClient.delete<void>('/api/oauth/companies/' + id),
  getConnections: (params?: { organization_id?: string; company_id?: string; provider?: OAuthProvider }) => {
    const q = new URLSearchParams();
    if (params?.organization_id) q.set('organization_id', params.organization_id);
    if (params?.company_id) q.set('company_id', params.company_id);
    if (params?.provider) q.set('provider', params.provider);
    const qs = q.toString();
    return apiClient.get<OAuthConnection[]>(qs ? '/api/oauth/connections?' + qs : '/api/oauth/connections');
  },
  storeConnection: (data: OAuthConnectionCreate) =>
    apiClient.post<OAuthConnection>('/api/oauth/connections', data),
  refreshConnection: (id: string) =>
    apiClient.post<OAuthConnection>('/api/oauth/connections/' + id + '/refresh'),
  disconnectConnection: (id: string) =>
    apiClient.delete<void>('/api/oauth/connections/' + id),
  resolveConnection: (orgId: string, companyId?: string | null, provider: OAuthProvider = 'GOOGLE_ADS') => {
    const q = new URLSearchParams({ organization_id: orgId, provider });
    if (companyId) q.set('company_id', companyId);
    return apiClient.get<ResolvedConnection>('/api/oauth/resolve?' + q.toString());
  },
  getAuthorizationUrl: (provider: OAuthProvider, params: { organization_id: string; company_id?: string; redirect_uri?: string }) => {
    const q = new URLSearchParams({ organization_id: params.organization_id });
    if (params.company_id) q.set('company_id', params.company_id);
    if (params.redirect_uri) q.set('redirect_uri', params.redirect_uri);
    return apiClient.get<OAuthAuthorizeResponse>('/api/oauth/authorize/' + provider + '?' + q.toString());
  },
  handleCallback: (data: { provider: OAuthProvider; code: string; state: string; redirect_uri?: string }) =>
    apiClient.post<OAuthConnectResponse>('/api/oauth/callback', data),
  connectInstant: (provider: OAuthProvider, data: { organization_id: string; company_id?: string | null; account_name?: string; provider_account_id?: string }) =>
    apiClient.post<OAuthConnectResponse>('/api/oauth/connect-instant/' + provider, data),
  syncMqtt: () =>
    apiClient.post<{ success: boolean; mqtt_connected: boolean; synced_count: number; source: string; accounts: OAuthConnection[] }>('/api/oauth/sync-mqtt', {}),
  getMqttStatus: () =>
    apiClient.get<{ mqtt_connected: boolean; service: string; instance_id: string; broker: string; subscribed_topics: string[] }>('/api/oauth/mqtt-status'),
};
