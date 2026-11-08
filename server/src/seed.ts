import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
async function main() {
  await db.quote.deleteMany();
  await db.quote.createMany({
    data: [
      {
        text: 'You do not have to solve the whole day at once.',
        author: 'Solace',
        tags: ['gentle', 'today'],
      },
      {
        text: 'A small pause can change the shape of a moment.',
        author: 'Solace',
        tags: ['pause'],
      },
      { text: 'Being here is already a form of care.', author: 'Solace', tags: ['care'] },
    ],
  });
}
main().finally(() => db.$disconnect());
