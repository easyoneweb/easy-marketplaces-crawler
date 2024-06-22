import cron from 'node-cron';
import dotenv from 'dotenv';
import { WBCrawler } from './wildberries/wb-crawler';
import { WBFiles } from './wildberries/wb-files';

dotenv.config();

export const wbCrawlerTask = cron.schedule('0 */12 * * *', async () => {
  const maxRequests = Number(process.env.WB_MAX_REQUESTS) || 1000;
  const scrollTimes = Number(process.env.WB_SCROLL_TIMES) || 15;
  const timeBetweenScrolls = Number(process.env.WB_TIME_BETWEEN_SCROLLS) || 500;

  const crawler = new WBCrawler().createCrawler(maxRequests, scrollTimes, timeBetweenScrolls);
  const wbFiles = new WBFiles();

  await crawler.run([ process.env.WB_SELLER_URL || '' ]);
  await crawler.exportData(__dirname + '/../public/data/result.json');
  await wbFiles.saveFiles();
}, {
  scheduled: false
});