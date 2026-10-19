import { assert } from './assert.js';
import { waitFor } from './wait.js';

/** Optional SMTP capture for development runs; never fetches a production inbox. */
export async function capturedMail(
  subject: string,
  recipient?: string,
): Promise<{ HTML: string; Text: string }> {
  const base = process.env.TEST_MAILPIT_URL?.replace(/\/+$/, '');
  assert(base, 'TEST_MAILPIT_URL is required for SMTP capture checks');
  const message = await waitFor(
    'matching message in the test SMTP capture',
    async () => {
      const response = await fetch(`${base}/api/v1/messages?limit=200`);
      assert(response.ok, 'Test SMTP capture must be reachable');
      const data = (await response.json()) as {
        messages: Array<{
          ID: string;
          Subject: string;
          To: Array<{ Address: string }>;
        }>;
      };
      return data.messages.find(
        (item) =>
          item.Subject === subject &&
          (!recipient ||
            item.To.some((address) => address.Address === recipient)),
      );
    },
  );
  const response = await fetch(
    `${base}/api/v1/message/${encodeURIComponent(message.ID)}`,
  );
  assert(response.ok, 'Captured mail content must be readable');
  return (await response.json()) as { HTML: string; Text: string };
}
