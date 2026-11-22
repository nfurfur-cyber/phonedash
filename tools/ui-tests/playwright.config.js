// Runs the UI tests against the web demo: tools/pages/build-site.mjs builds it, serve.mjs serves it.
const { defineConfig } = require('@playwright/test');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const site = path.join(root, '.ui-site');
const node = JSON.stringify(process.execPath);

module.exports = defineConfig({
  testDir: __dirname,
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: path.join(root, 'ui-test-report') }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8781/',
    viewport: { width: 780, height: 360 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `${node} "${path.join(root, 'tools', 'pages', 'build-site.mjs')}" "${site}" && ${node} "${path.join(__dirname, 'serve.mjs')}" "${site}" 8781`,
    url: 'http://127.0.0.1:8781/panel/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
