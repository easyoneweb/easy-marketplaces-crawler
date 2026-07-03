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
  StockInfo,
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
      requestHandlerTimeoutSecs: 180,
      async requestHandler({ request, page }) {
        const url = request.loadedUrl;
        const fileName = url.split('/')[4];
        const stockDest = process.env.WB_STOCK_DEST || '-1257786';

        await page.waitForTimeout(2000);

        try {
          await page.waitForSelector('img[data-src-pb]', { timeout: 30000 });
        } catch {
          // page didn't render product content — proceed with whatever HTML we have
        }

        const content = await page.content();

        const cardData = cardDataMap.get(url);
        const nmId = cardData?.nmId || '';
        const imagePbUrl = cardData?.imagePbUrl;
        let productData: Product = {
          title: '',
          price: '0',
          images: [],
          params: [],
        };
        let usedApi = false;

        // Fetch stock and card.json APIs in parallel (independent requests)
        let stockPromise: Promise<Array<StockInfo> | undefined> =
          Promise.resolve(undefined);
        if (nmId) {
          stockPromise = (async () => {
            try {
              const stockApiResponse = await page.request.get(
                `https://card.wb.ru/cards/v2/detail?appType=1&curr=rub&dest=${stockDest}&spp=30&nm=${nmId}`,
                { timeout: 10000 },
              );
              if (stockApiResponse.ok()) {
                const stockJson = await stockApiResponse.json();
                const raw = stockJson as {
                  data?: {
                    products?: Array<{
                      sizes?: Array<{
                        stocks?: Array<{ wh: number; qty: number }>;
                      }>;
                    }>;
                  };
                };
                if (raw?.data?.products?.length) {
                  const product = raw.data.products[0];
                  const stockMap = new Map<number, StockInfo>();
                  if (Array.isArray(product.sizes)) {
                    for (const size of product.sizes) {
                      if (Array.isArray(size.stocks)) {
                        for (const s of size.stocks) {
                          if (!stockMap.has(s.wh)) {
                            stockMap.set(s.wh, {
                              warehouseId: s.wh,
                              quantity: s.qty,
                            });
                          } else {
                            const existing = stockMap.get(s.wh);
                            if (existing) {
                              existing.quantity =
                                (existing.quantity || 0) + s.qty;
                            }
                          }
                        }
                      }
                    }
                  }
                  return [...stockMap.values()];
                }
              }
            } catch {
              // stock API not available — will try DOM extraction
            }
            return undefined;
          })();
        }

        let cardJsonPromise: Promise<
          { success: true; json: WBCardJsonResponse } | { success: false }
        > = Promise.resolve({ success: false });
        if (imagePbUrl) {
          const apiUrl = buildCardJsonUrl(imagePbUrl);
          if (apiUrl) {
            cardJsonPromise = (async () => {
              try {
                const apiResponse = await page.request.get(apiUrl, {
                  timeout: 10000,
                });
                if (!apiResponse.ok()) {
                  throw new Error(`HTTP ${apiResponse.status()}`);
                }
                return {
                  success: true as const,
                  json: (await apiResponse.json()) as WBCardJsonResponse,
                };
              } catch {
                if (debug)
                  console.log(
                    `[wb-products] ${url} card.json fetch failed, falling back to Cheerio`,
                  );
                return { success: false as const };
              }
            })();
          }
        }

        const [stockData, cardJsonResult] = await Promise.all([
          stockPromise,
          cardJsonPromise,
        ]);

        if (cardJsonResult.success) {
          productData = getWBProductData(
            cardJsonResult.json,
            content,
            stockData,
          );
          usedApi = true;
          incrementApiCount();
        } else {
          productData = getWBProductData(
            {} as WBCardJsonResponse,
            content,
            stockData,
          );
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
