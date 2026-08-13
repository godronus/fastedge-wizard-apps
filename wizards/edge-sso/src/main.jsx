import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { connect, WizardError } from '@gcoredev/fastedge-wizard-sdk';
import '@gcore/wizard-step-kit'; // side-effect: registers the custom elements
import { WizardShell, WizardStep } from '@gcore/wizard-step-kit/react';

import { StepOverview } from './steps/StepOverview.jsx';
import { StepVariant } from './steps/StepVariant.jsx';
import { StepCdn } from './steps/StepCdn.jsx';
import { StepRouting } from './steps/StepRouting.jsx';
import { StepSigning } from './steps/StepSigning.jsx';
import { StepProviders } from './steps/StepProviders.jsx';
import { StepBranding } from './steps/StepBranding.jsx';
import { StepReview } from './steps/StepReview.jsx';

const hostOrigin = new URLSearchParams(location.search).get('hostOrigin') || 'https://portal.gcore.com';

// Escape a user-supplied path prefix for safe use inside a CDN rule regex —
// otherwise metacharacters (e.g. the '.' in "/auth.v2") match more broadly than
// the literal path the user typed.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const VARIANTS = ['gate-only', 'cookie', 'header'];

// The launch template (737) is an inert placeholder — the six real deployable
// templates are all companions, split 3 variants × {auth, filter}. Identify each
// by name substring + api_type, never by hard-coded id (see TARGET.md).
function classifyTemplates(details) {
    const byVariant = {};
    for (const t of details) {
        const n = t.name.toLowerCase();
        const variant = VARIANTS.find((v) => n.includes(v));
        const role = t.api_type === 'wasi-http' ? 'auth' : t.api_type === 'proxy-wasm' ? 'filter' : null;
        if (!variant || !role) continue;
        byVariant[variant] = { ...byVariant[variant], [role]: t };
    }
    return byVariant;
}

const emptyProvider = { clientId: '', clientSecret: null, redirectUri: '' };

// ── Wizard root ────────────────────────────────────────────────────────────

