// Side-effect import: registers <gc-wizard-shell> and <gc-wizard-step> as
// custom elements. The browser upgrades any already-parsed instances of
// those tags automatically when customElements.define() is called.
import '@gcore/wizard-step-kit';
import { connect, WizardError } from '@gcore/fastedge-wizard-sdk';

// The portal appends ?hostOrigin=<its-own-origin> when it opens the wizard.
// connect() validates that the INIT message comes from exactly this origin —
// it rejects anything else. The fallback keeps the dev mock host working
// (which passes hostOrigin itself) and is never reached in a real portal.
const hostOrigin =
    new URLSearchParams(location.search).get('hostOrigin') || 'https://portal.gcore.com';

const shell = document.querySelector('gc-wizard-shell');
const main = document.querySelector('main');
const appNameInput = document.getElementById('app-name');
const templateSelect = document.getElementById('template-select');

// ── Helpers ───────────────────────────────────────────────────────────────────

// shell.setAttribute('error', msg) renders a message above the nav buttons.
// Call with '' or removeAttribute to clear it.
function setError(msg) {
    if (msg) shell.setAttribute('error', msg);
    else shell.removeAttribute('error');
}

// The Next/Finish button is enabled only when the can-advance boolean
// attribute is present on the shell element. Toggle it on every form change.
function updateCanAdvance() {
    const ready = appNameInput.value.trim().length > 0 && templateSelect.value !== '';
    shell.toggleAttribute('can-advance', ready);
    setError('');
}

// Mirror the Configure form values into the Review step before the user sees it.
function populateReview() {
    document.getElementById('review-name').textContent = appNameInput.value.trim();
    const opt = templateSelect.options[templateSelect.selectedIndex];
    document.getElementById('review-template').textContent = opt?.text ?? '—';
}

// ── Entry ─────────────────────────────────────────────────────────────────────

// session is kept in outer scope so the beforeunload handler can call dispose().
let session;

try {
    // connect() performs the MessageChannel handshake with the portal.
    // Must complete before any intent calls — the returned session is the key.
    // Throws WizardError('timeout') if the portal doesn't send INIT within 10 s.
    session = await connect({ expectedHostOrigin: hostOrigin });

    // Read context before revealing the UI. wizard.css scopes token values by
    // the portal's theme class (gc-theme-light / gc-theme-dark) on <body>.
    // If that class isn't applied before the first paint, a brief flash occurs.
    const ctx = await session.context.get();
    document.body.classList.add(ctx.theme);
    main.hidden = false;

    // Fetch templates eagerly — the user needs the list on step 1.
    // This is a read intent (no consent dialog); it resolves immediately.
    const templates = await session.fastedge.templates.list();

    templateSelect.innerHTML = '';
    if (templates.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '— no templates available —';
        templateSelect.appendChild(opt);
    } else {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '— select a template —';
        templateSelect.appendChild(placeholder);
        for (const t of templates) {
            const opt = document.createElement('option');
            opt.value = String(t.id);
            opt.textContent = t.name;
            templateSelect.appendChild(opt);
        }
    }

    updateCanAdvance(); // re-evaluate now that the select is populated

} catch (err) {
    // connect() or templates.list() failed — there is nothing useful to show.
    document.body.innerHTML = `<p class="wizard-error">${err.code ?? 'error'}: ${err.message}</p>`;
}

// ── Form wiring ───────────────────────────────────────────────────────────────

appNameInput.addEventListener('input', updateCanAdvance);
templateSelect.addEventListener('change', updateCanAdvance);

shell.addEventListener('navigated', ({ detail: { to } }) => {
    if (to === 1) {
        // Entering Review: sync the summary and always allow deploying.
        populateReview();
        shell.setAttribute('can-advance', '');
    } else {
        // Returning to Configure: re-evaluate based on form state.
        updateCanAdvance();
    }
});

// ── Deploy ────────────────────────────────────────────────────────────────────

shell.addEventListener('finish', async () => {
    const name = appNameInput.value.trim();
    const templateId = parseInt(templateSelect.value, 10);

    // Disable the button while waiting for the consent dialog.
    shell.removeAttribute('can-advance');
    setError('');

    try {
        // apps.create is a write intent — the portal shows a consent dialog
        // before acting. This call blocks until the user approves or cancels.
        await session.fastedge.apps.create({
            name,
            api_type: 'wasi-http',
            source: { fromTemplateId: templateId },
        });

        // Success — re-enable in case the wizard stays open.
        shell.setAttribute('can-advance', '');

        // TODO: show a success message or signal the portal to close the wizard.

    } catch (err) {
        // user_cancelled means the user clicked Cancel in the portal's consent
        // dialog — it is not an error. Re-enable so they can try again.
        if (err instanceof WizardError && err.code === 'user_cancelled') {
            shell.setAttribute('can-advance', '');
        } else {
            setError(`${err.code ?? 'error'}: ${err.message}`);
        }
    }
});

// ── Cleanup ───────────────────────────────────────────────────────────────────

// Vanilla JS has no component unmount lifecycle. Close the MessageChannel port
// on page unload so the portal can detect the wizard is gone promptly.
// (React wizards handle this in the useEffect cleanup instead.)
window.addEventListener('beforeunload', () => session?.dispose());
