import { useState } from 'react';
import { optional } from '@gcoredev/fastedge-wizard-sdk';
import { ResourceRow } from '@gcore/wizard-step-kit/react';

// Session signing keys. Every variant needs SESSION_SECRET (signs the OAuth/SAML
// flow cookies; also the HS256 session token itself for gate-only/header). The
// cookie variant additionally needs an ES256 keypair for the session token, since
// its whole point is a verifiable-by-the-origin JWT rather than a shared secret.
export function StepSigning({ session, f, set }) {
    const [busy, setBusy] = useState('');

    async function genSecret() {
        setBusy('secret');
        try {
            const rs = await optional(() => session.fastedge.secrets.pickOrCreate({
                name: `${f.name}-session-secret`, comment: 'SSO session/flow signing secret', bytes: 32,
                label: 'Session secret',
            }));
            if (rs && rs.length) set({ sessionSecret: rs[0] });
        } catch (err) {
            console.error('session secret pick/generate failed:', err);
        } finally {
            setBusy('');
        }
    }

    async function genKeypair() {
        setBusy('keypair');
        try {
            const r = await optional(() => session.fastedge.secrets.generateKeypair({
                name: `${f.name}-session-key`, comment: 'ES256 session signing key (cookie variant)', algorithm: 'ES256',
            }));
            if (r) set({ signingKey: r });
        } catch (err) {
            console.error('session keypair generation failed:', err);
        } finally {
            setBusy('');
        }
    }

    return (
        <>
            <h2 tabIndex={-1}>Session signing</h2>
            <p className="sso-lede">
                {f.variant === 'cookie'
                    ? 'The cookie variant signs the session token asymmetrically (ES256), so your origin never holds a forge-capable secret.'
                    : 'The session token is signed with a shared secret (HS256) — the same value is bound to both apps.'}
            </p>
            <ResourceRow title="Session secret"
                sub={f.variant === 'cookie'
                    ? 'Signs OAuth/SAML flow cookies (state/PKCE). App-only — not shared with the filter.'
                    : 'HS256, shared with the filter. Signs the session token itself.'}
                set={!!f.sessionSecret} value={f.sessionSecret?.name} onClear={() => set({ sessionSecret: null })}>
                <button onClick={genSecret} disabled={!!busy}>Select</button>
            </ResourceRow>
            {f.variant === 'cookie' && (
                <ResourceRow title="ES256 session signing keypair"
                    sub="Private key stored as a secret on the app; public JWK bound to both apps (the filter verifies with it, never signs)."
                    set={!!f.signingKey} value={f.signingKey?.name} onClear={() => set({ signingKey: null })}>
                    <button onClick={genKeypair} disabled={!!busy}>Generate keypair</button>
                </ResourceRow>
            )}
        </>
    );
}
