import { useState } from 'react';
import { optional } from '@gcoredev/fastedge-wizard-sdk';
import { ResourceRow } from '@gcore/wizard-step-kit/react';
import { Note } from '../components.jsx';

export function StepStore({ session, f, set }) {
    const [busy, setBusy] = useState(false);
    // One call: the user selects an existing store or creates one inline in the same host modal.
    async function selectStore() {
        setBusy(true);
        try {
            const rs = await optional(() => session.fastedge.stores.pickOrCreate());
            if (rs && rs.length) set({ store: rs[0] });
        } catch (err) {
            console.error('Edge Storage select failed:', err);
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <h2 tabIndex={-1}>Edge Storage for TOTP seeds</h2>
            <p className="totp-lede">
                Per-user TOTP seeds live in Gcore Edge Storage. The app reads seeds at verify time
                and writes them at enrollment.
            </p>
            <Note kind="warn">
                Use a <strong>dedicated</strong> Edge Storage instance — seeds are stored
                plaintext-at-rest, and the API token you add next has write access to everything
                in it.
            </Note>
            <ResourceRow title="Edge Storage"
                sub="Create a new instance or pick an existing one."
                value={f.store ? `${f.store.name} (#${f.store.id})` : undefined}
                set={!!f.store} onClear={() => set({ store: null })}>
                <button onClick={selectStore} disabled={busy}>Select</button>
            </ResourceRow>
        </>
    );
}
