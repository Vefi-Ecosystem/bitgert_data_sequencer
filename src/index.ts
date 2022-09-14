import { watchBlockChanges, processPreviousBlocks } from './_sequencing';
import { initConnection } from './utils/redis';

// const app: express.Express = express();
// const port = parseInt(process.env.PORT || '8005');



// app.listen(port, async () => {
//   log('App running on %d', port);
//   await initConnection();
//   watchBlockChanges();
//   await processPreviousBlocks();
// });

(async () => {
  await initConnection();
  watchBlockChanges();
  await processPreviousBlocks();
})();
