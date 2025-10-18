import { PlaywrightCrawler, RequestQueue, Dataset } from 'crawlee';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { load } from 'cheerio';
import fs from 'fs';

chromium.use(stealth());

export class WBCrawler {
  constructor() {}

  async createCrawler(requestQueue: RequestQueue, maxRequests: number, maxConcurrentRequests: number, scrollTimes: number, timeBetweenScrolls: number): Promise<PlaywrightCrawler> {
    const getLinks = this.#getLinks;
    const dataset = await Dataset.open();
    await dataset.drop();

    return new PlaywrightCrawler({
      requestQueue,
      browserPoolOptions: {
        useFingerprints: true,
      },
      launchContext: {
        launcher: chromium,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      },
      async requestHandler({ request, page, enqueueLinks, pushData }) {
        await page.waitForTimeout(2000 + Math.random() * 1000);

        for (let i = 0; i < scrollTimes; i++) {
          await page.waitForTimeout(timeBetweenScrolls + Math.random() * 500);
          await page.evaluate(() => window.scrollBy(0, 500));
        }

        const content = await page.content();
        fs.writeFileSync(__dirname + '/../../public/' + 'test' + '.html', content);
        const { nextUrl, links } = getLinks(content);

        await pushData({ url: request.loadedUrl, links: links });

        if (nextUrl) {
          await enqueueLinks({
            globs: [ nextUrl ]
          });
        }
      },
      maxRequestsPerCrawl: maxRequests,
      maxConcurrency: maxConcurrentRequests,
      preNavigationHooks: [
        async (crawlingContext) => {
          const { page } = crawlingContext;
          await page.setViewportSize({ width: 1920, height: 1080 });
        },
      ]
    });
  }

  #getLinks(content: string) {
    const $ = load(content);
    const links: Array<string> = [];

    const nextUrl = $('a.pagination-next.pagination__next.j-next-page').attr('href');

    $('a.product-card__link.j-card-link').each(function() {
      const href = $(this).attr('href');
      if (href) links.push(href.split('?')[0]);
    });

    return { nextUrl: nextUrl, links: links };
  }
}