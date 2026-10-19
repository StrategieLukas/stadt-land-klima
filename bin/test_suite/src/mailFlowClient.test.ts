import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sendDirectusMailFlow } from '../../../src/frontend/server/utils/sendDirectusMailFlow.js';

const triggerPath = '/flows/trigger/11111111-1111-4111-8111-111111111111';

async function withServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  run: (origin: string) => Promise<void>,
) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test('mail caller authenticates and preserves payload under a Directus base path', async () => {
  const requests: Array<{
    url?: string;
    authorization?: string;
    body: string;
  }> = [];
  await withServer(
    async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      requests.push({
        url: req.url,
        authorization: req.headers.authorization,
        body,
      });
      res.writeHead(204).end();
    },
    async (origin) => {
      const payload = {
        to: 'test@example.invalid',
        data: { passwordResetUrl: 'https://example.invalid/reset?token=test' },
      };
      await sendDirectusMailFlow(
        `${origin}/backend${triggerPath}`,
        `${origin}/backend/`,
        'private-test-token',
        payload,
      );
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, `/backend${triggerPath}`);
      assert.equal(requests[0].authorization, 'Bearer private-test-token');
      assert.deepEqual(JSON.parse(requests[0].body), payload);
    },
  );
});

test('mail caller resolves public webhook aliases through the configured private Directus origin', async () => {
  let requests = 0;
  await withServer(
    (req, res) => {
      requests += 1;
      assert.equal(req.url, `/private${triggerPath}`);
      assert.equal(
        req.headers.authorization,
        'Bearer private-alias-test-token',
      );
      res.writeHead(204).end();
    },
    async (origin) => {
      await sendDirectusMailFlow(
        `https://example.invalid/backend${triggerPath}/`,
        `${origin}/private`,
        'private-alias-test-token',
        {},
      );
      assert.equal(requests, 1);
    },
  );
});

test('mail caller refuses URL credentials, query strings and non-trigger routes before sending', async () => {
  let requests = 0;
  await withServer(
    (_req, res) => {
      requests += 1;
      res.end();
    },
    async (origin) => {
      for (const url of [
        `http://example.invalid/items/candidate`,
        `${origin.replace('http://', 'http://user:password@')}${triggerPath}`,
        `${origin}${triggerPath}?access_token=untrusted`,
        `${origin}${triggerPath}#fragment`,
        `${origin}/items/candidate`,
        `${origin}${triggerPath}/unexpected-tail`,
      ]) {
        await assert.rejects(
          sendDirectusMailFlow(url, origin, 'private-test-token', {}),
        );
      }
      await assert.rejects(
        sendDirectusMailFlow(`${origin}${triggerPath}`, origin, '', {}),
      );
      assert.equal(requests, 0);
    },
  );
});

test('mail caller does not follow redirects or silently accept mail failures', async () => {
  const paths: string[] = [];
  await withServer(
    (req, res) => {
      paths.push(req.url || '');
      if (paths.length === 1)
        res.writeHead(307, { Location: '/credential-leak' }).end();
      else res.writeHead(503).end();
    },
    async (origin) => {
      await assert.rejects(
        sendDirectusMailFlow(
          `${origin}${triggerPath}`,
          origin,
          'private-test-token',
          {},
        ),
      );
      assert.deepEqual(paths, [triggerPath]);
      await assert.rejects(
        sendDirectusMailFlow(
          `${origin}${triggerPath}`,
          origin,
          'private-test-token',
          {},
        ),
        /HTTP 503/,
      );
      assert.deepEqual(paths, [triggerPath, triggerPath]);
    },
  );
});
