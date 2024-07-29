import fs from 'fs';
import { PlaywrightCrawler } from 'crawlee';
import dotenv from 'dotenv';
import { getOzonProductData } from '../helpers';
import type { Data } from '../../../types';

dotenv.config();

export class OZONFiles {
  constructor() {}

  async saveFiles(maxConcurrentRequests: number) {
    const data = JSON.parse(fs.readFileSync(__dirname + '/../../public/data/ozon-result.json').toString()) as unknown as Data;
    let links: Array<string> = [];

    data.forEach(item => {
      links = [...links, ...item.links];
    });

    const crawler = await this.#createCrawler(links.length, maxConcurrentRequests);
    await crawler.run([links[0]]);
  }

  async #createCrawler(maxRequests: number, maxConcurrentRequests: number) {
    const SAFEGUARD_MAX_REQUESTS = 10;

    return new PlaywrightCrawler({
      async requestHandler({ request, page }) {
        await page.waitForTimeout(2000);

        const url = request.loadedUrl;
        const fileName = url.split('/')[4];
        const content = await page.content();
        const productData = getOzonProductData(content);
        
        fs.writeFileSync(__dirname + '/../../public/' + fileName + '.html', content);
        fs.writeFileSync(__dirname + '/../../public/' + fileName + '.json', JSON.stringify(productData, null, 2));
      },
      maxRequestsPerCrawl: maxRequests + SAFEGUARD_MAX_REQUESTS,
      maxConcurrency: maxConcurrentRequests,
      launchContext: {
        userAgent: 'PostmanRuntime/7.39.0'
      },
    });
  }
}