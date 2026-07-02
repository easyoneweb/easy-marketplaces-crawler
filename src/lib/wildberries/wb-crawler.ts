import { PlaywrightCrawler, RequestQueue, Dataset } from 'crawlee';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { load } from 'cheerio';
import type { CardData } from '../../../types';

chromium.use(stealth());

export class WBCrawler {
  constructor() {}

  async createCrawler(
    requestQueue: RequestQueue,
    maxRequests: number,
    maxConcurrentRequests: number,
    scrollTimes: number,
    timeBetweenScrolls: number,
  ): Promise<PlaywrightCrawler> {
    const getCardData = this.#getCardData;
    const dataset = await Dataset.open();
    await dataset.drop();

    return new PlaywrightCrawler({
      requestQueue,
      browserPoolOptions: {
        useFingerprints: true,
      },
      launchContext: {
        launcher: chromium,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      },
      async requestHandler({ request, page, pushData }) {
        await page.waitForTimeout(2000 + Math.random() * 1000);

        let prevCardCount = 0;
        let stableCount = 0;
        const maxBatchIterations = maxRequests;
        let batchIteration = 0;

        while (batchIteration < maxBatchIterations) {
          for (let i = 0; i < scrollTimes; i++) {
            await page.waitForTimeout(timeBetweenScrolls + Math.random() * 500);
            await page.evaluate(() => window.scrollBy(0, 500));
          }

          await page.waitForTimeout(2000);

          const content = await page.content();
          const cardData = getCardData(content);
          const currentCount = cardData.length;

          if (currentCount === prevCardCount) {
            stableCount++;
            if (stableCount >= 3) {
              break;
            }
          } else {
            stableCount = 0;
            prevCardCount = currentCount;
          }

          batchIteration++;
        }

        const finalContent = await page.content();
        const links = getCardData(finalContent);

        await pushData({ url: request.loadedUrl, links: links });
      },
      maxRequestsPerCrawl: maxRequests,
      maxConcurrency: maxConcurrentRequests,
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
