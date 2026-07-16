import { connect } from '@gcore/fastedge-wizard-sdk';

const hostOrigin =
    new URLSearchParams(location.search).get('hostOrigin') || 'https://portal.gcore.com';

let session = null;
let createdAppId = null;
let currentPlanId = null;

// ── UI helpers ──────────────────────────────────────────────────────────────

function icon(n, v) {
    document.getElementById(`i${n}`).textContent = v;
}

function result(n, text, cls) {
    const el = document.getElementById(`r${n}`);
    el.textContent = text;
    el.className = cls ?? '';
}

function enable(id) {
    document.getElementById(id).disabled = false;
}

function setLoading(btnId, loading, label) {
    const btn = document.getElementById(btnId);
    btn.disabled = loading;
    if (loading) btn.dataset.orig = btn.textContent;
    btn.textContent = loading ? `${label ?? btn.dataset.orig} …` : btn.dataset.orig;
}

function addOption(selectId, value, label) {
    const sel = document.getElementById(selectId);
    const opt = document.createElement('option');
    opt.value = String(value);
    opt.textContent = label;
    sel.appendChild(opt);
}

function resetSelect(selectId, placeholder) {
    const sel = document.getElementById(selectId);
    sel.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = placeholder;
    sel.appendChild(ph);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    // Step 1: Handshake
    try {
        session = await connect({ expectedHostOrigin: hostOrigin });
        icon(1, '✅');
        result(1, 'connected', 'pass');
    } catch (err) {
        icon(1, '❌');
        result(1, `${err.code}: ${err.message}`, 'fail');
        return;
    }

    // Steps 2 + 4 auto-run in parallel (independent reads)
    await Promise.all([runSecretsListAuto(), runTemplatesListAuto()]);

    enable('btn-create-secret');
    enable('btn-create-app');
    enable('btn-plan');
}

async function runSecretsListAuto() {
    icon(2, '⏳');
    try {
        const secrets = await session.fastedge.secrets.list();
        icon(2, '✅');
        result(2, JSON.stringify(secrets, null, 2), 'pass');
        resetSelect('secret-id-select', '— none —');
        for (const s of secrets) {
            addOption('secret-id-select', s.id, `${s.id}: ${s.name}${s.app_count != null ? ` (${s.app_count} apps)` : ''}`);
        }
    } catch (err) {
        icon(2, '❌');
        result(2, `${err.code}: ${err.message}`, 'fail');
    }
}

function updatePlanTextarea(templateId) {
    if (!templateId) return;
    const ta = document.getElementById('plan-apps-json');
    ta.value = JSON.stringify(
        [
            {
                ref: 'app-1',
                name: `smoke-plan-${templateId}`,
                source: { fromTemplateId: Number(templateId) },
                env: { PLAN_KEY: 'plan_value' },
            },
        ],
        null,
        2,
    );
}

async function runTemplatesListAuto() {
    icon(4, '⏳');
    try {
        const templates = await session.fastedge.templates.list();
        icon(4, '✅');
        result(
            4,
            templates.map((t) => `${t.id}: ${t.name} (${t.api_type})`).join('\n') || '(none)',
            'pass',
        );
        resetSelect('template-select', templates.length ? '— pick a template —' : '— none available —');
        for (const t of templates) {
            addOption('template-select', t.id, `${t.id}: ${t.name} (${t.api_type})`);
        }
        if (templates.length) {
            document.getElementById('template-select').value = String(templates[0].id);
            updatePlanTextarea(templates[0].id);
        }
    } catch (err) {
        icon(4, '❌');
        result(4, `${err.code}: ${err.message}`, 'fail');
    }
}

// Step 3: fastedge.secrets.create
document.getElementById('btn-create-secret').addEventListener('click', async () => {
    const nameHint = document.getElementById('secret-name-hint').value.trim() || 'smoke-test-secret';
    setLoading('btn-create-secret', true, 'Waiting for modal');
    icon(3, '⏳');
    try {
        const ref = await session.fastedge.secrets.create({ name: nameHint, comment: 'smoke-test write-intents' });
        icon(3, '✅');
        result(3, JSON.stringify(ref, null, 2), 'pass');
        addOption('secret-id-select', ref.id, `${ref.id}: ${ref.name} ← just created`);
        document.getElementById('secret-id-select').value = String(ref.id);
    } catch (err) {
        icon(3, err.code === 'user_cancelled' ? '🚫' : '❌');
        result(3, `${err.code}: ${err.message}`, err.code === 'user_cancelled' ? 'cancelled' : 'fail');
    } finally {
        setLoading('btn-create-secret', false);
    }
});

// Step 5: fastedge.apps.create
document.getElementById('btn-create-app').addEventListener('click', async () => {
    const name = document.getElementById('app-name').value.trim() || `smoke-test-${Date.now()}`;
    const templateId = parseInt(document.getElementById('template-select').value);
    const secretKey = document.getElementById('secret-env-key').value.trim();
    const secretId = parseInt(document.getElementById('secret-id-select').value);

    if (!templateId) {
        result(5, 'Pick a template first (Step 4).', 'fail');
        return;
    }

    const params = {
        name,
        api_type: 'wasi-http',
        source: { fromTemplateId: templateId },
    };
    if (secretKey && secretId) {
        params.secretRefs = { [secretKey]: secretId };
    }

    setLoading('btn-create-app', true, 'Waiting for consent');
    icon(5, '⏳');
    result(5, `Waiting for host consent…\n\n${JSON.stringify(params, null, 2)}`);
    try {
        const created = await session.fastedge.apps.create(params);
        createdAppId = created.id;
        icon(5, '✅');
        result(5, JSON.stringify(created, null, 2), 'pass');
        enable('btn-apps-list');
        enable('btn-apps-get');
        enable('btn-apps-update');
    } catch (err) {
        icon(5, err.code === 'user_cancelled' ? '🚫' : '❌');
        result(5, `${err.code}: ${err.message}`, err.code === 'user_cancelled' ? 'cancelled' : 'fail');
    } finally {
        setLoading('btn-create-app', false);
    }
});

