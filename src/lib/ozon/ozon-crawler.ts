import fs from 'fs';
import { PlaywrightCrawler, RequestQueue, Dataset } from 'crawlee';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { load } from 'cheerio';
import type { CardData } from '../../../types';

chromium.use(stealth());

interface OzonApiProduct {
  id: string;
  action?: { link?: string };
}

interface OzonApiResponse {
  nextPage?: string;
  shared?: string;
  widgetStates?: Record<string, string>;
}

export class OZONCrawler {
  #debug: boolean;

  constructor(debug: boolean = false) {
    this.#debug = debug;
  }

  async createCrawler(requestQueue: RequestQueue): Promise<PlaywrightCrawler> {
    const getCardData = this.#getCardData.bind(this);
    const collectApiProducts = this.#collectApiProducts.bind(this);
    const debug = this.#debug;

    const dataset = await Dataset.open();
    await dataset.drop();

    return new PlaywrightCrawler({
      requestQueue,
      requestHandlerTimeoutSecs: 300,
      browserPoolOptions: {
        useFingerprints: true,
      },
      sessionPoolOptions: {
        blockedStatusCodes: [],
      },
      async requestHandler({ request, page, pushData }) {
        const startTime = Date.now();
        const url = request.loadedUrl;
        const OZON_BASE_URL = 'https://www.ozon.ru';
        const sellerPath = new URL(url).pathname;

        if (debug) console.log(`[ozon-catalog] Starting crawl: ${url}`);

        const apiLinks = await collectApiProducts(
          page,
          OZON_BASE_URL,
          sellerPath,
        );

        if (apiLinks.length > 0) {
          if (debug) {
            const elapsed = Date.now() - startTime;
            const withNmId = apiLinks.filter((l) => l.nmId).length;
            console.log(
              `[ozon-catalog] API done: ${apiLinks.length} cards in ${elapsed}ms`,
            );
            console.log(
              `[ozon-catalog] Parsed ${apiLinks.length} cards: ${withNmId} with nmId`,
            );
          }
          await pushData({ url: request.loadedUrl, links: apiLinks });
          return;
        }

        if (debug)
          console.log(
            '[ozon-catalog] API returned no products, falling back to browser crawl',
          );

        await page.waitForTimeout(2000 + Math.random() * 1000);

        let cardsAppeared = false;

        try {
          await page.waitForSelector('a[href*="/product/"]', {
            timeout: 60000,
          });
          cardsAppeared = true;
        } catch {
          // timeout
        }

        if (!cardsAppeared) {
          if (debug) {
            const content = await page.content();
            const antiBotDetected =
              content.includes('captcha') ||
              content.includes('antibot') ||
              content.includes('Antibot Captcha') ||
              content.includes('Похоже, нет соединения') ||
              content.includes('challenge') ||
              content.includes('Почти готово');
            console.log(
              `[ozon-catalog] Page did not load after 60s, anti-bot detected: ${antiBotDetected}`,
            );

            const debugDir = __dirname + '/../../storage/debug';
            fs.mkdirSync(debugDir, { recursive: true });
            const timestamp = Date.now();
            const htmlPath = `${debugDir}/${timestamp}-ozon.html`;
            const pngPath = `${debugDir}/${timestamp}-ozon.png`;
            fs.writeFileSync(htmlPath, content);
            await page.screenshot({ path: pngPath, fullPage: true });
            console.log(
              `[ozon-catalog] Debug dump saved: ${htmlPath}, ${pngPath}`,
            );
          }

          await pushData({ url: url, links: [] });
          return;
        }

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

        if (debug) console.log('[ozon-catalog] Dismissed anti-bot overlay');

        let prevCardCount = 0;
        let stableCount = 0;
        const MAX_ITERATIONS = 50;

        for (let i = 0; i < MAX_ITERATIONS; i++) {
          await page.evaluate(() =>
            window.scrollTo(0, document.body.scrollHeight),
          );
          await page.waitForTimeout(2000);

          const content = await page.content();
          const cardData = getCardData(content);
          const currentCount = cardData.length;

          if (debug) {
            const delta = currentCount - prevCardCount;
            const deltaStr =
              delta > 0 ? `(+${delta})` : delta < 0 ? `(${delta})` : '(+0)';
            console.log(
              `[ozon-catalog] iter ${i + 1}/${MAX_ITERATIONS}: ${currentCount} cards ${deltaStr}, ${stableCount} stable`,
            );
          }

          if (currentCount === prevCardCount && currentCount > 0) {
            stableCount++;
            if (stableCount >= 3) {
              break;
            }
          } else {
            stableCount = 0;
            prevCardCount = currentCount;
          }
        }

        const showMoreBtn = await page.$(
          'button:has-text("Показать больше"), button:has-text("Показать ещё"), button:has-text("Загрузить ещё")',
        );
        if (showMoreBtn) {
          try {
            await showMoreBtn.click();
            if (debug)
              console.log('[ozon-catalog] Clicked "Показать больше" button');

            for (let i = 0; i < MAX_ITERATIONS; i++) {
              await page.evaluate(() =>
                window.scrollTo(0, document.body.scrollHeight),
              );
              await page.waitForTimeout(2000);

              const content = await page.content();
              const cardData = getCardData(content);
              const currentCount = cardData.length;

              if (debug) {
                const delta = currentCount - prevCardCount;
                const deltaStr =
                  delta > 0 ? `(+${delta})` : delta < 0 ? `(${delta})` : '(+0)';
                console.log(
                  `[ozon-catalog] iter after click ${i + 1}: ${currentCount} cards ${deltaStr}`,
                );
              }

              if (currentCount === prevCardCount) break;
              prevCardCount = currentCount;
            }
          } catch {
            // button may be obscured or unclickable
          }
        }

        const finalContent = await page.content();
        const links = getCardData(finalContent);

        if (debug) {
          const elapsed = Date.now() - startTime;
          const withNmId = links.filter((l) => l.nmId).length;
          console.log(
            `[ozon-catalog] Browser scroll done: reason=${stableCount >= 3 ? 'stable' : 'max'}, cards=${links.length}, elapsed=${elapsed}ms`,
          );
          console.log(
            `[ozon-catalog] Parsed ${links.length} cards: ${withNmId} with nmId`,
          );
        }

        await pushData({ url: request.loadedUrl, links: links });
      },
      maxRequestsPerCrawl: 1,
      maxConcurrency: 1,
      headless: false,
      launchContext: {
        launcher: chromium,
        useIncognitoPages: false,
        launchOptions: {
          args: ['--disable-blink-features=AutomationControlled'],
        },
      },
      preNavigationHooks: [
        async (crawlingContext) => {
          const { page } = crawlingContext;
          await page.setViewportSize({ width: 1700, height: 1300 });

          await page.route('**/abt-challenge/**', (route) => route.abort());

          const cookiePath = __dirname + '/../../storage/ozon-cookies.json';
          if (fs.existsSync(cookiePath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
            await page.context().addCookies(cookies);
            if (debug)
              console.log(`[ozon-catalog] Injected ${cookies.length} cookies`);
          }
        },
      ],
    });
  }

  async #collectApiProducts(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page: any,
    OZON_BASE_URL: string,
    sellerPath: string,
  ): Promise<CardData[]> {
    const debug = this.#debug;
    const allLinks: CardData[] = [];
    const seen = new Set<string>();

    let apiUrl = `${OZON_BASE_URL}/api/entrypoint-api.bx/page/json/v2?url=${sellerPath}?__rr=1`;
    let pageNum = 0;
    const MAX_API_PAGES = 100;

    while (apiUrl && pageNum < MAX_API_PAGES) {
      pageNum++;

      if (debug) console.log(`[ozon-catalog] API page ${pageNum}: ${apiUrl}`);

      let result;
      try {
        result = (await page.evaluate((url: string) => {
          return fetch(url).then((res) =>
            res.text().then((text) => {
              const ok = res.ok;
              const status = res.status;
              if (!ok) return { ok, status, body: null };
              return { ok, status, body: JSON.parse(text) };
            }),
          );
        }, apiUrl)) as { ok: boolean; status: number; body: unknown };
      } catch (err) {
        if (debug) console.log(`[ozon-catalog] API fetch failed: ${err}`);
        break;
      }

      if (!result.ok) {
        if (debug) console.log(`[ozon-catalog] API returned ${result.status}`);
        break;
      }

      const data = result.body as OzonApiResponse;

      let pageProducts = 0;

      if (data.widgetStates) {
        for (const [key, value] of Object.entries(data.widgetStates)) {
          if (key.startsWith('tileGridDesktop-')) {
            try {
              const grid = JSON.parse(value);
              const items = grid.items as OzonApiProduct[] | undefined;
              if (items && Array.isArray(items)) {
                for (const item of items) {
                  const productId = item.id;
                  const link = item.action?.link;
                  if (productId && link) {
                    const cleanHref = link.startsWith('http')
                      ? link.split('?')[0]
                      : OZON_BASE_URL + link.split('?')[0];
                    if (!seen.has(cleanHref)) {
                      seen.add(cleanHref);
                      allLinks.push({ href: cleanHref, nmId: productId });
                      pageProducts++;
                    }
                  }
                }
              }
            } catch {
              // widget state parse failed, skip this widget
            }
          }
        }
      }

      if (debug) {
        const shared = (() => {
          if (data.shared) {
            try {
              return JSON.parse(data.shared);
            } catch {
              return null;
            }
          }
          return null;
        })();
        const totalPages = shared?.catalog?.totalPages || '?';
        console.log(
          `[ozon-catalog] API page ${pageNum}: ${pageProducts} products, total=${allLinks.length}, pages=${pageNum}/${totalPages}`,
        );
      }

      if (!data.nextPage) break;

      apiUrl = data.nextPage.startsWith('http')
        ? data.nextPage
        : OZON_BASE_URL + data.nextPage;
    }

    return allLinks;
  }

  #getCardData(content: string): CardData[] {
    const OZON_BASE_URL = 'https://www.ozon.ru';
    const $ = load(content);
    const links: CardData[] = [];

    $('a[href*="/product/"]').each(function () {
      const href = $(this).attr('href');
      if (!href) return;

      const cleanHref = href.startsWith('http')
        ? href.split('?')[0]
        : OZON_BASE_URL + href.split('?')[0];

      const idMatch = cleanHref.match(/\/product\/[^/]+-(\d+)\/?$/);
      const nmId = idMatch ? idMatch[1] : '';

      links.push({ href: cleanHref, nmId: nmId });
    });

    const seen = new Set<string>();
    return links.filter((link) => {
      if (seen.has(link.href)) return false;
      seen.add(link.href);
      return true;
    });
  }
}
