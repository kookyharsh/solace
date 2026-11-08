import { createApp } from './app.js';
import { readConfig } from './config.js';
import { db } from './db.js';

const config = readConfig();
const server = createApp(config, db).listen(config.PORT, () => {
  console.log(`Solace API listening on ${config.PORT}`);
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    });
  });