function Wizard({ session, byVariant }) {
    const [step, setStep] = useState(0);
    const [f, setF] = useState({
        // Core
        name: 'sso',
        cdn: null,
        variant: '',
        // Routing (shared between both apps)
        authPrefix: '/auth',
        audience: '',
        cookie: 'sso_session',
        issuer: '',
        canonicalHost: '',
        allowedOrigins: '',
        loginUrl: '',
        // Session signing
        sessionSecret: null,
        signingKey: null,
        // Providers
        selectedProviders: [],
        providers: {
            google: { ...emptyProvider },
            github: { clientId: '', clientSecret: null },
            microsoft: { ...emptyProvider, tenant: 'common', allowedTenants: '' },
            facebook: { ...emptyProvider },
            saml: { idpSsoUrl: '', idpEntityId: '', idpCert: null, spEntityId: '', spAcsUrl: '', idpLabel: 'SSO', idpIconUrl: '' },
        },
        // Branding
        brandMode: 'none',
        brandTitle: '',
        brandSubtitle: '',
        brandLogo: '',
        brandFavicon: '',
        brandAccent: '#0066cc',
        brandBackground: '#f0f2f5',
        brandCssUrl: '',
    });
    const set = (patch) => setF((prev) => ({ ...prev, ...patch }));

    const [deploy, setDeploy] = useState({
        state: { status: 'idle', plan: null, progress: [], result: null, error: null },
    });

    const pair = f.variant ? byVariant[f.variant] : null;
    const authT = pair?.auth;
    const filterT = pair?.filter;

    function hasProviderConfig(key) {
        const p = f.providers[key];
        if (key === 'saml') return !!(p.idpSsoUrl.trim() && p.idpEntityId.trim() && p.idpCert);
        return !!(p.clientId.trim() && p.clientSecret);
    }

    // Steps: 0 Overview · 1 Variant · 2 CDN · 3 Routing · 4 Signing
    //        5 Providers · 6 Branding · 7 Review
    const canAdvance = useMemo(() => {
        switch (step) {
            case 0:
                return !!f.name.trim();
            case 1:
                return !!f.variant;
            case 2:
                return !!f.cdn;
            case 3:
                return !!f.audience.trim() && f.authPrefix.startsWith('/') && f.authPrefix.length > 1;
            case 4:
                return !!f.sessionSecret && (f.variant !== 'cookie' || !!f.signingKey);
            case 5:
                return f.selectedProviders.length > 0 && f.selectedProviders.every(hasProviderConfig);
            case 6:
                return true; // optional
            case 7:
                return deploy.state.status === 'idle' || deploy.state.status === 'error';
            default:
                return false;
        }
    }, [step, f, deploy]);

    function buildProviderConfig() {
        const env = {};
        const secretRefs = {};
        for (const key of f.selectedProviders) {
            const p = f.providers[key];
            switch (key) {
                case 'google':
                    env.GOOGLE_CLIENT_ID = p.clientId;
                    if (p.redirectUri) env.GOOGLE_REDIRECT_URI = p.redirectUri;
                    secretRefs.GOOGLE_CLIENT_SECRET = p.clientSecret.id;
                    break;
                case 'github':
                    env.GITHUB_CLIENT_ID = p.clientId;
                    secretRefs.GITHUB_CLIENT_SECRET = p.clientSecret.id;
                    break;
                case 'microsoft':
                    env.MICROSOFT_CLIENT_ID = p.clientId;
                    if (p.redirectUri) env.MICROSOFT_REDIRECT_URI = p.redirectUri;
                    if (p.tenant && p.tenant !== 'common') env.MICROSOFT_TENANT = p.tenant;
                    if (p.allowedTenants) env.MICROSOFT_ALLOWED_TENANTS = p.allowedTenants;
                    secretRefs.MICROSOFT_CLIENT_SECRET = p.clientSecret.id;
                    break;
                case 'facebook':
                    env.FACEBOOK_CLIENT_ID = p.clientId;
                    if (p.redirectUri) env.FACEBOOK_REDIRECT_URI = p.redirectUri;
                    secretRefs.FACEBOOK_CLIENT_SECRET = p.clientSecret.id;
                    break;
                case 'saml':
                    env.IDP_SSO_URL = p.idpSsoUrl;
                    env.IDP_ENTITY_ID = p.idpEntityId;
                    if (p.spEntityId) env.SP_ENTITY_ID = p.spEntityId;
                    if (p.spAcsUrl) env.SP_ACS_URL = p.spAcsUrl;
                    if (p.idpLabel && p.idpLabel !== 'SSO') env.IDP_LABEL = p.idpLabel;
                    if (p.idpIconUrl) env.IDP_ICON_URL = p.idpIconUrl;
                    secretRefs.IDP_CERT = p.idpCert.id;
                    break;
            }
        }
        return { env, secretRefs };
    }

    async function handleFinish() {
        const sharedEnv = {
            AUTH_PREFIX: f.authPrefix,
            SSO_AUDIENCE: f.audience,
            SESSION_COOKIE: f.cookie,
            ...(f.issuer ? { SSO_ISSUER: f.issuer } : {}),
        };

        const brandEnv =
            f.brandMode === 'custom'
                ? {
                      ...(f.brandTitle ? { LOGIN_PAGE_TITLE: f.brandTitle } : {}),
                      ...(f.brandSubtitle ? { LOGIN_PAGE_SUBTITLE: f.brandSubtitle } : {}),
                      ...(f.brandLogo ? { LOGIN_PAGE_LOGO_URL: f.brandLogo } : {}),
                      ...(f.brandFavicon ? { LOGIN_PAGE_FAVICON_URL: f.brandFavicon } : {}),
                      ...(f.brandAccent && f.brandAccent !== '#0066cc' ? { LOGIN_PAGE_ACCENT_COLOR: f.brandAccent } : {}),
                      ...(f.brandBackground && f.brandBackground !== '#f0f2f5' ? { LOGIN_PAGE_BACKGROUND_COLOR: f.brandBackground } : {}),
                      ...(f.brandCssUrl ? { LOGIN_PAGE_CSS_URL: f.brandCssUrl } : {}),
                  }
                : {};

        const { env: providerEnv, secretRefs: providerSecretRefs } = buildProviderConfig();

        const isCookie = f.variant === 'cookie';

        const appEnv = {
            ...(f.canonicalHost ? { CANONICAL_HOST: f.canonicalHost } : {}),
            ...(f.allowedOrigins ? { SSO_ALLOWED_ORIGINS: f.allowedOrigins } : {}),
            ...(isCookie ? { SESSION_PUBLIC_JWK: f.signingKey.publicKey } : {}),
            ...providerEnv,
            ...brandEnv,
        };
        const appSecretRefs = {
            SESSION_SECRET: f.sessionSecret.id,
            ...(isCookie ? { SESSION_SIGNING_KEY: f.signingKey.id } : {}),
            ...providerSecretRefs,
        };

        const filterEnv = {
            ...(f.loginUrl ? { LOGIN_PAGE_URL: f.loginUrl } : {}),
            ...(isCookie ? { SESSION_PUBLIC_JWK: f.signingKey.publicKey } : {}),
        };
        // The cookie variant's filter verifies via the public JWK only — it never
        // holds SESSION_SECRET (that stays app-only, signing OAuth/SAML flow cookies).
        const filterSecretRefs = isCookie ? {} : { SESSION_SECRET: f.sessionSecret.id };

        const planParams = {
            fastedgeApps: [
                {
                    ref: 'app',
                    name: `${f.name}-app`,
                    api_type: 'wasi-http',
                    source: { fromTemplateId: authT.id },
                    env: appEnv,
                    secretRefs: appSecretRefs,
                },
                {
                    ref: 'filter',
                    name: `${f.name}-filter`,
                    api_type: 'proxy-wasm',
                    source: { fromTemplateId: filterT.id },
                    env: filterEnv,
                    secretRefs: filterSecretRefs,
                },
            ],
            sharedEnv,
            cdnResourceId: f.cdn.id,
            newCdnOrigins: [{ ref: 'app-origin', name: `${f.name}-app-origin`, appRef: 'app' }],
            newCdnRules: [
                // Route the auth flow paths to the app origin.
                {
                    ref: 'app-route',
                    name: `${f.name}-auth-route`,
                    rule: `^${escapeRegex(f.authPrefix)}`,
                    weight: 10,
                    originGroupRef: 'app-origin',
                },
                // Enforce the filter on everything else (it self-bypasses AUTH_PREFIX internally).
                {
                    ref: 'filter-rule',
                    name: `${f.name}-sso-filter`,
                    rule: '^/.*',
                    weight: 1,
                    fastedgeFilter: { appRef: 'filter', hook: 'on_request_headers', interruptOnError: true },
                },
            ],
        };

        setDeploy({ state: { status: 'planning', plan: null, progress: [], result: null, error: null } });
        try {
            const result = await session.deployment.deploy(planParams, {
                onPlan: (plan) => setDeploy((d) => ({ state: { ...d.state, status: 'applying', plan } })),
                onProgress: (ev) => setDeploy((d) => ({ state: { ...d.state, progress: [...d.state.progress, ev] } })),
            });
            setDeploy((d) => ({ state: { ...d.state, status: 'done', result } }));
        } catch (err) {
            if (err instanceof WizardError && err.code === 'user_cancelled') {
                setDeploy((d) => ({ state: { ...d.state, status: 'idle' } }));
            } else {
                setDeploy((d) => ({ state: { ...d.state, status: 'error', error: err.message } }));
            }
        }
    }

    return (
        <WizardShell
            canAdvance={canAdvance}
            finished={deploy.state.status === 'done'}
            labels={{ finish: 'Deploy', finished: 'Finished' }}
            onNavigated={(e) => setStep(e.detail.to)}
            onFinish={handleFinish}
            onWizardFinished={() => session.wizard.finish()}
        >
            <WizardStep title="Overview">
                <StepOverview f={f} set={set} />
            </WizardStep>
            <WizardStep title="Variant">
                <StepVariant f={f} set={set} />
            </WizardStep>
            <WizardStep title="CDN resource">
                <StepCdn session={session} f={f} set={set} />
            </WizardStep>
            <WizardStep title="Routing & session">
                <StepRouting f={f} set={set} />
            </WizardStep>
            <WizardStep title="Signing">
                <StepSigning session={session} f={f} set={set} />
            </WizardStep>
            <WizardStep title="Providers">
                <StepProviders session={session} f={f} set={set} />
            </WizardStep>
            <WizardStep title="Branding">
                <StepBranding f={f} set={set} />
            </WizardStep>
            <WizardStep title="Review">
                <StepReview f={f} deploy={deploy} authT={authT} filterT={filterT} />
            </WizardStep>
        </WizardShell>
    );
}

