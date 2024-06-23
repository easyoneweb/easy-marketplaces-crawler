import { PlaywrightCrawler } from 'crawlee';
import { load } from 'cheerio';

export class WBCrawler {
  constructor() {}

  createCrawler(maxRequests: number, maxConcurrentRequests: number, scrollTimes: number, timeBetweenScrolls: number, getLinks = this.#getLinks): PlaywrightCrawler {
    return new PlaywrightCrawler({
      async requestHandler({ request, page, enqueueLinks, pushData }) {
        await page.waitForTimeout(2000);

        for (let i = 0; i < scrollTimes; i++) {
          await page.waitForTimeout(timeBetweenScrolls);
          await page.evaluate(() => window.scrollBy(0, 500));
        }

        const content = await page.content();
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
          await page.setViewportSize({ width: 1700, height: 1300 });
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
      if (href) links.push(href);
    });

    return { nextUrl: nextUrl, links: links };
  }
}