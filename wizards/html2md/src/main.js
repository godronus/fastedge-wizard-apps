import { connect, WizardError } from '@gcoredev/fastedge-wizard-sdk';

const hostOrigin = new URLSearchParams(location.search).get('hostOrigin');
const main = document.querySelector('main');
const resourceSummaryEl = document.querySelector('[data-role=resource-summary]');
const statusEl = document.querySelector('[data-role=status]');
const pickButton = document.querySelector('[data-action=pick-resource]');
const deployButton = document.querySelector('[data-action=deploy]');

function setStatus(text) {
    statusEl.textContent = text;
}

try {
    const session = await connect({ expectedHostOrigin: hostOrigin });
    const ctx = await session.context.get();
    main.hidden = false;

    // This template has no companion apps and no params — the wizard only needs the
    // single template it was launched for.
    if (ctx.launchTemplateId === null) {
        setStatus('This wizard must be launched from the html2md template.');
        pickButton.disabled = true;
        throw new Error('no launch template');
    }

    let pickedResource = null;

    pickButton.addEventListener('click', async () => {
        pickButton.disabled = true;
        setStatus('');

        try {
            pickedResource = await session.cdn.resources.pick();
            resourceSummaryEl.textContent = `Target: ${pickedResource.cname}`;
            resourceSummaryEl.hidden = false;
            deployButton.hidden = false;
        } catch (err) {
            if (!(err instanceof WizardError && err.code === 'user_cancelled')) throw err;
        } finally {
            pickButton.disabled = false;
        }
    });

    deployButton.addEventListener('click', async () => {
        if (!pickedResource) return;

        deployButton.disabled = true;
        setStatus('Deploying…');

        const unsubscribe = session.on('deployment.progress', ({ step, total, describe }) => {
            setStatus(`[${step}/${total}] ${describe}`);
        });

        try {
            // Same app on all three handlers — the template's own conversion logic (see its
            // source repo) only does work when the response is HTML and the request asked for
            // Markdown; the other handlers are pass-through unless that condition holds.
            const result = await session.deployment.deploy({
                fastedgeApps: [
                    {
                        ref: 'html2md-filter',
                        name: `html2md-${Date.now()}`,
                        api_type: 'proxy-wasm',
                        source: { fromTemplateId: ctx.launchTemplateId },
                    },
                ],
                cdnResourceId: pickedResource.id,
                cdnResourceFastedgeHandlers: {
                    on_request_headers: { appRef: 'html2md-filter' },
                    on_response_headers: { appRef: 'html2md-filter' },
                    on_response_body: { appRef: 'html2md-filter' },
                },
            });

            if (result.status === 'complete') {
                setStatus(`Done — attached to ${pickedResource.cname}.`);
                pickButton.hidden = true;
                deployButton.hidden = true;
                const closeButton = document.createElement('button');
                closeButton.type = 'button';
                closeButton.textContent = 'Close';
                closeButton.addEventListener('click', () => session.wizard.finish());
                main.appendChild(closeButton);
            } else {
                setStatus(`Deployment ${result.status}${result.failedStep ? `: ${result.failedStep.describe}` : ''}.`);
                deployButton.disabled = false;
            }
        } catch (err) {
            if (err instanceof WizardError && err.code === 'user_cancelled') {
                setStatus('Cancelled.');
            } else {
                setStatus('Deployment failed — see console for details.');
                console.error(err);
            }
            deployButton.disabled = false;
        } finally {
            unsubscribe();
        }
    });
} catch (err) {
    console.error(err);
}
