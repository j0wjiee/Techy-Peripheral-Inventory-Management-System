import 'dotenv/config';
import net from 'node:net';

const ports = [
  { name: 'API', port: Number(process.env.PORT ?? 3001), host: process.env.HOST ?? '127.0.0.1' },
  { name: 'frontend', port: 5173, host: '127.0.0.1' }
];
for (const { name, port, host } of ports) {
  try {
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', reject);
      probe.listen(port, host, () => probe.close(resolve));
    });
  } catch (error) {
    console.error(error.code === 'EADDRINUSE'
      ? `Techy ${name} port ${host}:${port} is already in use. Stop the existing npm run dev terminal with Ctrl+C, then retry.`
      : `Cannot use Techy ${name} port ${host}:${port} (${error.code ?? 'unknown error'}).`);
    process.exitCode = 1;
    break;
  }
}
