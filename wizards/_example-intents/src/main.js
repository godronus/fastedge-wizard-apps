/**
 * _example-intents — FastEdge wizard intent reference
 *
 * This file is DOCUMENTATION in runnable form. Every v1 write intent in the
 * portal bridge is exercised here with inline comments explaining:
 *   - what the intent does
 *   - whether and why it requires user consent (a portal dialog)
 *   - the ref → id resolution that happens at deployment.apply time
 *   - rollback semantics on partial failure
 *
 * Start here when learning the intent API. Copy patterns from this file into
 * production wizards; don't ship _example-intents itself.
 *
 * Run with: pnpm run dev   (from wizards/_example-intents/)
 * The mock host uses fixtures/fastedge/templates.json for template data and
 * returns launchTemplateId: 1 (wasi-http) + companionTemplateIds: [3] (proxy-wasm)
 * from context.get(), so the full two-app plan can be exercised without live API.
 *
 * Vanilla JS — no framework — so the intent API surface is the star.
 */

import { connect, WizardError } from '@gcore/fastedge-wizard-sdk';

// ── Logging helpers ───────────────────────────────────────────────────────────

const logEl = document.getElementById('log');

function append(msg, cls) {
    const p = document.createElement('p');
    p.textContent = msg;
    if (cls) p.className = cls;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
}

const section = (t) => append(`── ${t} ──`, 'section');
const ok   = (m) => append(`✓ ${m}`, 'ok');
const info = (m) => append(`  ${m}`, 'info');
const warn = (m) => append(`⚠ ${m}`, 'warn');
const fail = (m, e) => append(`✗ ${m}: ${e?.code ?? e?.message ?? e}`, 'fail');

// ── Connect eagerly — must happen at module load, not on button click ─────────
// The host (portal or mock host) sends the INIT message when the iframe's load
// event fires — i.e. right after this module runs. If connect() is deferred to
// a button click the listener is added after INIT is already gone → timeout.
// Call connect() here so the message listener is in place before INIT arrives.
const hostOrigin =
    new URLSearchParams(location.search).get('hostOrigin') || 'https://portal.gcore.com';
const sessionPromise = connect({ expectedHostOrigin: hostOrigin });

// ── Entry point ───────────────────────────────────────────────────────────────

document.getElementById('btn-run').addEventListener('click', async (e) => {
    e.target.disabled = true;
    logEl.innerHTML = '';
    try {
        await demo();
    } catch (err) {
        fail('Unexpected error', err);
    }
    e.target.disabled = false;
});

