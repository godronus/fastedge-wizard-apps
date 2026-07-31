import { useState } from 'react';
import { OptionalPanels, WizardPanel } from '@gcore/wizard-step-kit/react';
import { optional } from '@gcoredev/fastedge-wizard-sdk';
import { ResourceRow } from '@gcore/wizard-step-kit/react';
import { Field } from '../components.jsx';

export function StepProfile({ session, f, set }) {
    const [busy, setBusy] = useState(false);
    async function genKeypair() {
        setBusy(true);
        try {
            const r = await optional(() => session.fastedge.secrets.generateKeypair({
                name: `${f.name}-proof-key`, comment: 'ES256 proof signing key (Profile B)', algorithm: 'ES256',
            }));
            if (r) set({ proofKey: r });
        } catch (err) {
            console.error('proof keypair generation failed:', err);
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <h2 tabIndex={-1}>Enforcement profile</h2>
            <OptionalPanels onChange={(sel) => set({ profile: sel[0] || '' })}>
                <WizardPanel value="A" label="Profile A — edge enforces (recommended)">
                    <p>The filter enforces the <code>mfa_session</code> on protected paths. Your
                        origin needs <strong>no code changes</strong> beyond signing the handoff
                        ticket. Sessions last up to 8h (non-sliding).</p>
                </WizardPanel>
                <WizardPanel value="B" label="Profile B — origin verifies a signed proof">
                    <p>The app additionally issues a one-time <strong>ES256</strong> proof; your
                        origin verifies it via JWKS and mints its own (longer, revocable) session.
                        Choose this when you need sessions longer than 8h or origin-managed
                        revocation.</p>
                    <ResourceRow title="ES256 proof keypair"
                        sub="Private key stored as a secret on the app; public JWK served at {AUTH_PREFIX}/.well-known/jwks.json."
                        set={!!f.proofKey} onClear={() => set({ proofKey: null })}>
                        <button onClick={genKeypair} disabled={busy}>Generate keypair</button>
                    </ResourceRow>
                    <Field label="Proof TTL (seconds)" value={f.proofTtl}
                        onChange={(v) => set({ proofTtl: v })}
                        hint="How long the one-time proof cookie is valid. Short is intentional — it's single-use. Default: 90" />
                    <Field label="Proof cookie name" value={f.proofCookie}
                        onChange={(v) => set({ proofCookie: v })}
                        hint="Name of the one-time ES256 proof cookie. Default: mfa_proof" />
                </WizardPanel>
            </OptionalPanels>
        </>
    );
}
