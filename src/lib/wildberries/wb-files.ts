import fs from 'fs';
import { PlaywrightCrawler, RequestQueue } from 'crawlee';
import dotenv from 'dotenv';
import { getWBProductData, createRequestQueueUrlArray } from '../helpers';
import type { Data } from '../../../types';

dotenv.config();

export class WBFiles {
  constructor() {}

  async saveFiles(maxConcurrentRequests: number, additionalParamsButtonName: string) {
    const data = JSON.parse(fs.readFileSync(__dirname + '/../../public/data/wb-result.json').toString()) as unknown as Data;
    const requestQueue = await RequestQueue.open();
    let links: Array<string> = [];

    data.forEach(item => {
      links = [...links, ...item.links];
    });

    await requestQueue.addRequests(createRequestQueueUrlArray(links));

    const crawler = await this.#createCrawler(requestQueue, links.length, maxConcurrentRequests, additionalParamsButtonName);
    
    await crawler.run(links);
    await requestQueue.drop();
  }

  async #createCrawler(requestQueue: RequestQueue, maxRequests: number, maxConcurrentRequests: number, additionalParamsButtonName: string) {
    const SAFEGUARD_MAX_REQUESTS = 10;

    return new PlaywrightCrawler({
      requestQueue,
      async requestHandler({ request, page }) {
        await page.waitForTimeout(2000);
        
        await page.getByRole('button', { name: additionalParamsButtonName }).click();
        await page.waitForTimeout(500);

        const url = request.loadedUrl;
        const fileName = url.split('/')[4];
        const content = await page.content();
        const productData = getWBProductData(content);
        
        fs.writeFileSync(__dirname + '/../../public/' + fileName + '.html', content);
        fs.writeFileSync(__dirname + '/../../public/' + fileName + '.json', JSON.stringify(productData, null, 2));
      },
      maxRequestsPerCrawl: maxRequests + SAFEGUARD_MAX_REQUESTS,
      maxConcurrency: maxConcurrentRequests
    });
  }
}