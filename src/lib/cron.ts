import cron from 'node-cron';
import dotenv from 'dotenv';
import { WBCrawler } from './wildberries/wb-crawler';
import { WBFiles } from './wildberries/wb-files';

dotenv.config();

const WB_SELLER_URL = process.env.WB_SELLER_URL || '';
const WB_MAX_REQUESTS = Number(process.env.WB_MAX_REQUESTS) || 1000;
const WB_MAX_CONCURRENCY = Number(process.env.WB_MAX_CONCURRENCY) || 100;
const WB_SCROLL_TIMES = Number(process.env.WB_SCROLL_TIMES) || 15;
const WB_TIME_BETWEEN_SCROLLS = Number(process.env.WB_TIME_BETWEEN_SCROLLS) || 500;
const WB_ADDITIONAL_PARAMS_BUTTON_NAME = process.env.WB_ADDITIONAL_PARAMS_BUTTON_NAME || 'Все характеристики и описание';
const WB_CRAWLER_CRON = process.env.WB_CRAWLER_CRON || '0 */12 * * *';

export const wbCrawlerTask = cron.schedule(WB_CRAWLER_CRON, async () => {
  const crawler = new WBCrawler().createCrawler(WB_MAX_REQUESTS, WB_MAX_CONCURRENCY, WB_SCROLL_TIMES, WB_TIME_BETWEEN_SCROLLS);
  const wbFiles = new WBFiles();

  await crawler.run([ WB_SELLER_URL ]);
  await crawler.exportData(__dirname + '/../public/data/result.json');
  await wbFiles.saveFiles(WB_MAX_CONCURRENCY, WB_ADDITIONAL_PARAMS_BUTTON_NAME);
}, {
  scheduled: false
});