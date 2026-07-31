/**
 * <gc-resource-row> — a managed-resource / picker row: title + sub on the left,
 * host-supplied action controls in the middle, a "set / not set" status badge
 * (with optional clear button) on the right. Maps to "pick or create a
 * secret / store / CDN resource" flows.
 *
 * Usage:
 *   <gc-resource-row title="Session key" sub="HS256, shared" set clearable>
 *     <button>Generate</button>
 *   </gc-resource-row>
 *
 * Attributes:
 *   title        (string)  — row title
 *   sub          (string)  — secondary line under the title
 *   set          (boolean) — resource is set → badge reads label-set, styled "success"
 *   clearable    (boolean) — show a clear (×) button in the badge while set
 *   label-set    (string, default "set")
 *   label-unset  (string, default "not set")
 *   label-clear  (string, default "Clear") — aria-label for the × button
 *
 * Events (bubble):
 *   clear — the × button was clicked
 *
 * Like the other kit elements, the row builds its own chrome (title/sub/badge)
 * but never touches the host-supplied action children — they stay as direct
 * children between the prepended main block and the appended badge, so a
 * framework keeps DOM ownership. ("Host owns truth, element owns choreography".)
 */
class GcResourceRow extends HTMLElement {
    static observedAttributes = ['title', 'sub', 'set', 'clearable', 'label-set', 'label-unset', 'label-clear'];

    #main = null;
    #titleEl = null;
    #subEl = null;
    #badge = null;

    connectedCallback() {
        if (!this.#main) this.#build();
        else this.#update();
    }

    attributeChangedCallback() {
        if (this.#main) this.#update();
    }

    #build() {
        this.classList.add('wizard-row');

        // Left: element-owned title + sub, prepended before the host's actions.
        this.#main = document.createElement('div');
        this.#main.className = 'wizard-row-main';
        this.#titleEl = document.createElement('div');
        this.#titleEl.className = 'wizard-row-title';
        this.#subEl = document.createElement('div');
        this.#subEl.className = 'wizard-row-sub';
        this.#main.append(this.#titleEl, this.#subEl);

        // Right: element-owned status badge, appended after the host's actions.
        this.#badge = document.createElement('span');
        this.#badge.className = 'wizard-row-badge';

        this.prepend(this.#main);
        this.append(this.#badge);
        this.#update();
    }

    #update() {
        this.#titleEl.textContent = this.getAttribute('title') || '';
        const sub = this.getAttribute('sub');
        this.#subEl.textContent = sub || '';
        this.#subEl.hidden = !sub;

        const isSet = this.hasAttribute('set');
        this.#badge.classList.toggle('wizard-row-badge--set', isSet);
        this.#badge.textContent = isSet
            ? (this.getAttribute('label-set') || 'set')
            : (this.getAttribute('label-unset') || 'not set');

        if (isSet && this.hasAttribute('clearable')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wizard-row-clear';
            btn.textContent = '×';
            btn.setAttribute('aria-label', this.getAttribute('label-clear') || 'Clear');
            btn.addEventListener('click', () =>
                this.dispatchEvent(new CustomEvent('clear', { bubbles: true }))
            );
            this.#badge.append(btn);
        }
    }
}

customElements.define('gc-resource-row', GcResourceRow);
