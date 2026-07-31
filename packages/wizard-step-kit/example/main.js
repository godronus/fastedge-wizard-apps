import '../src/gc-wizard-shell.js';
import '../src/gc-optional-panels.js';
import '../src/gc-resource-row.js';
import '../src/gc-deploy-progress.js';

function log(id, msg) {
    const pre = document.getElementById(id);
    if (pre) pre.textContent = msg;
}

const shell = document.getElementById('demo-shell');
shell.addEventListener('navigate',  e => log('shell-log', `navigate: step ${e.detail.from} → ${e.detail.to} (${e.detail.reason})`));
shell.addEventListener('navigated', e => log('shell-log', `navigated: now on step ${e.detail.to}`));
shell.addEventListener('finish',    () => log('shell-log', 'finish fired'));
shell.addEventListener('cancel',    () => log('shell-log', 'cancel fired'));

document.getElementById('demo-panels').addEventListener('selection-change', e =>
    log('panels-log', `selected: ${JSON.stringify(e.detail.selected)}`)
);
document.getElementById('demo-multi').addEventListener('selection-change', e =>
    log('multi-log', `selected: ${JSON.stringify(e.detail.selected)}`)
);

document.getElementById('demo-row-set').addEventListener('clear', () =>
    log('row-log', 'clear fired on the KV store row')
);

// Simulated deploy: steps the panel through plan → progress → complete, so the
// element is exercised in the built example (the package's runnable check).
document.getElementById('btn-deploy').addEventListener('click', () => {
    const el = document.getElementById('demo-deploy');
    el.state = {
        status: 'applying',
        plan: {
            planId: 'demo',
            summary: '2 apps, 1 CDN origin, 2 rules',
            steps: [
                { action: 'fastedge.apps.create', describe: 'Create app totp-filter' },
                { action: 'fastedge.apps.create', describe: 'Create app totp-app' },
                { action: 'cdn.rules.create', describe: 'Route /auth/totp to the app' },
            ],
            warnings: ['MFA_AUDIENCE not set on the filter — Profile B will fail closed'],
        },
        progress: [
            { step: 1, total: 3, describe: 'Created totp-filter' },
            { step: 2, total: 3, describe: 'Created totp-app' },
        ],
        result: {
            status: 'complete',
            createdFastedgeApps: [
                { ref: 'filter', id: 101, url: 'https://totp-filter.example' },
                { ref: 'app', id: 102, url: 'https://totp-app.example' },
            ],
        },
    };
});

document.getElementById('btn-theme').addEventListener('click', () => {
    document.body.classList.toggle('gc-theme-light');
    document.body.classList.toggle('gc-theme-dark');
});
