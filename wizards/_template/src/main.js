import { connect, WizardError } from '@gcore/fastedge-wizard-sdk';

const hostOrigin = new URLSearchParams(location.search).get('hostOrigin');
const main = document.querySelector('main');

try {
    const session = await connect({ expectedHostOrigin: hostOrigin });
    await session.context.get();
    main.hidden = false;

    document.querySelector('[data-action=submit]').addEventListener('click', async () => {
        try {
            await session.fastedge.apps.create({
                /* TODO: fill in name, api_type, source, env */
            });
        } catch (err) {
            if (!(err instanceof WizardError && err.code === 'user_cancelled')) throw err;
        }
    });
} catch (err) {
    console.error(err);
}
