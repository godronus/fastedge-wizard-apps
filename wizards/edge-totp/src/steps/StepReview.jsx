import { DeployProgress } from '@gcore/wizard-step-kit/react';

export function StepReview({ f, deploy, filterT, appT }) {
    const d = deploy.state;
    return (
        <>
            <h2 tabIndex={-1}>Review &amp; deploy</h2>
            <dl className="totp-summary">
                <dt>CDN resource</dt><dd>{f.cdn?.cname} (#{f.cdn?.id})</dd>
                <dt>Apps</dt><dd>{f.name}-filter ({filterT?.name}) + {f.name}-app ({appT?.name})</dd>
                <dt>Auth prefix</dt><dd>{f.authPrefix}</dd>
                <dt>MFA audience</dt><dd>{f.audience}</dd>
                <dt>Session cookie</dt><dd>{f.cookie}{f.issuer ? ` · issuer ${f.issuer}` : ''}</dd>
                <dt>Edge Storage</dt><dd>{f.store?.name} (#{f.store?.id})</dd>
                <dt>Secrets</dt><dd>session key, handoff key, enroll key, Gcore API token{f.profile === 'B' ? ', ES256 proof key' : ''}</dd>
                <dt>Profile</dt><dd>{f.profile === 'B' ? 'B — origin verifies ES256 proof' : 'A — edge enforces'}</dd>
                {f.profile === 'B' && f.proofTtl !== '90' && <><dt>Proof TTL</dt><dd>{f.proofTtl}s</dd></>}
                {f.profile === 'B' && f.proofCookie !== 'mfa_proof' && <><dt>Proof cookie</dt><dd>{f.proofCookie}</dd></>}
                {f.totpMode === 'custom' && <>
                    <dt>TOTP issuer</dt><dd>{f.totpIssuer}</dd>
                    <dt>TOTP config</dt><dd>{f.totpDigits} digits · {f.totpPeriod}s · {f.totpAlgo} · ±{f.totpDrift} steps</dd>
                </>}
                {f.policyMode === 'custom' && <>
                    <dt>Session TTL</dt><dd>{f.sessionTtl}s</dd>
                    <dt>Max attempts</dt><dd>{f.maxAttempts}</dd>
                    <dt>Ticket TTL</dt><dd>{f.ticketTtl}s</dd>
                    <dt>Storage key prefix</dt><dd>{f.kvPrefix}</dd>
                    <dt>Self-enrollment</dt><dd>{f.selfEnroll}</dd>
                    {f.gcoreApiUrl !== 'https://api.gcore.com' && <><dt>Gcore API URL</dt><dd>{f.gcoreApiUrl}</dd></>}
                </>}
                {f.brandMode === 'custom' && <>
                    <dt>Branding</dt><dd>{f.brandName || '(no name)'}{f.brandLogo ? ' · logo set' : ''}{f.brandFavicon ? ' · favicon set' : ''}</dd>
                    {f.brandColor !== '#0066cc' && <><dt>Button color</dt><dd>{f.brandColor}</dd></>}
                </>}
            </dl>
            <p className="totp-lede">Click <strong>Deploy</strong> to plan and apply. You will be
                asked to confirm the plan in a portal dialog.</p>

            <DeployProgress state={d} />

            {d.result?.status === 'complete' && f.profile === 'B' &&
                <p className="totp-lede">Next: publish the JWKS at <code>{f.authPrefix}/.well-known/jwks.json</code> to your origin.</p>}
        </>
    );
}
