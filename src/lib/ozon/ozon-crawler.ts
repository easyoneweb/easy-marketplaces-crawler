import { PlaywrightCrawler, RequestQueue, Dataset } from 'crawlee';
import { load } from 'cheerio';

export class OZONCrawler {
  constructor() {}

  async createCrawler(requestQueue: RequestQueue, maxRequests: number, maxConcurrentRequests: number, scrollTimes: number, timeBetweenScrolls: number): Promise<PlaywrightCrawler> {
    const getLinks = this.#getLinks;
    const dataset = await Dataset.open();
    await dataset.drop();

    return new PlaywrightCrawler({
      requestQueue,
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
      launchContext: {
        userAgent: 'PostmanRuntime/7.39.0'
      },
      preNavigationHooks: [
        async (crawlingContext) => {
          const { page } = crawlingContext;
          await page.setViewportSize({ width: 1700, height: 1300 });
        },
      ]
    });
  }

  #getLinks(content: string) {
    const OZON_BASE_URL = 'https://www.ozon.ru';
    const $ = load(content);
    const links: Array<string> = [];

    let nextUrl = $('[data-widget=megaPaginator] div div a:last').attr('href');
    if (nextUrl) nextUrl = OZON_BASE_URL + nextUrl;

    $('div.tile-root a.tile-hover-target').each(function() {
      const href = $(this).attr('href');
      if (href) links.push(OZON_BASE_URL + href.split('?')[0]);
    });

    return { nextUrl: nextUrl, links: links };
  }
}