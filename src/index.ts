import express, { Router } from 'express';
import morgan from 'morgan';
import { watchBlockChanges, processPreviousBlocks } from './_sequencing';
import { initConnection, checkIfItemExists, getItem, getAllKeys } from './utils/redis';
import { redisBlocksKey, redisTokensKey, redisTransactionsKey } from './constants';
import log from './log';

const app: express.Express = express();
const port = parseInt(process.env.PORT || '8006');

const router = Router();

router.get('/', (req, res) => {
  return res.status(200).json({
    message: 'Hello there!'
  });
});

router.get('/blocks', async (req, res) => {
  try {
    const blocksKeyExists = await checkIfItemExists(redisBlocksKey);
    let result = blocksKeyExists ? JSON.parse((await getItem(redisBlocksKey)) as string) : [];
    result = result.sort((a: any, b: any) => parseInt(a.number) - parseInt(b.number));
    result = {
      items: req.query.page
        ? result.slice((parseInt(req.query.page as string) - 1) * result.length, result.length)
        : result.slice(result.length > 25 ? result.length - 25 : 0, result.length),
      size: result.length
    };
    return res.status(200).json({ result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const transactionsKeyExists = await checkIfItemExists(redisTransactionsKey);
    let result = transactionsKeyExists ? JSON.parse((await getItem(redisTransactionsKey)) as string) : [];
    result = result.sort((a: any, b: any) => parseInt(a.blockNumber) - parseInt(b.blockNumber));
    result = {
      items: req.query.page
        ? result.slice((parseInt(req.query.page as string) - 1) * result.length, result.length)
        : result.slice(result.length > 25 ? result.length - 25 : 0, result.length),
      size: result.length
    };
    return res.status(200).json({ result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/transactions/:address', async (req, res) => {
  try {
    const transactionsKeyExists = await checkIfItemExists(redisTransactionsKey);
    let result = transactionsKeyExists ? JSON.parse((await getItem(redisTransactionsKey)) as string) : [];

    result = result
      .filter((txn: any) => txn.from === req.params.address || txn.to === req.params.address)
      .sort((a: any, b: any) => parseInt(b.blockNumber) - parseInt(a.blockNumber));

    result = {
      items: req.query.page
        ? result.slice((parseInt(req.query.page as string) - 1) * result.length, result.length)
        : result.slice(result.length > 25 ? result.length - 25 : 0, result.length),
      size: result.length
    };
    return res.status(200).json({ result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/tokens', async (req, res) => {
  try {
    const allRedisKeys = await getAllKeys();
    const filteredKeys = allRedisKeys.filter(key => key.startsWith(redisTokensKey));
    let result: any[] = [];

    for (const key of filteredKeys) {
      const token = await getItem(key);
      result = [...result, JSON.parse(token as string)];
    }
    return res.status(200).json({ result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
app.use(morgan('combined'));
app.use('/', router);

app.listen(port, async () => {
  log('App running on %d', port);
  await initConnection();
  watchBlockChanges();
  await processPreviousBlocks();
});
