import fs from 'fs';
import { PlaywrightCrawler, RequestQueue } from 'crawlee';
import dotenv from 'dotenv';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { getOzonProductData, createRequestQueueUrlArray } from '../helpers';
import type { Data, CardData } from '../../../types';

dotenv.config();
chromium.use(stealth());

export class OZONFiles {
  #debug: boolean;

  constructor(debug: boolean = false) {
    this.#debug = debug;
  }

  async saveFiles() {
    const startTime = Date.now();
    const data = JSON.parse(
      fs
        .readFileSync(__dirname + '/../../public/data/ozon-result.json')
        .toString(),
    ) as unknown as Data;
    const requestQueue = await RequestQueue.open();
    const cardDataMap = new Map<string, CardData>();

    data.forEach((item) => {
      item.links.forEach((card) => {
        cardDataMap.set(card.href, card);
      });
    });

    const links = Array.from(cardDataMap.keys());

    if (this.#debug)
      console.log(
        `[ozon-products] Loading ${links.length} unique links from ozon-result.json`,
      );

    await requestQueue.addRequests(createRequestQueueUrlArray(links));

    const crawler = await this.#createCrawler(requestQueue, links.length);

    await crawler.run(links);
    await requestQueue.drop();

    if (this.#debug) {
      const elapsed = Date.now() - startTime;
      console.log(
        `[ozon-products] Done: ${links.length} products in ${elapsed}ms`,
      );
    }
  }

  async #createCrawler(requestQueue: RequestQueue, maxRequests: number) {
    const SAFEGUARD_MAX_REQUESTS = 10;
    const debug = this.#debug;

    return new PlaywrightCrawler({
      requestQueue,
      requestHandlerTimeoutSecs: 180,
      sessionPoolOptions: {
        blockedStatusCodes: [],
      },
      async requestHandler({ request, page }) {
        const url = request.loadedUrl;
        const urlParts = url.split('/').filter(Boolean);
        const fileName =
          urlParts[urlParts.length - 1] ||
          urlParts[urlParts.length - 2] ||
          'unknown';

        await page.waitForTimeout(2000);

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

        try {
          await page.waitForSelector('[data-widget="webProductHeading"] h1', {
            timeout: 30000,
          });
        } catch {
          // page didn't render product content — proceed with whatever HTML we have
        }

        const content = await page.content();
        const productData = getOzonProductData(content);

        if (debug) {
          const titleSnippet = productData.title
            ? productData.title.substring(0, 40)
            : '?';
          console.log(
            `[ozon-products] ${url} title="${titleSnippet}" price=${productData.price} imgs=${productData.images.length}`,
          );
        }

        fs.writeFileSync(
          __dirname + '/../../public/' + fileName + '.html',
          content,
        );
        fs.writeFileSync(
          __dirname + '/../../public/' + fileName + '.json',
          JSON.stringify(productData, null, 2),
        );
      },
      maxRequestsPerCrawl: maxRequests + SAFEGUARD_MAX_REQUESTS,
      maxConcurrency: 5,
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
          await page.route('**/abt-challenge/**', (route) => route.abort());
          const cookiePath = __dirname + '/../../storage/ozon-cookies.json';
          if (fs.existsSync(cookiePath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
            await page.context().addCookies(cookies);
          }
        },
      ],
    });
  }
}
