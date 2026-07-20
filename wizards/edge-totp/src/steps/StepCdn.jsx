import { useState } from 'react';
import { optional } from '@gcore/fastedge-wizard-sdk';
import { ResourceRow } from '@gcore/wizard-step-kit/react';

export function StepCdn({ session, f, set }) {
    const [busy, setBusy] = useState(false);
    async function pick() {
        setBusy(true);
        const r = await optional(() => session.cdn.resources.pick());
        setBusy(false);
        if (r) {
            const derived = f.cdn ? `https://${f.cdn.cname}` : '';
            const audience = (!f.audience || f.audience === derived) ? `https://${r.cname}` : f.audience;
            const issuer = (!f.issuer || f.issuer === derived) ? `https://${r.cname}` : f.issuer;
            set({ cdn: r, audience, issuer });
        }
    }
    return (
        <>
            <h2 tabIndex={-1}>Choose the CDN resource to protect</h2>
            <p className="totp-lede">
                Pick the CDN delivery domain that fronts the site you are protecting. Both apps
                are wired onto this one resource.
            </p>
            <ResourceRow title={f.cdn ? f.cdn.cname : 'No CDN resource selected'}
                sub={f.cdn ? `resource #${f.cdn.id}` : 'The filter and origin both attach here.'}
                set={!!f.cdn}
                onClear={() => {
                    const derived = `https://${f.cdn.cname}`;
                    set({
                        cdn: null,
                        audience: f.audience === derived ? '' : f.audience,
                        issuer: f.issuer === derived ? '' : f.issuer,
                    });
                }}>
                <button onClick={pick} disabled={busy}>Select resource</button>
            </ResourceRow>
        </>
    );
}
