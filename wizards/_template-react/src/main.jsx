import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { connect } from '@gcore/fastedge-wizard-sdk';
import '@gcore/wizard-step-kit'; // side-effect: registers <gc-wizard-shell> and <gc-optional-panels>
import { WizardShell, WizardStep } from '@gcore/wizard-step-kit/react';

// The portal passes hostOrigin as a query param; fall back to the real portal
// for production safety (though in production the proxy sets it via HELLO).
const hostOrigin =
    new URLSearchParams(location.search).get('hostOrigin') || 'https://portal.gcore.com';

// ── Step content ─────────────────────────────────────────────────────────────
// Replace these with your wizard's real steps.
// The WizardShell handles navigation, indicator, and Back/Next/Finish buttons.

function StepConfigure({ ctx }) {
    return (
        <>
            <h2>Configure</h2>
            <p>Wizard is running in <strong>{ctx.theme}</strong> theme, locale <strong>{ctx.locale}</strong>.</p>
            <label>
                Name
                <input type="text" defaultValue="my-app" />
            </label>
        </>
    );
}

function StepReview() {
    return (
        <>
            <h2>Review &amp; deploy</h2>
            <p>Check your settings, then click <strong>Deploy</strong>.</p>
        </>
    );
}

// ── Wizard root ───────────────────────────────────────────────────────────────

function Wizard({ ctx }) {
    // Wire setCanAdvance to your per-step validation:
    //   setCanAdvance(formIsValid);
    const [canAdvance, setCanAdvance] = useState(true);
    void setCanAdvance; // remove when you add real validation

    function handleFinish() {
        // Replace with your deployment logic, e.g.:
        // await session.deployment.apply({ planId });
    }

    function handleCancel() {
        // Wizard was cancelled — nothing to clean up in this template.
    }

    return (
        <WizardShell
            canAdvance={canAdvance}
            labels={{ finish: 'Deploy' }}
            onFinish={handleFinish}
            onCancel={handleCancel}
        >
            <WizardStep title="Configure">
                <StepConfigure ctx={ctx} />
            </WizardStep>
            <WizardStep title="Review">
                <StepReview />
            </WizardStep>
        </WizardShell>
    );
}

// ── App entry ────────────────────────────────────────────────────────────────

function App() {
    const [state, setState] = useState({ status: 'connecting' });

    useEffect(() => {
        let session;
        (async () => {
            try {
                session = await connect({ expectedHostOrigin: hostOrigin });

                // SDK applies theme and locale during connect() — no wizard code needed.
                const ctx = await session.context.get();
                document.getElementById('root').hidden = false;

                setState({ status: 'ready', session, ctx });
            } catch (err) {
                setState({ status: 'error', error: `${err.code ?? 'error'}: ${err.message}` });
            }
        })();

        return () => session?.dispose();
    }, []);

    if (state.status === 'connecting') return <p>Connecting…</p>;
    if (state.status === 'error') return <p className="wizard-error">{state.error}</p>;
    // Pass session to Wizard when your steps need to call session.fastedge.* etc.
    return <Wizard ctx={state.ctx} />;
}

createRoot(document.getElementById('root')).render(<App />);
