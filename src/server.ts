import fs from 'fs';
import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { wbCrawlerTask, ozonCrawlerTask } from './lib/cron';
import { crawlSingleOzonProduct, updateOzonCookies, closeBrowser } from './lib/ozon/ozon-api';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname + '/public'));

if (process.env.WB_SELLER_URL) {
  wbCrawlerTask.start();
  console.log('[server] WB crawler scheduled');
}

if (process.env.OZON_SELLER_URL) {
  ozonCrawlerTask.start();
  console.log('[server] OZON crawler scheduled');
}

app.get('/files', async (req, res) => {
  let files = fs.readdirSync(__dirname + '/public');

  files = files.filter((file) => file !== 'data');

  res.status(200).json({ message: 'success', files: files });
});

function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.CRAWLER_API_KEY) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  next();
}

app.post('/api/v1/crawl/ozon/product', requireApiKey, async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ success: false, error: 'Missing or invalid "url" field' });
    return;
  }

  if (!/^https:\/\/www\.ozon\.ru\/product\//.test(url)) {
    res.status(400).json({ success: false, error: 'Invalid Ozon product URL' });
    return;
  }

  try {
    const data = await crawlSingleOzonProduct(url);
    res.status(200).json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Crawl failed';
    res.status(500).json({ success: false, error: message });
  }
});

app.post('/api/v1/crawl/ozon/cookies', requireApiKey, async (req: Request, res: Response) => {
  const { cookie } = req.body;

  if (!cookie || typeof cookie !== 'string' || !cookie.trim()) {
    res.status(400).json({ success: false, error: 'Missing or empty "cookie" field' });
    return;
  }

  try {
    const count = await updateOzonCookies(cookie);
    res.status(200).json({ success: true, count });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cookie update failed';
    res.status(500).json({ success: false, error: message });
  }
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
