import express from 'express';

const app: express.Express = express();
const port = parseInt(process.env.PORT || '8006');

app.listen(port, () => console.log(`Express server started on port - ${port}`));