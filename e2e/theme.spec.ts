import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Real deployed wizards to test — add rows here when new wizards are added.
// _template is a starter skeleton, not a deployed wizard.
const WIZARDS = ['write-intents'];
const THEMES = ['gc-theme-light', 'gc-theme-dark'] as const;

// release/<wizard>/index.html is served by playwright's webServer (see playwright.config.ts).
function previewUrl(wizard: string, port: number): string {
    return `http://localhost:${port}/${wizard}/index.html`;
}

const PORT = 9000;

for (const wizard of WIZARDS) {
    for (const theme of THEMES) {
        test(`${wizard} renders in ${theme}`, async ({ page }) => {
            await page.goto(previewUrl(wizard, PORT));
            await page.evaluate((t) => (document.body.className = t), theme);
            await expect(page).toHaveScreenshot(`${wizard}-${theme}.png`, { maxDiffPixelRatio: 0.02 });
        });
    }

    test(`${wizard} — no critical a11y violations`, async ({ page }) => {
        await page.goto(previewUrl(wizard, PORT));
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations.filter((v) => v.impact === 'critical')).toEqual([]);
    });
}
