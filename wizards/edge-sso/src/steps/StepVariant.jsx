import { OptionalPanels, WizardPanel } from '@gcore/wizard-step-kit/react';

// The variant picker — this is the "pick 2 of N companions" branch that makes
// this wizard different from a single-companion wizard like edge-totp. The
// choice here selects which pair of companion template IDs (auth-app +
// cdn-filter) every later step and the final deploy plan actually uses.
export function StepVariant({ f, set }) {
    return (
        <>
            <h2 tabIndex={-1}>Choose identity delivery</h2>
            <p className="sso-lede">
                Three variants differ only in how the edge hands identity to your origin.
                Provider choice (Google/GitHub/SAML/etc.) is a later step, independent of this one.
            </p>
            <OptionalPanels onChange={(sel) => set({ variant: sel[0] || '' })}>
                <WizardPanel value="gate-only" label="Gate-only — allow/deny">
                    <p>The edge delivers <strong>nothing</strong> to your origin — just pass or
                        redirect. Simplest option. Use when your origin only needs to know
                        &quot;is this user authed?&quot; (static sites, downloads, internal tools).</p>
                </WizardPanel>
                <WizardPanel value="cookie" label="Cookie — verifiable JWT">
                    <p>The edge sets a signed <strong>ES256 JWT cookie</strong> your origin can
                        verify itself via a published JWKS endpoint — no shared secret needed on
                        your side. Use when your origin already verifies stateless JWTs.</p>
                </WizardPanel>
                <WizardPanel value="header" label="Header — x-sso-* identity headers">
                    <p>The edge injects <code>x-sso-user</code> and per-claim{' '}
                        <code>x-sso-*</code> request headers upstream; your origin trusts the
                        edge. Use when your origin has server-side sessions, or won&apos;t verify
                        tokens itself.</p>
                </WizardPanel>
            </OptionalPanels>
        </>
    );
}
