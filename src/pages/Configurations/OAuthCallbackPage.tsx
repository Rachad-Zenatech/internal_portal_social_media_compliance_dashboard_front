import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { oauthService, type OAuthProvider } from '@/services/oauthService';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [connectedDetails, setConnectedDetails] = useState<any>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDesc = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setErrorMessage(errorDesc || error || 'OAuth authorization was cancelled or denied.');
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setErrorMessage('Missing authorization code or state parameter from provider.');
      return;
    }

    let provider: OAuthProvider = 'GOOGLE_ADS';
    try {
      const decoded = JSON.parse(atob(state.replace(/-/g, '+').replace(/_/g, '/')));
      if (decoded.provider) {
        provider = decoded.provider;
      }
    } catch {
      // Fallback
    }

    const redirectUri = `${window.location.origin}/oauth/callback`;

    oauthService
      .handleCallback({
        provider,
        code,
        state,
        redirect_uri: redirectUri,
      })
      .then((res) => {
        setStatus('success');
        setConnectedDetails(res);
        setTimeout(() => {
          // Google Ads and Microsoft Ads: the integrations page then suggests syncing their campaigns and results
          const synced = provider === 'GOOGLE_ADS' || provider === 'MICROSOFT_ADS';
          navigate(`/configurations/integrations?category=PAID_ADS${synced ? `&connected=${provider}` : ''}`);
        }, 2200);
      })
      .catch((err) => {
        setStatus('error');
        setErrorMessage(err?.response?.data?.detail || err.message || 'Token exchange failed');
      });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-border/80 shadow-lg text-center p-6">
        <CardHeader className="pb-3">
          <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-2 bg-primary/10 text-primary">
            {status === 'processing' && <RefreshCw className="w-6 h-6 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
            {status === 'error' && <AlertTriangle className="w-6 h-6 text-destructive" />}
          </div>

          <CardTitle className="text-xl">
            {status === 'processing' && 'Processing OAuth 2.0 Authorization...'}
            {status === 'success' && 'Account Connected Successfully!'}
            {status === 'error' && 'OAuth Authorization Failed'}
          </CardTitle>

          <CardDescription className="text-xs mt-1">
            {status === 'processing' &&
              'Exchanging authorization grant with provider, retrieving ad accounts, and encrypting credentials with AES-256-GCM.'}
            {status === 'success' &&
              'Tokens encrypted and stored securely in PostgreSQL. Redirecting to Integrations hub...'}
            {status === 'error' && errorMessage}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-2">
          {status === 'success' && connectedDetails && (
            <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 space-y-1 mb-4">
              <p className="font-semibold">{connectedDetails.connection?.account_name || 'Active Account'}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {connectedDetails.connection?.provider_account_id}
              </p>
            </div>
          )}

          <div className="flex justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/configurations/integrations?category=PAID_ADS')}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Integrations
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
