import { Note, Field } from '../components.jsx';

export function StepRouting({ f, set }) {
    return (
        <>
            <h2 tabIndex={-1}>Routing &amp; token binding</h2>
            <p className="totp-lede">
                These values must be <strong>identical</strong> on both apps — the wizard binds them once to both.
            </p>
            <Field
                label="Auth path prefix"
                value={f.authPrefix}
                onChange={(v) => set({ authPrefix: v })}
                hint="Where the challenge/verify app is mounted. The CDN path rule and the filter bypass both use this. Default: /auth/totp"
            />
            <Field
                label="MFA audience (required)"
                value={f.audience}
                onChange={(v) => set({ audience: v })}
                placeholder="https://app.example.com"
                hint="The aud claim baked into the session token. The filter refuses every session unless this is set and matches."
            />
            <Note kind="danger">
                <strong>Fail-closed:</strong> the audience is marked optional on the app but is mandatory on the filter.
                Leaving it blank makes the filter reject <em>all</em> traffic. Use the protected site's public URL.
            </Note>
            <Field
                label="Session cookie name"
                value={f.cookie}
                onChange={(v) => set({ cookie: v })}
                hint="Change only if mfa_session collides with an existing cookie. Default: mfa_session"
            />
            <Field
                label="Issuer (optional)"
                value={f.issuer}
                onChange={(v) => set({ issuer: v })}
                hint="Extra iss check. If set, it is applied to both apps. Leave blank to skip."
            />
            <Field
                label="Login URL (optional, filter only)"
                value={f.loginUrl}
                onChange={(v) => set({ loginUrl: v })}
                placeholder="https://app.example.com/login/mfa"
                hint="Where the filter redirects unauthenticated users. Blank → the filter returns 401 instead (useful for APIs)."
            />
        </>
    );
}