async function demo() {

    // ── 1. connect() — establish the portal bridge ────────────────────────────
    // connect() was called eagerly at module load (above). Awaiting sessionPromise
    // here just picks up the already-resolved value (or re-surfaces the error).
    // The 10 s timeout runs from when connect() is called — not from DOMContentLoaded
    // — so calling it at module load gives the full window.
    section('1. connect()');

    let session;
    try {
        session = await sessionPromise;
        ok('handshake complete');
    } catch (err) {
        fail('handshake failed', err);
        return;
    }

    // ── 2. context.get() — template identification ────────────────────────────
    // context.get() is the ONLY authoritative way to identify the templates this
    // wizard was launched for. Never hard-code template IDs — they are per-account
    // and not stable across accounts or environments.
    //
    // launchTemplateId: the template whose WIZARD_SOURCE_CONFIG launched this
    //   wizard (template mode). null if opened via app re-entry (app/:id URL).
    // companionTemplateIds: other templates declared in WIZARD_SOURCE_CONFIG
    //   .companionTemplateIds on the launch template. A two-template wizard (e.g.
    //   edge-totp: otp-app + otp-filter) lists the second template here so the
    //   wizard can deploy it without guessing at names or IDs.
    //
    // No consent. No API call. Returns the session context synchronously from the
    // host's memory.
    section('2. context.get() — template identification');

    const ctx = await session.context.get();
    info(`locale: ${ctx.locale}, theme: ${ctx.theme}`);
    info(`launchTemplateId: ${ctx.launchTemplateId}`);
    info(`companionTemplateIds: [${ctx.companionTemplateIds.join(', ')}]`);
    info(`wizardAppId: ${ctx.wizardAppId} (null = template mode, re-deploying)`);

    if (ctx.launchTemplateId === null) {
        warn('No launch template — opened in re-entry mode. This demo requires template mode.');
        return;
    }

    // ── 3. fastedge.templates.read() — fetch param lists ─────────────────────
    // templates.read() returns the full TemplateDetail including params[]. This is
    // the canonical param source for building wizard form fields.
    //
    // Never read params from registry.json — that file exists only in the template
    // source repo and is not available to an external contributor or deployed wizard.
    // The live API is always the source of truth.
    //
    // Read both templates in parallel — they are independent.
    section('3. fastedge.templates.read() — fetch params for both templates');

    const templateIds = [ctx.launchTemplateId, ...ctx.companionTemplateIds];
    let templateDetails;
    try {
        templateDetails = await Promise.all(
            templateIds.map(async (id) => {
                const detail = await session.fastedge.templates.read({ id });
                info(`Template ${id}: ${detail.name} (${detail.api_type}), ${detail.params.length} param(s)`);
                return detail;
            }),
        );
    } catch (err) {
        fail('templates.read failed', err);
        return;
    }

    // Identify wasi-http (main app) and proxy-wasm (CDN filter) by api_type.
    // Both templates are known from context — no name-matching or ID guessing.
    const httpTemplate = templateDetails.find((t) => t.api_type === 'wasi-http');
    const wasmTemplate = templateDetails.find((t) => t.api_type === 'proxy-wasm');

    if (!httpTemplate || !wasmTemplate) {
        warn('Expected one wasi-http and one proxy-wasm template. Check companionTemplateIds.');
        return;
    }
    ok(`wasi-http app: ${httpTemplate.name} (id ${httpTemplate.id})`);
    ok(`proxy-wasm filter: ${wasmTemplate.name} (id ${wasmTemplate.id})`);

    // ── 4. secrets.generateKeypair() — ES256 signing key ─────────────────────
    // generateKeypair generates an ES256 keypair in the trusted portal host context.
    // The PRIVATE key is stored as a portal secret (the user sees it once in a
    // "copy now — never visible again" modal). The PUBLIC key JWK is returned to
    // the wizard and should be stored as a plain env var on the app.
    //
    // This is the asymmetric signing pattern: the wasi-http app signs tokens with
    // the private key (via the secret); the proxy-wasm filter verifies them against
    // the public key (via env). The wizard holds neither key value — only the ref.
    //
    // Consent point: a portal modal opens with the private key value and a "copy
    // now" prompt. WizardError('user_cancelled') if the user dismisses it.
    section('4. secrets.generateKeypair() — ES256 keypair');

    let signingKey = null;
    try {
        signingKey = await session.fastedge.secrets.generateKeypair({
            name: 'example-signing-key',
            comment: 'ES256 private key — example-intents demo',
            algorithm: 'ES256',
        });
        ok(`secret id=${signingKey.id}, name=${signingKey.name}`);
        info(`publicKey (JWK): ${signingKey.publicKey.slice(0, 64)}…`);
        // signingKey.id goes into secretRefs on the http app (private key for signing).
        // signingKey.publicKey goes into env on the proxy-wasm filter (for verification).
    } catch (err) {
        if (err instanceof WizardError && err.code === 'user_cancelled') {
            warn('Keypair cancelled — will skip signing-key env in the plan');
        } else {
            fail('generateKeypair failed', err);
            return;
        }
    }

    // ── 5. secrets.generateRandom() — random HMAC session key ────────────────
    // generateRandom creates a random value of `bytes` bytes and shows it in a portal
    // "copy now" modal before storing it as a secret. Use for HMAC keys, webhook
    // secrets, and other symmetric random values the wizard defines.
    //
    // Contrast with generateKeypair: generateRandom is symmetric (one value, one secret);
    // generateKeypair is asymmetric (private key stored as secret + public key JWK
    // returned to the wizard).
    //
    // The returned ref (id + name) is used in secretRefs or newFastedgeSecrets.
    //
    // Consent point: portal modal. WizardError('user_cancelled') if dismissed.
    section('5. secrets.generateRandom() — random HMAC session key');

    let sessionKeyRef = null;
    try {
        sessionKeyRef = await session.fastedge.secrets.generateRandom({
            name: 'example-session-key',
            comment: 'HMAC session key — example-intents demo',
            bytes: 32,
        });
        ok(`secret id=${sessionKeyRef.id}, name=${sessionKeyRef.name}`);
    } catch (err) {
        if (err instanceof WizardError && err.code === 'user_cancelled') {
            warn('Session key generation cancelled — continuing without it');
        } else {
            fail('secrets.generateRandom failed', err);
            return;
        }
    }

    // Picker intents (not shown interactively in this demo, but documented here):
    //
    // session.fastedge.secrets.pickOrCreate()
    //   Opens the portal's secret picker. The user selects existing secret(s) OR creates
    //   a new one inline in the same modal. Returns Array<{ id, name }>. Use for any secret
    //   the user brings (reuse an existing one, or paste/create a new value).
    //   WizardError('user_cancelled').
    //
    // session.fastedge.stores.pickOrCreate()
    //   Opens the portal's KV store picker. The user selects an existing store OR creates
    //   one inline. Returns Array<{ id, name }>. WizardError('user_cancelled').

    // ── 6. cdn.resources.pick() — select CDN delivery domain ─────────────────
    // cdn.resources.pick opens the portal's CDN resource picker. The user selects
    // the CDN delivery domain (cname) that the wizard will wire apps onto.
    // The returned id is required by deployment.plan when creating CDN origins or
    // rules. Call this before deployment.plan, not after.
    //
    // Consent point: a picker dialog. WizardError('user_cancelled') if dismissed.
    section('6. cdn.resources.pick() — pick CDN delivery domain');

    let cdnResource = null;
    try {
        cdnResource = await session.cdn.resources.pick();
        ok(`CDN resource id=${cdnResource.id}, cname=${cdnResource.cname}`);
    } catch (err) {
        if (err instanceof WizardError && err.code === 'user_cancelled') {
            warn('CDN resource selection cancelled — will skip CDN wiring in the plan');
        } else {
            fail('cdn.resources.pick failed', err);
            return;
        }
    }

    // ── 7. deployment.plan() — dry-run the full deployment ───────────────────
    // deployment.plan validates params (checking template IDs, ref uniqueness,
    // ref cross-references) and resolves template names, but makes no API writes.
    // Returns a planId for deployment.apply.
    //
    // Key shape notes:
    //
    //   fastedgeApps[*].ref — a local label. Used in:
    //     - newCdnOrigins[*].appRef (origin points at this app)
    //     - newCdnRules[*].fastedgeFilter.appRef (filter uses this app)
    //     - apply result: createdFastedgeApps[*].ref (so you can cross-ref created ids)
    //   The ref is never sent to the Gcore API — it is resolved to the real app id
    //   by the host during apply, after the app is created.
    //
    //   newFastedgeSecrets — each is created atomically during apply. The host opens
    //   a portal "Create Secret" modal for each one (the user sets the value). Use
    //   for user-supplied secrets. Created secrets are NOT usable in secretRefs within
    //   the same plan — use secrets.generateRandom/generateKeypair for those.
    //
    //   newFastedgeStores — created atomically during apply. No user interaction.
    //
    //   newCdnOrigins[*].appRef — must match a fastedgeApps[*].ref. Resolved to the
    //   created app id during apply.
    //
    //   newCdnRules[*].originGroupRef — must match a newCdnOrigins[*].ref.
    //   newCdnRules[*].fastedgeFilter.appRef — must match a fastedgeApps[*].ref.
    //   Both are resolved to created resource ids during apply.
    //
    //   cdnResourceId — required when newCdnOrigins or newCdnRules is present.
    //   This is the id from cdn.resources.pick(), not a ref.
    //
    // No consent dialog — planning is non-destructive.
    section('7. deployment.plan() — build the deployment plan');

    const planParams = {
        fastedgeApps: [
            {
                ref: 'http-app',
                name: `example-http-${Date.now()}`,
                api_type: 'wasi-http',
                source: { fromTemplateId: httpTemplate.id },
                env: {
                    // publicKey from generateKeypair bound as a plain env var on the http app.
                    // The proxy-wasm filter reads this to verify JWTs.
                    ...(signingKey ? { PUBLIC_JWK: signingKey.publicKey } : {}),
                },
                ...(signingKey ? { secretRefs: { SIGNING_KEY: signingKey.id } } : {}),
            },
            {
                ref: 'wasm-filter',
                name: `example-filter-${Date.now()}`,
                api_type: 'proxy-wasm',
                source: { fromTemplateId: wasmTemplate.id },
            },
        ],
        // sharedEnv is applied to ALL fastedgeApps after they are created.
        // Use for values that must be identical on every app in the wizard group
        // (e.g. MFA_SESSION_KEY, shared domain prefixes).
        sharedEnv: {
            ACCOUNT_ID: String(ctx.wizardAppId ?? 'demo'),
        },
        // newFastedgeSecrets are created atomically during apply — one portal
        // "Create Secret" modal per entry. The user sets the secret value.
        // These are for user-supplied secrets (API keys, tokens the user already
        // has). Prefer secrets.generateRandom for random values — it shows a generated
        // value in the modal rather than an empty field.
        newFastedgeSecrets: [
            { ref: 'user-api-key', name: 'example-user-api-key' },
        ],
        // newFastedgeStores are created atomically during apply with no modal.
        // name is optional (ref is used as a fallback label).
        //
        // ⚠️  LIMITATION: there is no storeRef substitution in env. A store created
        // here gets an id that doesn't exist yet at plan time, so you cannot wire
        // its id or name into an app's env from the plan. newFastedgeStores is only
        // useful when NO app references the store by id in its env params.
        //
        // If an app has an env param like KV_STORE_ID (typed "string" or "store"):
        //   1. Call stores.pickOrCreate() BEFORE deployment.plan()
        //   2. Inject the returned { id, name } directly into the app's env here
        //   3. Do NOT use newFastedgeStores for that store
        // The shipped edge-totp wizard demonstrates this pattern.
        newFastedgeStores: [
            { ref: 'kv', name: 'example-kv-store', comment: 'KV store — example-intents demo' },
        ],
    };

    // Wire CDN only if the user picked a resource
    if (cdnResource) {
        planParams.cdnResourceId = cdnResource.id;
        planParams.newCdnOrigins = [
            {
                ref: 'http-origin',
                name: 'example-http-origin',
                // appRef points at a fastedgeApps[*].ref above.
                // The host resolves this to the created app's id during apply.
                appRef: 'http-app',
            },
        ];
        planParams.newCdnRules = [
            {
                ref: 'routing-rule',
                name: 'example-route-all',
                rule: '^/',         // regex — matches all paths
                weight: 10,         // lower weight = lower priority (processed last)
                // originGroupRef points at a newCdnOrigins[*].ref.
                // Resolved to the created origin group id during apply.
                originGroupRef: 'http-origin',
            },
            {
                ref: 'filter-rule',
                name: 'example-wasm-filter',
                rule: '^/protected', // only trigger the filter on /protected
                weight: 1,           // higher priority than the routing rule
                // fastedgeFilter attaches the proxy-wasm app as an inline filter on
                // this CDN rule. hook = 'on_request_headers' runs before the request
                // is forwarded to the origin. 'on_response_headers' runs after.
                // interruptOnError: true = fail closed (reject the request if the
                // filter throws). Set false for advisory / logging-only filters.
                fastedgeFilter: {
                    appRef: 'wasm-filter',
                    hook: 'on_request_headers',
                    interruptOnError: true,
                },
            },
        ];
    }

    let plan;
    try {
        plan = await session.deployment.plan(planParams);
        ok(`plan created: planId=${plan.planId}`);
        info(`summary: ${plan.summary}`);
        for (const step of plan.steps) {
            info(`  ${step.action}: ${step.describe}`);
        }
        for (const w of plan.warnings) {
            warn(`  warning: ${w}`);
        }
    } catch (err) {
        fail('deployment.plan failed', err);
        return;
    }

    // ── 8. deployment.apply() — execute the plan ─────────────────────────────
    // deployment.apply shows a single consent dialog (plan.summary) and then
    // executes every step in the plan atomically, streaming progress events.
    //
    // The plan is consumed on first apply — calling apply with the same planId
    // a second time returns WizardError('not_found'). Call deployment.plan again
    // to create a new plan if the user wants to retry after cancellation.
    //
    // Progress events: listen with session.on('deployment.progress', handler).
    // The handler receives { step, total, describe }. Unsubscribe after apply
    // completes (the returned function). Missing unsubscribe → memory leak.
    //
    // Rollback on failure:
    //   If any step fails after resources have already been created, the host
    //   attempts to roll back (delete) what was created so far. The result:
    //     status: 'complete'     — all steps succeeded
    //     status: 'rolled_back'  — a step failed; rollback succeeded
    //     status: 'partial'      — a step failed; rollback itself partially failed
    //   failedStep is set in both non-complete cases.
    //   Note: KV stores are NOT rolled back (deletion is not yet supported).
    //
    // Consent point: portal dialog showing plan.summary. WizardError('user_cancelled')
    // if the user clicks Cancel. The plan is NOT consumed if the user cancels —
    // apply can be retried with the same planId.
    section('8. deployment.apply() — execute');

    const progressLines = [];
    const unsubscribe = session.on('deployment.progress', ({ step, total, describe }) => {
        const msg = `[${step}/${total}] ${describe}`;
        progressLines.push(msg);
        info(msg);
    });

    let applied;
    try {
        applied = await session.deployment.apply({ planId: plan.planId });
    } catch (err) {
        unsubscribe();
        if (err instanceof WizardError && err.code === 'user_cancelled') {
            warn('Apply cancelled — plan is still valid and can be retried');
        } else {
            fail('deployment.apply failed', err);
        }
        return;
    }
    unsubscribe();

    if (applied.status === 'complete') {
        ok(`status: ${applied.status}`);
        for (const app of applied.createdFastedgeApps) {
            ok(`  app: ref=${app.ref}, id=${app.id}`);
            if (app.url) info(`       url=${app.url}`);
        }
        for (const store of (applied.createdFastedgeStores ?? [])) {
            ok(`  KV store: ref=${store.ref}, id=${store.id}, name=${store.name}`);
        }
        for (const origin of (applied.createdCdnOrigins ?? [])) {
            ok(`  CDN origin: ref=${origin.ref}, id=${origin.id}`);
        }
        for (const rule of (applied.createdCdnRules ?? [])) {
            ok(`  CDN rule: ref=${rule.ref}, id=${rule.id}`);
        }
    } else {
        warn(`status: ${applied.status}`);
        if (applied.failedStep) {
            fail(`  failed step: ${applied.failedStep.describe}`, applied.failedStep.error);
        }
    }

    const firstAppId = applied.createdFastedgeApps[0]?.id;
    const allAppIds = applied.createdFastedgeApps.map((a) => a.id);

    // ── 9. fastedge.apps.update() — patch a managed app ─────────────────────
    // apps.update shallow-merges env: existing keys not in the patch are preserved.
    // Only apps in the wizard's managed set can be updated. The managed set is
    // populated automatically when deployment.apply creates apps.
    //
    // Consent point: portal dialog. WizardError('user_cancelled') if dismissed.
    if (applied.status === 'complete' && firstAppId) {
        section('9. fastedge.apps.update() — patch env on first app');
        try {
            const updated = await session.fastedge.apps.update({
                id: firstAppId,
                env: { EXAMPLE_PATCHED: 'true' },
                // name and other fields are optional — omit to leave them unchanged
            });
            ok(`updated: id=${updated.id}, status=${updated.status}`);
        } catch (err) {
            if (err instanceof WizardError && err.code === 'user_cancelled') {
                warn('Update cancelled');
            } else {
                fail('apps.update failed', err);
            }
        }
    }

    // ── 10. fastedge.apps.link() — shared env across multiple apps ───────────
    // apps.link applies a single env patch to multiple managed apps simultaneously
    // in one consent dialog. Use when a shared value must land on every app in the
    // wizard group atomically — e.g. rotating a shared HMAC key or updating a
    // shared endpoint that all apps reference.
    //
    // The patch is shallow-merged on each app (existing keys are preserved).
    // All app ids must be in the managed set.
    //
    // Consent point: portal dialog summarising N apps. WizardError('user_cancelled').
    if (applied.status === 'complete' && allAppIds.length > 1) {
        section('10. fastedge.apps.link() — shared env across all created apps');
        try {
            const linked = await session.fastedge.apps.link({
                appIds: allAppIds,
                sharedEnv: { LINK_TIMESTAMP: String(Date.now()) },
            });
            ok(`linked ${linked.updated.length} app(s): [${linked.updated.join(', ')}]`);
        } catch (err) {
            if (err instanceof WizardError && err.code === 'user_cancelled') {
                warn('Link cancelled');
            } else {
                fail('apps.link failed', err);
            }
        }
    }

    // ── Done ──────────────────────────────────────────────────────────────────
    section('Done — all intent patterns exercised');
    ok('See src/main.js for the documented intent reference.');
    ok('See docs/wizards/intent-catalog.md for the full intent spec.');
}
