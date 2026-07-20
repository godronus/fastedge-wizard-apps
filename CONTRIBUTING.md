# Contributing a Wizard

Wizards are plain HTML + JavaScript apps that run inside the Gcore portal via an iframe bridge. This guide covers building one and getting it merged.

---

## How it works

Your wizard lives at `wizards/<name>/`, builds to `dist/`, and gets published to the `gh-pages` branch by CI. jsDelivr serves the built output. The FastEdge portal proxies it through a hardened WASM app that enforces CSP and re-serves it under a fixed origin.

After a wizard merges, the Gcore team creates a FastEdge template that points to it via `WIZARD_SOURCE_CONFIG`. That's the step that makes it available in the portal — merging alone does not.

---

## Prerequisites

- Node.js 20+
- Any package manager (pnpm, npm, yarn, bun — your choice)
- Git

---

## 1. Fork and clone

```bash
# Fork G-Core/FastEdge-Wizard-apps on GitHub, then:
git clone https://github.com/<your-org>/FastEdge-Wizard-apps
cd FastEdge-Wizard-apps
```

---

## 2. Create your wizard

Copy `_template` as a starting point:

```bash
cp -r wizards/_template wizards/<your-wizard-name>
cd wizards/<your-wizard-name>
```

Edit `package.json` — set `"name"` and update the SDK pin to the latest tag (check `context/INDEX.md` for the current tag):

```json
{
  "name": "your-wizard-name",
  "dependencies": {
    "@gcore/fastedge-wizard-sdk": "github:G-Core/fastedge-wizard-sdk#<latest-tag>"
  }
}
```

Install and run the mock host:

```bash
pnpm install    # or npm install / yarn / bun
pnpm run dev    # builds and starts mock host at http://localhost:9999
```

Open http://localhost:9999 — you get a browser dev-tools-style panel next to your wizard that simulates the portal bridge. Approve/deny write-intent consent dialogs, toggle light/dark theme, and watch the event log.

**Fixture data** (optional): create a `fixtures/` directory next to `src/` with `templates.json`, `apps.json`, and/or `secrets.json` to pre-populate the mock host stubs with realistic data. The SDK validates these against its schemas on startup.

---

## 3. Build and design rules

### CSS — no raw values

Use `var(--gc-*)` design tokens everywhere. Raw colour literals, px font-sizes, and hardcoded spacing values fail the CI lint gate:

```css
/* ✗ fails */
color: #333;
background: rgb(255, 0, 0);

/* ✓ passes */
color: var(--gc-font-color);
background: var(--gc-background-primary-color);
```

The token reference is in `context/INDEX.md`. Tokens are provided at runtime via
`/styles/v1/wizard.css` — injected automatically, no `<link>` required in your HTML.

### HTML — classless first

The portal injects `/styles/v1/wizard.css` into every wizard HTML response (both
in production via the WASM proxy and locally via the dev server). It styles bare
semantic elements — `<button>`, `<input>`, `<h1>`, `<label>`, etc. — so plain HTML
looks like the portal with zero classes. **You do not need any explicit `<link>` tag
for base styles in your `index.html`.**

Write semantic HTML; add classes only for genuine variants:

```html
<!-- ✗ avoid -->
<button class="gc-btn gc-btn--primary">Submit</button>

<!-- ✓ prefer -->
<button>Submit</button>
```

Your `styles.css` should contain only wizard-specific layout and variant classes —
not resets, body styles, or element base styles that are already in the shared base.

### Frameworks

You may use a rendering framework (React, Vue, Svelte, etc.) as long as you style
with semantic HTML and plain CSS files using `var(--gc-*)` tokens.

**Bring-your-own UI libraries (MUI, Ant Design, shadcn, Tailwind, etc.) are not
allowed.** They ship their own styles that override the shared base and bypass the
token enforcement gates.

Framework-based wizards are reviewed against the same screenshot baseline — if it
looks foreign, the diff fails.

### Security

The WASM proxy enforces `connect-src 'none'` — your wizard cannot make any network requests. All data comes through the bridge:

```js
const session = await connect({ expectedHostOrigin: hostOrigin });
const templates = await session.fastedge.templates.list();
```

No `fetch()`, no `XMLHttpRequest`, no WebSocket.

---

## 4. Before opening a PR

Run these from the repo root:

```bash
pnpm -w run lint:css     # must pass — no raw colours
pnpm run build           # must pass — wizard builds cleanly
```

Check your wizard in both themes (the mock host has a "Switch to dark" button). Check at 1280×800 and a narrower viewport.

Make sure you have committed:
- `src/` — your source files
- `package.json` and your lockfile (`pnpm-lock.yaml`, `package-lock.json`, etc.)
- `pnpm-workspace.yaml` (if using pnpm — required for isolated install)
- `fixtures/` (optional but recommended)

**Do not commit** `dist/` or `node_modules/` — CI builds from source.

---

## 5. Open a PR

Target `main`. In the description include:

- What the wizard does (one paragraph)
- Which FastEdge template it is intended for
- Any non-obvious decisions in the implementation

CI runs two checks on the PR:
- **Stylelint** — no raw colour literals
- **Screenshot diff + a11y** — renders in light and dark, checks for critical axe violations

Both must pass before merge.

---

## 6. After merge

CI builds all wizards and force-pushes built output to the `gh-pages` branch. jsDelivr picks it up within minutes (CI purges the cache after publish).

The wizard is not yet live in the portal. The Gcore team then:
1. Creates a FastEdge template with `WIZARD_SOURCE_CONFIG` pointing to the new wizard
2. Verifies it against a real portal environment

Once the template is published, the wizard is live.

---

## Questions?

Open an issue or reach out via the discussion thread for your wizard PR.
