import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    snapshotDir: './e2e/snapshots',
    reporter: [['list'], ['html', { open: 'never' }]],
    webServer: {
        command: 'npx http-server release -p 9000 --cors --silent',
        port: 9000,
        reuseExistingServer: !process.env['CI'],
    },
    use: {
        baseURL: 'http://localhost:9000',
    },
});
