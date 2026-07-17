import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    snapshotDir: './e2e/snapshots',
    reporter: [['list'], ['html', { open: 'never' }]],
    webServer: {
        command: 'PORT=9000 node node_modules/@gcore/fastedge-wizard-sdk/bin/dev.mjs release',
        port: 9000,
        reuseExistingServer: !process.env['CI'],
    },
    use: {
        baseURL: 'http://localhost:9000',
    },
});
