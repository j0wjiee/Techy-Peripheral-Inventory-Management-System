import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
const prisma = new PrismaClient();
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
try {
  await prisma.$connect();
  const server = createApp(prisma).listen(port, host, () => console.log(`Techy API listening on ${host}:${port}`));
  server.on('error', async error => {
    console.error(error.code === 'EADDRINUSE'
      ? `Techy API port ${host}:${port} is already in use. Stop the existing development server with Ctrl+C before starting another copy.`
      : `Techy API could not listen on ${host}:${port} (${error.code ?? 'unknown error'}).`);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
} catch {
  console.error('MongoDB connection failed. Check DATABASE_URL and replica set availability.');
  await prisma.$disconnect();
  process.exitCode = 1;
}