// ── App entry ────────────────────────────────────────────────────────────

function App() {
    const [state, setState] = useState({ status: 'connecting' });

    useEffect(() => {
        let session;
        (async () => {
            try {
                session = await connect({ expectedHostOrigin: hostOrigin });
                const ctx = await session.context.get();

                if (ctx.launchTemplateId === null) {
                    session?.dispose();
                    setState({
                        status: 'error',
                        error: 'Opened in re-entry mode — launch from the SSO template to deploy.',
                    });
                    return;
                }
                // The launch template (737) is an inert placeholder — only the
                // companions carry real params. Never read the launch template itself.
                if (ctx.companionTemplateIds.length !== 6) {
                    session?.dispose();
                    setState({
                        status: 'error',
                        error: `Expected 6 companion templates (3 variants × 2 apps), got ${ctx.companionTemplateIds.length}. Check the wizard's template wiring.`,
                    });
                    return;
                }
                const details = await Promise.all(
                    ctx.companionTemplateIds.map((id) => session.fastedge.templates.read({ id })),
                );
                const byVariant = classifyTemplates(details);
                if (VARIANTS.some((v) => !byVariant[v]?.auth || !byVariant[v]?.filter)) {
                    session?.dispose();
                    setState({
                        status: 'error',
                        error: 'Could not identify an auth-app + cdn-filter pair for every variant (gate-only/cookie/header). Check companion template names.',
                    });
                    return;
                }
                setState({ status: 'ready', session, ctx, byVariant });
            } catch (err) {
                setState({ status: 'error', error: `${err.code ?? 'error'}: ${err.message}` });
            } finally {
                // Reveal the root for *every* terminal state — error messages render
                // into #root too, so leaving it hidden on failure shows a blank page.
                document.getElementById('root').hidden = false;
            }
        })();
        return () => session?.dispose();
    }, []);

    if (state.status === 'connecting') return <p>Connecting…</p>;
    if (state.status === 'error') return <p className="wizard-error">{state.error}</p>;
    return <Wizard session={state.session} byVariant={state.byVariant} />;
}

createRoot(document.getElementById('root')).render(<App />);
