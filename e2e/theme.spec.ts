import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Real deployed wizards to test — add rows here when new wizards are added.
// _template is a starter skeleton, not a deployed wizard.
const WIZARDS = ['write-intents'];

// SDK protocol version — must match the SDK constant.
const V = 1;
const PORT = 9000;

// Include hostOrigin so the SDK's origin check passes when we self-post INIT.
// When not in an iframe, window.parent === window, so the source check also passes.
function wizardUrl(wizard: string): string {
    return `http://localhost:${PORT}/${wizard}/index.html?hostOrigin=http://localhost:${PORT}`;
}

// Inject a minimal host bridge into the current page, triggering the SDK
// handshake and stubbing all intent responses with empty/minimal data.
// Sets document.body.dataset.ready = 'true' when READY is received.
async function connectBridge(page: Page, theme: 'light' | 'dark'): Promise<void> {
    await page.evaluate(({ V, theme }) => {
        const ch = new MessageChannel();
        ch.port1.onmessage = (e: MessageEvent) => {
            const m = e.data as Record<string, unknown>;
            if (!m || m['v'] !== V) return;
            if (m['type'] === 'ready') {
                document.body.dataset['ready'] = 'true';
            } else if (m['type'] === 'intent') {
                const intent = m['intent'] as string;
                const data =
                    intent.endsWith('.list') ? [] :
                    intent === 'context.get' ? {} :
                    intent.endsWith('.get')  ? null : {};
                ch.port1.postMessage({ v: V, type: 'result', id: m['id'], ok: true, data });
            }
        };
        ch.port1.start();
        window.postMessage({ v: V, type: 'init' }, location.origin, [ch.port2]);
        ch.port1.postMessage({ v: V, type: 'hello', hostContext: { specVersion: '1', theme, locale: 'en' } });
    }, { V, theme });

    await page.waitForFunction(() => document.body.dataset['ready'] === 'true', { timeout: 10_000 });
    // Allow post-connect async intent round-trips to settle before screenshotting
    await page.waitForTimeout(500);
}

for (const wizard of WIZARDS) {
    for (const theme of ['light', 'dark'] as const) {
        test(`${wizard} renders in gc-theme-${theme}`, async ({ page }) => {
            await page.goto(wizardUrl(wizard));
            await connectBridge(page, theme);
            await expect(page).toHaveScreenshot(`${wizard}-gc-theme-${theme}.png`, { maxDiffPixelRatio: 0.05 });
        });
    }

    test(`${wizard} — no critical a11y violations`, async ({ page }) => {
        await page.goto(wizardUrl(wizard));
        await connectBridge(page, 'light');
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations.filter((v) => v.impact === 'critical')).toEqual([]);
    });
}
