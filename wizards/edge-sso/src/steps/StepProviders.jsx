import { useState } from 'react';
import { optional } from '@gcoredev/fastedge-wizard-sdk';
import { OptionalPanels, WizardPanel, ResourceRow } from '@gcore/wizard-step-kit/react';
import { Field } from '../components.jsx';

// A provider self-activates only if its secret is present — the wizard only ever
// writes creds for the providers selected here, so no separate on/off env is needed.
export function StepProviders({ session, f, set }) {
    const [busy, setBusy] = useState('');
    const p = f.providers;
    const setP = (key, patch) => set({ providers: { ...p, [key]: { ...p[key], ...patch } } });

    const pickSecret = (key, field, name, comment, label) => async () => {
        setBusy(`${key}.${field}`);
        try {
            const rs = await optional(() => session.fastedge.secrets.pickOrCreate({ name, comment, label }));
            if (rs && rs.length) setP(key, { [field]: rs[0] });
        } catch (err) {
            console.error(`${key} ${field} select failed:`, err);
        } finally {
            setBusy('');
        }
    };

    return (
        <>
            <h2 tabIndex={-1}>Identity providers</h2>
            <p className="sso-lede">
                Select one or more providers. Each selected provider needs its client
                credentials below — the login page shows only the providers you configure.
            </p>
            <OptionalPanels multiple onChange={(sel) => set({ selectedProviders: sel })}>
                <WizardPanel value="google" label="Google">
                    <Field label="Client ID" value={p.google.clientId}
                        onChange={(v) => setP('google', { clientId: v })} />
                    <ResourceRow title="Client secret" value={p.google.clientSecret?.name}
                        set={!!p.google.clientSecret} onClear={() => setP('google', { clientSecret: null })}>
                        <button onClick={pickSecret('google', 'clientSecret', `${f.name}-google-secret`, 'Google OAuth client secret', 'Google client secret')}
                            disabled={!!busy}>Select</button>
                    </ResourceRow>
                    <Field label="Redirect URI (optional)" value={p.google.redirectUri}
                        onChange={(v) => setP('google', { redirectUri: v })}
                        placeholder={`https://<host>${f.authPrefix}/callback/google`}
                        hint="Must match exactly what is registered in Google Cloud Console. Defaults to the standard path under Auth path prefix." />
                </WizardPanel>
                <WizardPanel value="github" label="GitHub">
                    <Field label="Client ID" value={p.github.clientId}
                        onChange={(v) => setP('github', { clientId: v })} />
                    <ResourceRow title="Client secret" value={p.github.clientSecret?.name}
                        set={!!p.github.clientSecret} onClear={() => setP('github', { clientSecret: null })}>
                        <button onClick={pickSecret('github', 'clientSecret', `${f.name}-github-secret`, 'GitHub OAuth client secret', 'GitHub client secret')}
                            disabled={!!busy}>Select</button>
                    </ResourceRow>
                </WizardPanel>
                <WizardPanel value="microsoft" label="Microsoft">
                    <Field label="Client ID" value={p.microsoft.clientId}
                        onChange={(v) => setP('microsoft', { clientId: v })} />
                    <ResourceRow title="Client secret" value={p.microsoft.clientSecret?.name}
                        set={!!p.microsoft.clientSecret} onClear={() => setP('microsoft', { clientSecret: null })}>
                        <button onClick={pickSecret('microsoft', 'clientSecret', `${f.name}-microsoft-secret`, 'Microsoft OAuth client secret', 'Microsoft client secret')}
                            disabled={!!busy}>Select</button>
                    </ResourceRow>
                    <Field label="Redirect URI (optional)" value={p.microsoft.redirectUri}
                        onChange={(v) => setP('microsoft', { redirectUri: v })}
                        placeholder={`https://<host>${f.authPrefix}/callback/microsoft`} />
                    <Field label="Tenant" value={p.microsoft.tenant}
                        onChange={(v) => setP('microsoft', { tenant: v })}
                        hint="Tenant ID, domain, or common/organizations/consumers. Default: common" />
                    <Field label="Allowed tenants (optional)" value={p.microsoft.allowedTenants}
                        onChange={(v) => setP('microsoft', { allowedTenants: v })}
                        hint="Comma-separated tenant IDs that may sign in. Strongly recommended when Tenant is a wildcard." />
                </WizardPanel>
                <WizardPanel value="facebook" label="Facebook">
                    <Field label="Client ID" value={p.facebook.clientId}
                        onChange={(v) => setP('facebook', { clientId: v })} />
                    <ResourceRow title="Client secret" value={p.facebook.clientSecret?.name}
                        set={!!p.facebook.clientSecret} onClear={() => setP('facebook', { clientSecret: null })}>
                        <button onClick={pickSecret('facebook', 'clientSecret', `${f.name}-facebook-secret`, 'Facebook OAuth client secret', 'Facebook client secret')}
                            disabled={!!busy}>Select</button>
                    </ResourceRow>
                    <Field label="Redirect URI (optional)" value={p.facebook.redirectUri}
                        onChange={(v) => setP('facebook', { redirectUri: v })}
                        placeholder={`https://<host>${f.authPrefix}/callback/facebook`} />
                </WizardPanel>
                <WizardPanel value="saml" label="SAML">
                    <Field label="IdP SSO URL" value={p.saml.idpSsoUrl}
                        onChange={(v) => setP('saml', { idpSsoUrl: v })}
                        hint="The endpoint that receives AuthnRequests." />
                    <Field label="IdP entity ID" value={p.saml.idpEntityId}
                        onChange={(v) => setP('saml', { idpEntityId: v })}
                        hint="Must exactly match the Issuer element in signed assertions." />
                    <ResourceRow title="IdP signing certificate" value={p.saml.idpCert?.name}
                        set={!!p.saml.idpCert} onClear={() => setP('saml', { idpCert: null })}>
                        <button onClick={pickSecret('saml', 'idpCert', `${f.name}-saml-cert`, 'SAML IdP signing certificate', 'IdP signing certificate')}
                            disabled={!!busy}>Select</button>
                    </ResourceRow>
                    <Field label="SP entity ID (optional)" value={p.saml.spEntityId}
                        onChange={(v) => setP('saml', { spEntityId: v })}
                        hint="This service provider's entityID. Register it with your IdP." />
                    <Field label="SP ACS URL (optional)" value={p.saml.spAcsUrl}
                        onChange={(v) => setP('saml', { spAcsUrl: v })}
                        placeholder={`https://<host>${f.authPrefix}/callback`}
                        hint="Assertion Consumer Service URL. Register it with your IdP." />
                    <Field label="Button label" value={p.saml.idpLabel}
                        onChange={(v) => setP('saml', { idpLabel: v })}
                        hint='Text shown on the SAML login button. Default: "SSO"' />
                    <Field label="Button icon URL (optional)" value={p.saml.idpIconUrl}
                        onChange={(v) => setP('saml', { idpIconUrl: v })} />
                </WizardPanel>
            </OptionalPanels>
        </>
    );
}