// Step 6: fastedge.apps.list
document.getElementById('btn-apps-list').addEventListener('click', async () => {
    setLoading('btn-apps-list', true);
    icon(6, '⏳');
    try {
        const apps = await session.fastedge.apps.list();
        icon(6, '✅');
        result(6, JSON.stringify(apps, null, 2), 'pass');
    } catch (err) {
        icon(6, '❌');
        result(6, `${err.code}: ${err.message}`, 'fail');
    } finally {
        setLoading('btn-apps-list', false);
    }
});

// Step 7: fastedge.apps.get
document.getElementById('btn-apps-get').addEventListener('click', async () => {
    if (!createdAppId) {
        result(7, 'No created app id — run Step 5 first.', 'fail');
        return;
    }
    setLoading('btn-apps-get', true);
    icon(7, '⏳');
    try {
        const detail = await session.fastedge.apps.get({ id: createdAppId });
        icon(7, '✅');
        result(7, JSON.stringify(detail, null, 2), 'pass');
    } catch (err) {
        icon(7, '❌');
        result(7, `${err.code}: ${err.message}`, 'fail');
    } finally {
        setLoading('btn-apps-get', false);
    }
});

// Step 8: fastedge.apps.update
document.getElementById('btn-apps-update').addEventListener('click', async () => {
    if (!createdAppId) {
        result(8, 'No created app id — run Step 5 first.', 'fail');
        return;
    }

    let envPatch;
    try {
        const raw = document.getElementById('update-env').value.trim();
        envPatch = raw ? JSON.parse(raw) : undefined;
    } catch {
        result(8, 'Invalid JSON in env patch field.', 'fail');
        return;
    }

    const newName = document.getElementById('update-name').value.trim() || undefined;
    const params = { id: createdAppId };
    if (newName) params.name = newName;
    if (envPatch && Object.keys(envPatch).length) params.env = envPatch;

    setLoading('btn-apps-update', true, 'Waiting for consent');
    icon(8, '⏳');
    result(8, `Waiting for host consent…\n\n${JSON.stringify(params, null, 2)}`);
    try {
        const updated = await session.fastedge.apps.update(params);
        icon(8, '✅');
        result(8, JSON.stringify(updated, null, 2), 'pass');
    } catch (err) {
        icon(8, err.code === 'user_cancelled' ? '🚫' : '❌');
        result(8, `${err.code}: ${err.message}`, err.code === 'user_cancelled' ? 'cancelled' : 'fail');
    } finally {
        setLoading('btn-apps-update', false);
    }
});

// Auto-update plan textarea when template selection changes
document.getElementById('template-select').addEventListener('change', (e) => {
    updatePlanTextarea(e.target.value);
});

// Step 9: deployment.plan
document.getElementById('btn-plan').addEventListener('click', async () => {
    let apps;
    try {
        apps = JSON.parse(document.getElementById('plan-apps-json').value);
    } catch {
        result(9, 'Invalid JSON in apps field.', 'fail');
        return;
    }

    let sharedEnv;
    const sharedEnvRaw = document.getElementById('plan-shared-env').value.trim();
    if (sharedEnvRaw) {
        try {
            sharedEnv = JSON.parse(sharedEnvRaw);
        } catch {
            result(9, 'Invalid JSON in sharedEnv field.', 'fail');
            return;
        }
    }

    setLoading('btn-plan', true, 'Planning');
    icon(9, '⏳');
    result(9, 'Validating plan…');
    try {
        const params = { apps, ...(sharedEnv ? { sharedEnv } : {}) };
        const plan = await session.deployment.plan(params);
        currentPlanId = plan.planId;
        icon(9, '✅');
        result(9, JSON.stringify(plan, null, 2), 'pass');
        enable('btn-apply');
    } catch (err) {
        icon(9, '❌');
        result(9, `${err.code}: ${err.message}`, 'fail');
    } finally {
        setLoading('btn-plan', false);
    }
});

// Step 10: deployment.apply
document.getElementById('btn-apply').addEventListener('click', async () => {
    if (!currentPlanId) {
        result(10, 'No plan id — run Step 9 first.', 'fail');
        return;
    }

    const progressLog = document.getElementById('progress-log');
    progressLog.textContent = '';

    const unsubscribe = session.on('deployment.progress', (payload) => {
        const { step, total, describe } = payload;
        progressLog.textContent += `[${step}/${total}] ${describe}\n`;
    });

    setLoading('btn-apply', true, 'Waiting for consent');
    icon(10, '⏳');
    result(10, 'Waiting for host consent…');
    try {
        const applied = await session.deployment.apply({ planId: currentPlanId });
        icon(10, applied.status === 'complete' ? '✅' : '⚠️');
        result(10, JSON.stringify(applied, null, 2), applied.status === 'complete' ? 'pass' : 'fail');
        currentPlanId = null;
        document.getElementById('btn-apply').disabled = true;
    } catch (err) {
        icon(10, err.code === 'user_cancelled' ? '🚫' : '❌');
        result(10, `${err.code}: ${err.message}`, err.code === 'user_cancelled' ? 'cancelled' : 'fail');
    } finally {
        unsubscribe();
        setLoading('btn-apply', false);
    }
});

main();
