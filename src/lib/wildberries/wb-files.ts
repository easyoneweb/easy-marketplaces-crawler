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
  #debug: boolean;

  constructor(debug: boolean = false) {
    this.#debug = debug;
  }

  async saveFiles() {
    const startTime = Date.now();
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

    if (this.#debug)
      console.log(
        `[wb-products] Loading ${links.length} unique links from wb-result.json`,
      );

    await requestQueue.addRequests(createRequestQueueUrlArray(links));

    const crawler = await this.#createCrawler(
      requestQueue,
      links.length,
      cardDataMap,
    );

    await crawler.run(links);
    await requestQueue.drop();

    if (this.#debug) {
      const elapsed = Date.now() - startTime;
      const apiCount = this.#apiCount;
      const cheerioCount = links.length - apiCount;
      console.log(
        `[wb-products] Done: ${links.length} products in ${elapsed}ms, api=${apiCount} cheerio=${cheerioCount}`,
      );
    }
  }

  #apiCount = 0;

  async #createCrawler(
    requestQueue: RequestQueue,
    maxRequests: number,
    cardDataMap: Map<string, CardData>,
  ) {
    const SAFEGUARD_MAX_REQUESTS = 10;
    const debug = this.#debug;
    const incrementApiCount = () => this.#apiCount++;

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
        let usedApi = false;

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
              usedApi = true;
              incrementApiCount();
            } catch {
              if (debug)
                console.log(
                  `[wb-products] ${url} card.json fetch failed, falling back to Cheerio`,
                );
              productData = getWBProductData({} as WBCardJsonResponse, content);
            }
          }
        } else {
          productData = getWBProductData({} as WBCardJsonResponse, content);
        }

        if (debug) {
          const titleSnippet = productData.title
            ? productData.title.substring(0, 40)
            : '?';
          console.log(
            `[wb-products] ${url} api=${usedApi ? 'yes' : 'no'} title="${titleSnippet}" price=${productData.price} imgs=${productData.images.length}`,
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
    });
  }
}
