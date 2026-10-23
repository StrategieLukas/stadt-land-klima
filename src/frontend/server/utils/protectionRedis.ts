import { createClient } from 'redis';

function newClient() {
  return createClient({
    url: process.env.REDIS_URL || 'redis://cache:6379', disableOfflineQueue: true,
    commandsQueueMaxLength: 128, socket: {connectTimeout: 1000, reconnectStrategy: false},
  });
}
type Client = ReturnType<typeof newClient>;
let client: Client | undefined;
let connection: Promise<Client> | undefined;
let retryAfter = 0;

export async function withProtectionRedis<T>(operation: (redis: Client) => Promise<T>): Promise<T> {
  if (!client?.isReady) {
    if (Date.now() < retryAfter) throw new Error('Request protection temporarily unavailable');
    if (!connection) {
      const pending = newClient();
      pending.on('error', () => {}); // Callers handle failures; never log credential-bearing URLs.
      client = pending;
      connection = pending.connect().then(() => pending).catch((error: unknown) => {
        retryAfter = Date.now() + 1000;
        if (pending.isOpen) pending.destroy();
        throw error;
      }).finally(() => { connection = undefined; });
    }
    await connection;
  }
  const active = client;
  if (!active?.isReady) throw new Error('Request protection temporarily unavailable');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(active),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          retryAfter = Date.now() + 1000;
          if (active.isOpen) active.destroy();
          reject(new Error('Request protection timed out'));
        }, 1500);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
