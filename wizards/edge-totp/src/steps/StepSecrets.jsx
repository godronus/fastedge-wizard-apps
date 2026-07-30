import { useState } from 'react';
import { optional } from '@gcoredev/fastedge-wizard-sdk';
import { ResourceRow } from '@gcore/wizard-step-kit/react';

export function StepSecrets({ session, f, set }) {
    const [busy, setBusy] = useState('');
    // Wizard-defined HS256 keys → generateRandom: the host generates a fresh 32-byte value.
    // (These are keys the wizard defines, not secrets the user brings — so no picker.)
    const generate = (key, name, comment) => async () => {
        setBusy(key);
        const r = await optional(() => session.fastedge.secrets.generateRandom({ name, comment, bytes: 32 }));
        setBusy('');
        if (r) set({ [key]: r });
    };
    // Gcore API token is a real external token the user brings → pickOrCreate: they select an
    // existing secret or create one inline (pasting the token) in the same host modal.
    async function selectToken() {
        setBusy('gcore');
        const rs = await optional(() => session.fastedge.secrets.pickOrCreate());
        setBusy('');
        if (rs && rs.length) set({ gcore: rs[0] });
    }
    return (
        <>
            <h2 tabIndex={-1}>Secrets</h2>
            <p className="totp-lede">
                Generate the signing keys and add the Gcore API token. The session key is
                <strong> shared</strong> — created once and bound to both apps.
            </p>
            <ResourceRow title={f.sessionKey ? f.sessionKey.name : 'Session signing key (shared)'}
                sub="HS256, edge-internal. App signs mfa_session; filter verifies it." set={!!f.sessionKey}
                onClear={() => set({ sessionKey: null })}>
                <button onClick={generate('sessionKey', `${f.name}-mfa-session-key`, 'Shared HS256 mfa_session key')}
                    disabled={!!busy}>Generate</button>
            </ResourceRow>
            <ResourceRow title={f.handoff ? f.handoff.name : 'Handoff key'}
                sub="HS256, shared with your origin. Copy the generated value into your origin's login code." set={!!f.handoff}
                onClear={() => set({ handoff: null })}>
                <button onClick={generate('handoff', `${f.name}-handoff-key`, 'HS256 handoff ticket key (shared with origin)')}
                    disabled={!!busy}>Generate</button>
            </ResourceRow>
            <ResourceRow title={f.enroll ? f.enroll.name : 'Enroll API key'}
                sub="Bearer token gating POST {AUTH_PREFIX}/enroll." set={!!f.enroll}
                onClear={() => set({ enroll: null })}>
                <button onClick={generate('enroll', `${f.name}-enroll-api-key`, 'Bearer token for /enroll')}
                    disabled={!!busy}>Generate</button>
            </ResourceRow>
            <ResourceRow title="Gcore API token"
                sub="Real token with KV write access — select an existing secret or create one." set={!!f.gcore}
                onClear={() => set({ gcore: null })}>
                <button onClick={selectToken} disabled={busy === 'gcore'}>Select</button>
            </ResourceRow>
        </>
    );
}
