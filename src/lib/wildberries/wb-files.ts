import fs from 'fs';
import { PlaywrightCrawler } from 'crawlee';
import dotenv from 'dotenv';
import { getProductData } from '../helpers';
import type { Data } from '../../../types';

dotenv.config();

export class WBFiles {
  constructor() {}

  async saveFiles(maxConcurrentRequests: number, additionalParamsButtonName: string) {
    this.#removeCurrentHtmlFiles();

    const data = JSON.parse(fs.readFileSync(__dirname + '/../../public/data/result.json').toString()) as unknown as Data;
    let links: Array<string> = [];

    data.forEach(item => {
      links = [...links, ...item.links];
    });

    const crawler = await this.#createCrawler(links.length, maxConcurrentRequests, additionalParamsButtonName);
    await crawler.run(links);
  }

  async #createCrawler(maxRequests: number, maxConcurrentRequests: number, additionalParamsButtonName: string) {
    const SAFEGUARD_MAX_REQUESTS = 10;

    return new PlaywrightCrawler({
      async requestHandler({ request, page }) {
        await page.waitForTimeout(2000);
        
        await page.getByRole('button', { name: additionalParamsButtonName }).click();
        await page.waitForTimeout(500);

        const url = request.loadedUrl;
        const fileName = url.split('/')[4];
        const content = await page.content();
        const productData = getProductData(content);
        
        fs.writeFileSync(__dirname + '/../../public/' + fileName + '.html', content);
        fs.writeFileSync(__dirname + '/../../public/' + fileName + '.json', JSON.stringify(productData, null, 2));
      },
      maxRequestsPerCrawl: maxRequests + SAFEGUARD_MAX_REQUESTS,
      maxConcurrency: maxConcurrentRequests
    });
  }

  #removeCurrentHtmlFiles(): void {
    const files = fs.readdirSync(__dirname + '/../../public');

    files.forEach(file => {
      if (file === 'data') return;
      
      fs.unlinkSync(__dirname + '/../../public/' + file);
    });
  }
}