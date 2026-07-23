import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'playwright';
import { getOzonProductData } from '../helpers';
import type { Product } from '../../../types';

chromium.use(stealth());

class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(count: number) {
    this.permits = count;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  release(): void {
    this.permits++;
    this.waiting.shift()?.();
  }
}

let browser: Browser | null = null;
let pageCount = 0;
const MAX_PAGES_BEFORE_RESTART = 50;
const MAX_CONCURRENCY = 3;
const semaphore = new Semaphore(MAX_CONCURRENCY);

const COOKIE_PATH = path.resolve(__dirname, '../../storage/ozon-cookies.json');
const PRODUCT_URL_PATTERN = /^https:\/\/www\.ozon\.ru\/product\//;

async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected() && pageCount < MAX_PAGES_BEFORE_RESTART) {
    return browser;
  }
  if (browser) {
    try {
      await browser.close();
    } catch {
      /* ignore */
    }
    browser = null;
    pageCount = 0;
  }
  browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  if (fs.existsSync(COOKIE_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf-8'));
    const context = browser.contexts()[0];
    await context.addCookies(cookies);
  }

  pageCount = 0;
  return browser;
}

async function setupPage(page: Page): Promise<void> {
  await page.route('**/abt-challenge/**', (route) => route.abort());
  await page.setViewportSize({ width: 1700, height: 1300 });
}

async function dismissAntiBotOverlays(page: Page): Promise<void> {
  await page.evaluate(() => {
    const selectors = [
      '#content.sec.bl',
      '[class*="abt-challenge"]',
      '[id*="captcha"]',
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    }
  });
}

export async function crawlSingleOzonProduct(url: string): Promise<Product> {
  if (!PRODUCT_URL_PATTERN.test(url)) {
    throw new Error('Invalid Ozon product URL');
  }

  await semaphore.acquire();
  let page: Page | null = null;

  try {
    const sharedBrowser = await getBrowser();
    page = await sharedBrowser.newPage();

    await setupPage(page);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    await dismissAntiBotOverlays(page);

    try {
      await page.waitForSelector('[data-widget="webProductHeading"] h1', {
        timeout: 30000,
      });
    } catch {
      /* page didn't render product content — proceed with whatever HTML we have */
    }

    const content = await page.content();
    const productData = getOzonProductData(content);

    pageCount++;
    return productData;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        /* ignore */
      }
    }
    semaphore.release();
  }
}

export async function updateOzonCookies(
  cookieString: string,
): Promise<number> {
  const trimmed = cookieString.trim();
  if (!trimmed) {
    throw new Error('Cookie string is empty');
  }

  const pairs = trimmed.split('; ');
  const cookies: Array<{ name: string; value: string; domain: string; path: string }> = [];

  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex <= 0) continue;

    const name = pair.substring(0, eqIndex).trim();
    const value = pair.substring(eqIndex + 1).trim();

    if (name) {
      cookies.push({ name, value, domain: '.ozon.ru', path: '/' });
    }
  }

  if (!cookies.length) {
    throw new Error('No valid cookies found in string');
  }

  const dir = path.dirname(COOKIE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));

  if (browser && browser.isConnected()) {
    const context = browser.contexts()[0];
    await context.addCookies(cookies);
  }

  return cookies.length;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    try {
      await browser.close();
    } catch {
      /* ignore */
    }
    browser = null;
    pageCount = 0;
  }
}
