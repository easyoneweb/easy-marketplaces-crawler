import cron from 'node-cron';
import dotenv from 'dotenv';
import { RequestQueue } from 'crawlee';
import { WBCrawler } from './wildberries/wb-crawler';
import { WBFiles } from './wildberries/wb-files';
import { OZONCrawler } from './ozon/ozon-crawler';
import { OZONFiles } from './ozon/ozon-files';

dotenv.config();

const WB_SELLER_URL = process.env.WB_SELLER_URL || '';
const WB_MAX_REQUESTS = Number(process.env.WB_MAX_REQUESTS) || 1000;
const WB_MAX_CONCURRENCY = Number(process.env.WB_MAX_CONCURRENCY) || 100;
const WB_SCROLL_TIMES = Number(process.env.WB_SCROLL_TIMES) || 15;
const WB_TIME_BETWEEN_SCROLLS = Number(process.env.WB_TIME_BETWEEN_SCROLLS) || 500;
const WB_ADDITIONAL_PARAMS_BUTTON_NAME = process.env.WB_ADDITIONAL_PARAMS_BUTTON_NAME || 'Все характеристики и описание';
const WB_CRAWLER_CRON = process.env.WB_CRAWLER_CRON || '0 */12 * * *';

const OZON_SELLER_URL = process.env.OZON_SELLER_URL || '';
const OZON_MAX_REQUESTS = Number(process.env.OZON_MAX_REQUESTS) || 1000;
const OZON_MAX_CONCURRENCY = Number(process.env.OZON_MAX_CONCURRENCY) || 100;
const OZON_SCROLL_TIMES = Number(process.env.OZON_SCROLL_TIMES) || 15;
const OZON_TIME_BETWEEN_SCROLLS = Number(process.env.OZON_TIME_BETWEEN_SCROLLS) || 500;
const OZON_CRAWLER_CRON = process.env.OZON_CRAWLER_CRON || '0 */12 * * *';

export const wbCrawlerTask = cron.schedule(WB_CRAWLER_CRON, async () => {
  const requestQueue = await RequestQueue.open();

  await requestQueue.addRequest({ url: WB_SELLER_URL });

  const crawler = new WBCrawler().createCrawler(requestQueue, WB_MAX_REQUESTS, WB_MAX_CONCURRENCY, WB_SCROLL_TIMES, WB_TIME_BETWEEN_SCROLLS);
  const wbFiles = new WBFiles();

  await crawler.run([ WB_SELLER_URL ]);
  await crawler.exportData(__dirname + '/../public/data/wb-result.json');
  await requestQueue.drop();
  
  await wbFiles.saveFiles(WB_MAX_CONCURRENCY, WB_ADDITIONAL_PARAMS_BUTTON_NAME);
}, {
  scheduled: false
});

export const ozonCrawlerTask = cron.schedule(OZON_CRAWLER_CRON, async () => {
  const requestQueue = await RequestQueue.open();

  await requestQueue.addRequest({ url: OZON_SELLER_URL });

  const crawler = new OZONCrawler().createCrawler(requestQueue, OZON_MAX_REQUESTS, OZON_MAX_CONCURRENCY, OZON_SCROLL_TIMES, OZON_TIME_BETWEEN_SCROLLS);
  const ozonFiles = new OZONFiles();

  await crawler.run();
  await crawler.exportData(__dirname + '/../public/data/ozon-result.json');
  await requestQueue.drop();
  
  await ozonFiles.saveFiles(OZON_MAX_CONCURRENCY);
}, {
  scheduled: false
});