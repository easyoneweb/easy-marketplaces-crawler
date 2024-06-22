import fs from 'fs';
import express, { Express } from 'express';
import dotenv from 'dotenv';
import { wbCrawlerTask } from './lib/cron';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname + '/public'));

wbCrawlerTask.start();

app.get('/files', async (req, res) => {
  let files = fs.readdirSync(__dirname + '/public');
  
  files = files.filter(file => file !== 'data');

  res.status(200).json({ message: 'success', files: files });
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});