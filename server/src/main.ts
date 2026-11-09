import { createApp } from './app.js';
import { readConfig } from './config.js';
import { db } from './db.js';
import { dispatchContextualNotifications } from './notifications.js';

const config = readConfig();
const server = createApp(config, db).listen(config.PORT, '0.0.0.0', () => {
  console.log(`Solace API listening on http://0.0.0.0:${config.PORT}`);
});
void dispatchContextualNotifications(db, config).catch(error => console.error('Notification dispatch failed', error));
const notificationTimer = setInterval(
  () => {
    void dispatchContextualNotifications(db, config).catch(error => console.error('Notification dispatch failed', error));
  },
  60 * 1000,
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => {
      clearInterval(notificationTimer);
      void db.$disconnect().then(() => process.exit(0));
    });
  });
