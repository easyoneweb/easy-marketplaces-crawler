import fs from 'fs';
import { PlaywrightCrawler, RequestQueue } from 'crawlee';
import dotenv from 'dotenv';
import {
  getWBProductData,
  createRequestQueueUrlArray,
  buildCardJsonUrl,
} from '../helpers';
import type {
  Data,
  CardData,
  WBCardJsonResponse,
  Product,
} from '../../../types';

dotenv.config();

export class WBFiles {
  constructor() {}

  async saveFiles() {
    const data = JSON.parse(
      fs
        .readFileSync(__dirname + '/../../public/data/wb-result.json')
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

    await requestQueue.addRequests(createRequestQueueUrlArray(links));

    const crawler = await this.#createCrawler(
      requestQueue,
      links.length,
      cardDataMap,
    );

    await crawler.run(links);
    await requestQueue.drop();
  }

  async #createCrawler(
    requestQueue: RequestQueue,
    maxRequests: number,
    cardDataMap: Map<string, CardData>,
  ) {
    const SAFEGUARD_MAX_REQUESTS = 10;

    return new PlaywrightCrawler({
      requestQueue,
      async requestHandler({ request, page }) {
        await page.waitForTimeout(2000);

        const url = request.loadedUrl;
        const fileName = url.split('/')[4];
        const content = await page.content();

        const cardData = cardDataMap.get(url);
        let productData: Product = {
          title: '',
          price: '0',
          images: [],
          params: [],
        };

        if (cardData?.imagePbUrl) {
          const apiUrl = buildCardJsonUrl(cardData.imagePbUrl);
          if (apiUrl) {
            try {
              const response = await page.evaluate(async (apiUrl: string) => {
                const res = await fetch(apiUrl);
                return res.json();
              }, apiUrl);

              productData = getWBProductData(
                response as WBCardJsonResponse,
                content,
              );
            } catch {
              productData = getWBProductData({} as WBCardJsonResponse, content);
            }
          }
        } else {
          productData = getWBProductData({} as WBCardJsonResponse, content);
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
    });
  }
}
