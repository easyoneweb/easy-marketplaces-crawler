import cron from 'node-cron';
import dotenv from 'dotenv';
import { RequestQueue } from 'crawlee';
import { WBCrawler } from './wildberries/wb-crawler';
import { WBFiles } from './wildberries/wb-files';
import { OZONCrawler } from './ozon/ozon-crawler';
import { OZONFiles } from './ozon/ozon-files';

dotenv.config();

const WB_SELLER_URL = process.env.WB_SELLER_URL || '';
const WB_CRAWLER_CRON = process.env.WB_CRAWLER_CRON || '0 */12 * * *';
const DEBUG = process.env.DEBUG === 'true';

const OZON_SELLER_URL = process.env.OZON_SELLER_URL || '';
const OZON_CRAWLER_CRON = process.env.OZON_CRAWLER_CRON || '0 */12 * * *';

export const wbCrawlerTask = cron.createTask(WB_CRAWLER_CRON, async () => {
  if (!WB_SELLER_URL) {
    console.log('[wb-crawler] WB_SELLER_URL is empty, skipping crawl');
    return;
  }

  const requestQueue = await RequestQueue.open();

  await requestQueue.addRequest({ url: WB_SELLER_URL });

  if (DEBUG) console.log('[wb] Catalog crawl starting...');

  const crawler = await new WBCrawler(DEBUG).createCrawler(requestQueue);
  const wbFiles = new WBFiles(DEBUG);

  await crawler.run([WB_SELLER_URL]);
  await crawler.exportData(__dirname + '/../public/data/wb-result.json');
  await requestQueue.drop();

  if (DEBUG) console.log('[wb] Catalog done, starting product crawl...');

  await wbFiles.saveFiles();
});

export const ozonCrawlerTask = cron.createTask(OZON_CRAWLER_CRON, async () => {
  if (!OZON_SELLER_URL) {
    console.log('[ozon-crawler] OZON_SELLER_URL is empty, skipping crawl');
    return;
  }

  const requestQueue = await RequestQueue.open();

  await requestQueue.addRequest({ url: OZON_SELLER_URL });

  if (DEBUG) console.log('[ozon] Catalog crawl starting...');

  const crawler = await new OZONCrawler(DEBUG).createCrawler(requestQueue);
  const ozonFiles = new OZONFiles(DEBUG);

  await crawler.run();
  await crawler.exportData(__dirname + '/../public/data/ozon-result.json');
  await requestQueue.drop();

  if (DEBUG) console.log('[ozon] Catalog done, starting product crawl...');

  await ozonFiles.saveFiles();
});
