import { PlaywrightCrawler, RequestQueue, Dataset } from 'crawlee';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { load } from 'cheerio';
import type { CardData } from '../../../types';

chromium.use(stealth());

export class WBCrawler {
  #debug: boolean;

  constructor(debug: boolean = false) {
    this.#debug = debug;
  }

  async createCrawler(requestQueue: RequestQueue): Promise<PlaywrightCrawler> {
    const getCardData = this.#getCardData.bind(this);
    const debug = this.#debug;
    const dataset = await Dataset.open();
    await dataset.drop();

    return new PlaywrightCrawler({
      requestQueue,
      requestHandlerTimeoutSecs: 300,
      browserPoolOptions: {
        useFingerprints: true,
      },
      launchContext: {
        launcher: chromium,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      },
      async requestHandler({ request, page, pushData }) {
        const startTime = Date.now();

        if (debug)
          console.log(`[wb-catalog] Starting crawl: ${request.loadedUrl}`);

        await page.waitForTimeout(2000 + Math.random() * 1000);

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
              `[wb-catalog] iter ${i + 1}/${MAX_ITERATIONS}: ${currentCount} cards ${deltaStr}, ${stableCount} stable`,
            );
          }

          if (currentCount === prevCardCount) {
            stableCount++;
            if (stableCount >= 3) {
              break;
            }
          } else {
            stableCount = 0;
            prevCardCount = currentCount;
          }
        }

        const finalContent = await page.content();
        const links = getCardData(finalContent);

        if (debug) {
          const elapsed = Date.now() - startTime;
          const withNmId = links.filter((l) => l.nmId).length;
          const withPb = links.filter((l) => l.imagePbUrl).length;
          console.log(
            `[wb-catalog] Scroll done: reason=${stableCount >= 3 ? 'stable' : 'max'}, cards=${links.length}, elapsed=${elapsed}ms`,
          );
          console.log(
            `[wb-catalog] Parsed ${links.length} cards: ${withNmId} with nmId, ${withPb} with imagePbUrl`,
          );
        }

        await pushData({ url: request.loadedUrl, links: links });
      },
      maxRequestsPerCrawl: 1,
      maxConcurrency: 1,
      preNavigationHooks: [
        async (crawlingContext) => {
          const { page } = crawlingContext;
          await page.setViewportSize({ width: 1920, height: 1080 });
        },
      ],
    });
  }

  #getCardData(content: string): CardData[] {
    const $ = load(content);
    const links: CardData[] = [];

    $('a.product-card__link.j-card-link').each(function () {
      const href = $(this).attr('href');
      if (!href) return;

      const cleanHref = href.split('?')[0];

      const card = $(this).closest('.product-card');
      const img = card.find('.product-card__img-wrap img.j-thumbnail');
      const imagePbUrl = img.attr('data-src-pb');

      const nmIdMatch = cleanHref.match(/\/catalog\/(\d+)\//);
      const nmId = nmIdMatch ? nmIdMatch[1] : '';

      links.push({
        href: cleanHref,
        nmId: nmId,
        imagePbUrl: imagePbUrl || undefined,
      });
    });

    return links;
  }
}
