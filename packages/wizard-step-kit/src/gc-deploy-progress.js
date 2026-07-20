/**
 * <gc-deploy-progress> — display-only panel for a deployment lifecycle.
 *
 * Unlike the shell / row (slot-driven), this element is DATA-driven: it owns all
 * its DOM and renders from a single `state` property. It has no host children and
 * dispatches no events — the wizard drives `session.deployment.deploy()` and feeds
 * the resulting state in.
 *
 * Usage (vanilla):
 *   const el = document.querySelector('gc-deploy-progress');
 *   el.state = { status, plan, progress, result, error };
 *
 * `state` shape (mirrors the SDK deploy lifecycle):
 *   status   : 'idle' | 'planning' | 'applying' | 'done' | 'error'
 *   plan     : DeploymentPlan | null            — { summary, steps[], warnings[] }
 *   progress : DeploymentProgressEvent[]         — [{ step, total, describe }]
 *   result   : DeploymentApplyResult | null      — { status, createdFastedge*, ... }
 *   error    : string | null
 */
const EMPTY = { status: 'idle', plan: null, progress: [], result: null, error: null };

const STATUS_LABEL = { planning: 'Planning…', applying: 'Applying…' };

class GcDeployProgress extends HTMLElement {
    #state = EMPTY;

    set state(v) {
        this.#state = { ...EMPTY, ...(v || {}) };
        if (this.isConnected) this.#render();
    }
    get state() {
        return this.#state;
    }

    connectedCallback() {
        this.#render();
    }

    #render() {
        const { status, plan, progress, result, error } = this.#state;
        this.replaceChildren(); // element owns all its DOM — no host children to preserve

        const label = STATUS_LABEL[status];
        if (label) this.append(mk('div', 'wizard-deploy-status', label));

        if (plan) {
            const box = mk('div', 'wizard-deploy-plan');
            box.append(mk('div', 'wizard-deploy-summary', `Plan: ${plan.summary}`));
            if (plan.steps?.length) {
                const ul = mk('ul', 'wizard-deploy-steps');
                plan.steps.forEach(s => ul.append(mk('li', null, s.describe)));
                box.append(ul);
            }
            (plan.warnings || []).forEach(w =>
                box.append(mk('div', 'wizard-deploy-warning', `⚠ ${w}`))
            );
            this.append(box);
        }

        (progress || []).forEach(p =>
            this.append(mk('div', 'wizard-deploy-progress-line', `[${p.step}/${p.total}] ${p.describe}`))
        );

        if (error) this.append(mk('div', 'wizard-deploy-error', `Deploy failed: ${error}`));

        if (result) {
            // status can be 'rolled_back' — kebab it so the CSS class stays lint-clean
            const variant = String(result.status).replace(/_/g, '-');
            const box = mk('div', `wizard-deploy-result wizard-deploy-result--${variant}`);
            box.append(mk('strong', null, `Status: ${result.status}`));
            if (result.failedStep) {
                box.append(mk('div', 'wizard-deploy-error',
                    `Failed at: ${result.failedStep.describe} — ${result.failedStep.error}`));
            }
            const ul = mk('ul', 'wizard-deploy-created');
            (result.createdFastedgeApps || []).forEach(a =>
                ul.append(mk('li', null, `${a.ref}: app #${a.id}${a.url ? ` → ${a.url}` : ''}`))
            );
            appendCreated(ul, result.createdFastedgeStores, 'store');
            appendCreated(ul, result.createdCdnOrigins, 'CDN origin');
            appendCreated(ul, result.createdCdnRules, 'CDN rule');
            if (ul.children.length) box.append(ul);
            this.append(box);
        }
    }
}

function mk(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
}

function appendCreated(ul, items, noun) {
    (items || []).forEach(r =>
        ul.append(mk('li', null, `${r.ref}: ${noun} #${r.id}${r.name ? ` (${r.name})` : ''}`))
    );
}

customElements.define('gc-deploy-progress', GcDeployProgress);
