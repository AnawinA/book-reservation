'use strict';

/**
 * Lightweight UI smoke check.
 *
 * Loads every page in both themes at a desktop and a mobile viewport, then fails
 * if a page errors, loses its navigation, ignores the theme, or overflows
 * horizontally.
 *
 * Usage:
 *   npm run test:ui                          # against http://localhost:3000
 *   SMOKE_BASE_URL=http://localhost:32773 npm run test:ui
 *
 * It drives the Chrome/Edge already installed on the machine through
 * playwright-core, so no browser download is needed. Point SMOKE_BROWSER at a
 * Chromium executable or channel ("msedge") when auto-detection fails.
 */

const fs = require('fs');
const { chromium, request } = require('playwright-core');

const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Passw0rd!';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 }
];

const THEMES = ['light', 'dark'];

const PAGES = [
  { name: 'catalog', path: '/' },
  { name: 'customer', path: '/customer/dashboard', user: 'alice' },
  { name: 'shop', path: '/shop/dashboard', user: 'owner_ladkrabang' },
  { name: 'admin', path: '/admin/dashboard', user: 'admin' }
];

const BROWSERS = [
  process.env.SMOKE_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

function launchOptions(candidate) {
  return candidate.includes('/') || candidate.includes('\\')
    ? { executablePath: candidate }
    : { channel: candidate };
}

async function launchBrowser() {
  const failures = [];

  for (const candidate of BROWSERS) {
    const { executablePath } = launchOptions(candidate);
    if (executablePath && !fs.existsSync(executablePath)) continue;

    try {
      return await chromium.launch(launchOptions(candidate));
    } catch (error) {
      failures.push(`${candidate}: ${error.message.split('\n')[0]}`);
    }
  }

  throw new Error(
    `Could not launch a Chromium browser.\n${failures.join('\n')}\n` +
      'Set SMOKE_BROWSER to a Chrome/Edge executable path or channel.'
  );
}

/**
 * One login per role, reused as cookie state. The auth routes are rate limited,
 * so the check must not log in for every page/viewport combination.
 */
async function sessionCookies() {
  const api = await request.newContext({ baseURL: BASE_URL });
  const cookies = {};

  try {
    const users = [...new Set(PAGES.map((page) => page.user).filter(Boolean))];
    for (const user of users) {
      const response = await api.post('/api/auth/login', { data: { username: user, password: PASSWORD } });
      if (!response.ok()) {
        throw new Error(`login as ${user} returned ${response.status()}`);
      }
      cookies[user] = (await api.storageState()).cookies;
    }
  } finally {
    await api.dispose();
  }

  return cookies;
}

/**
 * Runs in the page. Returns the horizontal overflow (px) and any element that
 * sticks out of the viewport without living inside a horizontal scroller.
 */
function inspectLayout() {
  const viewportWidth = window.innerWidth;
  const overflow = Math.round(document.documentElement.scrollWidth - viewportWidth);

  const offenders = [];
  for (const element of document.body.querySelectorAll('*')) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.right <= viewportWidth + 1) continue;

    let ancestor = element.parentElement;
    let inScroller = false;
    while (ancestor) {
      const overflowX = getComputedStyle(ancestor).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') {
        inScroller = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (inScroller) continue;

    const className = String(element.className || '').split(/\s+/)[0];
    offenders.push(
      `${element.tagName.toLowerCase()}${className ? `.${className}` : ''} (right edge ${Math.round(rect.right)}px)`
    );
    if (offenders.length === 3) break;
  }

  return {
    overflow,
    offenders,
    theme: document.documentElement.getAttribute('data-theme'),
    hasNav: Boolean(document.querySelector('.site-nav'))
  };
}

async function checkPage(context, page, theme, cookies) {
  await context.clearCookies();
  if (page.user) await context.addCookies(cookies[page.user]);

  const browserPage = await context.newPage();
  try {
    const response = await browserPage.goto(`${BASE_URL}${page.path}`, {
      waitUntil: 'load',
      timeout: 15000
    });
    const status = response ? response.status() : 0;
    const layout = await browserPage.evaluate(inspectLayout);

    const problems = [];
    if (status >= 400) problems.push(`HTTP ${status}`);
    if (!layout.hasNav) problems.push('missing .site-nav');
    if (layout.theme !== theme) problems.push(`theme is "${layout.theme}", expected "${theme}"`);
    if (layout.overflow > 1) problems.push(`overflows by ${layout.overflow}px`);
    if (layout.offenders.length) problems.push(`outside viewport: ${layout.offenders.join(', ')}`);

    return { status, problems };
  } finally {
    await browserPage.close();
  }
}

async function main() {
  const cookies = await sessionCookies();
  const browser = await launchBrowser();
  const results = [];

  try {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height }
        });
        await context.addInitScript((value) => {
          try {
            window.localStorage.setItem('bbs-theme', value);
          } catch (_) {
            /* storage can be unavailable; the system theme then applies */
          }
        }, theme);

        for (const page of PAGES) {
          const result = await checkPage(context, page, theme, cookies);
          results.push({ page: page.name, theme, viewport: viewport.name, ...result });
        }

        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((result) => result.problems.length > 0);

  console.log(`\nUI smoke check → ${BASE_URL}\n`);
  console.log(
    results
      .map((result) => {
        const state = result.problems.length ? `FAIL  ${result.problems.join('; ')}` : 'ok';
        return `  ${result.page.padEnd(9)} ${result.theme.padEnd(5)} ${result.viewport.padEnd(8)} ${state}`;
      })
      .join('\n')
  );
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);

  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`UI smoke check could not run: ${error.message}`);
  process.exitCode = 1;
});
