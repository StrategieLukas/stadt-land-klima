import { assert, assertEqual } from '../lib/assert.js';
import { DirectusClient } from '../lib/directus.js';
import type { TestFixture } from '../lib/fixture.js';
import type { TestRunner } from '../lib/runner.js';

/**
 * Regression tests for the contact spam investigation findings.
 *
 * Verifies that:
 * 1. The Frontend role cannot create feedback directly via Directus (bypass closed)
 * 2. The Nuxt contact endpoint rejects missing CAPTCHA
 * 3. The Nuxt contact endpoint rejects expired CAPTCHA
 * 4. The Nuxt contact endpoint rejects replayed CAPTCHA (single-use)
 * 5. A valid CAPTCHA allows one successful submission
 */
export async function runContactSpamSecurityFlow(
  runner: TestRunner,
  fixture: TestFixture,
): Promise<void> {
  // Load the Frontend token from the frontend .env
  const { readFileSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const frontendEnvPath = resolve(dirname(fixture.config.envPath), '..', 'frontend', '.env');
  let frontendEnv: Record<string, string> = {};
  try {
    const content = readFileSync(frontendEnvPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) frontendEnv[match[1]] = match[2]?.replace(/^"|"$/g, '') ?? '';
    }
  } catch { /* frontend .env not found */ }

  const frontendToken = fixture.config.env['DIRECTUS_FRONTEND_PUBLIC_TOKEN']
    || frontendEnv['DIRECTUS_FRONTEND_PUBLIC_TOKEN']
    || '';

  // Step 1: Verify Frontend role cannot create feedback directly via Directus
  await runner.step(
    'Contact spam: Frontend role cannot create feedback directly via Directus',
    async () => {
      if (frontendToken) {
        const frontendClient = new DirectusClient(fixture.config.backendUrl, frontendToken);
        let rejected = false;
        try {
          await frontendClient.request('POST', '/items/feedback', {
            body: {
              title: 'Security probe',
              content: 'Should be rejected',
              type: 'other',
              sender_name: 'Test',
              sender_contact: 'test@example.invalid',
            },
          });
        } catch (error) {
          rejected = error instanceof Error && /failed with (400|403):/.test(error.message);
        }
        assert(
          rejected,
          'Frontend role must not create feedback directly via Directus — CAPTCHA bypass must be closed',
        );
      } else {
        // Also verify via the policy API: check that the Frontend policy has no feedback.create
        const policies = await fixture.admin.request<Array<{
          name: string;
          permissions: Array<{ collection: string; action: string }>;
        }>>('GET', '/policies', {
          query: {
            filter: JSON.stringify({ name: { _eq: 'Frontend' } }),
            fields: 'name,permissions.collection,permissions.action',
            limit: 1,
          },
        });
        if (policies.length > 0) {
          const feedbackCreate = policies[0].permissions.find(
            (p) => p.collection === 'feedback' && p.action === 'create',
          );
          assertEqual(
            feedbackCreate,
            undefined,
            'Frontend policy must not include feedback.create permission',
          );
        }
      }
    },
  );

  // Step 2: Verify anonymous Directus client cannot create feedback
  await runner.step(
    'Contact spam: anonymous role cannot create feedback directly via Directus',
    async () => {
      const anonymousClient = new DirectusClient(fixture.config.backendUrl);
      let rejected = false;
      try {
        await anonymousClient.request('POST', '/items/feedback', {
          body: {
            title: 'Anonymous probe',
            content: 'Should be rejected',
            type: 'other',
            sender_name: 'Test',
            sender_contact: 'test@example.invalid',
          },
        });
      } catch (error) {
        rejected = error instanceof Error && /failed with (400|403):/.test(error.message);
      }
      assert(
        rejected,
        'Anonymous role must not create feedback directly via Directus',
      );
    },
  );

  // Steps 3-6: Test the Nuxt contact endpoint CAPTCHA behavior
  // We need the frontend URL for these tests
  const frontendUrl = fixture.config.frontendUrl;

  // Step 3: Missing CAPTCHA is rejected
  await runner.step(
    'Contact spam: Nuxt contact endpoint rejects missing CAPTCHA',
    async () => {
      const response = await fetch(`${frontendUrl}/api/submit-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test without CAPTCHA',
          type: 'suggestion',
          content: 'This should be rejected',
          name: 'Test User',
          contact: 'test@example.invalid',
        }),
      });
      assert(
        response.status === 400,
        `Missing CAPTCHA must be rejected with 400, got ${response.status}`,
      );
    },
  );

  // Step 4: Invalid/malformed CAPTCHA is rejected
  await runner.step(
    'Contact spam: Nuxt contact endpoint rejects malformed CAPTCHA',
    async () => {
      const response = await fetch(`${frontendUrl}/api/submit-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test with bad CAPTCHA',
          type: 'suggestion',
          content: 'This should be rejected',
          name: 'Test User',
          contact: 'test@example.invalid',
          altcha: 'not-a-valid-base64-payload',
        }),
      });
      assert(
        response.status === 400,
        `Malformed CAPTCHA must be rejected with 400, got ${response.status}`,
      );
    },
  );

  // Step 5: Get a valid challenge, use it once (should succeed), then replay (should fail)
  await runner.step(
    'Contact spam: CAPTCHA is single-use — replay is rejected',
    async () => {
      // Fetch a fresh challenge
      const challengeResp = await fetch(`${frontendUrl}/api/altcha?purpose=contact`);
      assertEqual(challengeResp.status, 200, 'Challenge endpoint must return 200');
      const challenge = await challengeResp.json();
      assert(challenge.challenge, 'Challenge must contain a challenge hash');

      // Solve the proof-of-work: find the number that produces the challenge
      const { createHash } = await import('node:crypto');
      const salt = challenge.salt;
      const maxNumber = challenge.maxnumber;
      let solutionNumber: number | null = null;

      // Brute-force the solution (maxNumber is small: 100,000)
      for (let i = 0; i < maxNumber; i++) {
        const hash = createHash('SHA-256').update(`${salt}${i}`).digest('hex');
        if (hash === challenge.challenge) {
          solutionNumber = i;
          break;
        }
      }
      assert(solutionNumber !== null, 'Must find the challenge solution');

      // Build the proof payload
      const proof = {
        algorithm: challenge.algorithm,
        challenge: challenge.challenge,
        number: solutionNumber,
        salt: challenge.salt,
        signature: challenge.signature,
        purpose: 'contact',
        expires_at: challenge.expires_at,
      };
      const altchaB64 = Buffer.from(JSON.stringify(proof)).toString('base64');

      // First submission — should succeed
      const firstResp = await fetch(`${frontendUrl}/api/submit-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `CAPTCHA test ${fixture.config.runId}`,
          type: 'suggestion',
          content: 'First submission with valid CAPTCHA',
          name: 'Test User',
          contact: 'test@example.invalid',
          altcha: altchaB64,
        }),
      });
      assert(
        firstResp.status === 200,
        `First submission with valid CAPTCHA must succeed, got ${firstResp.status}: ${await firstResp.text()}`,
      );

      // Second submission with the same proof — must be rejected (single-use)
      const secondResp = await fetch(`${frontendUrl}/api/submit-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `CAPTCHA replay test ${fixture.config.runId}`,
          type: 'suggestion',
          content: 'Replay of consumed CAPTCHA',
          name: 'Test User',
          contact: 'test@example.invalid',
          altcha: altchaB64,
        }),
      });
      assert(
        secondResp.status === 400,
        `Replayed CAPTCHA must be rejected with 400, got ${secondResp.status}: ${await secondResp.text()}`,
      );
      for (const algorithm of ['SHA-512', 'arbitrary-replay-key']) {
        const mutated = Buffer.from(JSON.stringify({...proof, algorithm})).toString('base64');
        const response = await fetch(`${frontendUrl}/api/submit-feedback`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({title: 'Replay variant', type: 'other', content: 'Rejected algorithm replay', name: 'Test', contact: 'test@example.invalid', altcha: mutated})});
        assertEqual(response.status, 400, 'Changing the algorithm must not evade single-use consumption');
      }

    },
  );

  // Step 6: Expired CAPTCHA is rejected
  await runner.step(
    'Contact spam: Nuxt contact endpoint rejects expired CAPTCHA',
    async () => {
      // Fetch a fresh challenge
      const challengeResp = await fetch(`${frontendUrl}/api/altcha?purpose=contact`);
      const challenge = await challengeResp.json();

      const { createHash } = await import('node:crypto');
      const salt = challenge.salt;
      const maxNumber = challenge.maxnumber;
      let solutionNumber: number | null = null;

      for (let i = 0; i < maxNumber; i++) {
        const hash = createHash('SHA-256').update(`${salt}${i}`).digest('hex');
        if (hash === challenge.challenge) {
          solutionNumber = i;
          break;
        }
      }
      assert(solutionNumber !== null, 'Must find the challenge solution');

      // Build a proof with an already-expired timestamp
      const expiredProof = {
        algorithm: challenge.algorithm,
        challenge: challenge.challenge,
        number: solutionNumber,
        salt: challenge.salt,
        signature: challenge.signature,
        purpose: 'contact',
        expires_at: Date.now() - 60_000, // 1 minute ago
      };
      const altchaB64 = Buffer.from(JSON.stringify(expiredProof)).toString('base64');

      const response = await fetch(`${frontendUrl}/api/submit-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Expired CAPTCHA test ${fixture.config.runId}`,
          type: 'suggestion',
          content: 'Expired CAPTCHA should be rejected',
          name: 'Test User',
          contact: 'test@example.invalid',
          altcha: altchaB64,
        }),
      });
      assert(
        response.status === 400,
        `Expired CAPTCHA must be rejected with 400, got ${response.status}: ${await response.text()}`,
      );
    },
  );

  // Step 7: Wrong-purpose CAPTCHA is rejected
  await runner.step(
    'Contact spam: CAPTCHA with wrong purpose is rejected',
    async () => {
      // Fetch a challenge with purpose=register
      const challengeResp = await fetch(`${frontendUrl}/api/altcha?purpose=register`);
      const challenge = await challengeResp.json();

      const { createHash } = await import('node:crypto');
      const salt = challenge.salt;
      const maxNumber = challenge.maxnumber;
      let solutionNumber: number | null = null;

      for (let i = 0; i < maxNumber; i++) {
        const hash = createHash('SHA-256').update(`${salt}${i}`).digest('hex');
        if (hash === challenge.challenge) {
          solutionNumber = i;
          break;
        }
      }
      assert(solutionNumber !== null, 'Must find the challenge solution');

      const wrongPurposeProof = {
        algorithm: challenge.algorithm,
        challenge: challenge.challenge,
        number: solutionNumber,
        salt: challenge.salt,
        signature: challenge.signature,
        purpose: 'contact', // Forged top-level purpose cannot override the signed salt
        expires_at: challenge.expires_at,
      };
      const altchaB64 = Buffer.from(JSON.stringify(wrongPurposeProof)).toString('base64');

      const response = await fetch(`${frontendUrl}/api/submit-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Wrong purpose test ${fixture.config.runId}`,
          type: 'suggestion',
          content: 'Wrong purpose should be rejected',
          name: 'Test User',
          contact: 'test@example.invalid',
          altcha: altchaB64,
        }),
      });
      assert(
        response.status === 400,
        `Wrong-purpose CAPTCHA must be rejected with 400, got ${response.status}: ${await response.text()}`,
      );
    },
  );

  // Step 8: Invalid feedback type is rejected
  await runner.step(
    'Contact spam: Nuxt contact endpoint rejects invalid type',
    async () => {
      const response = await fetch(`${frontendUrl}/api/submit-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test',
          type: 'malicious-type',
          content: 'Should be rejected',
          name: 'Test User',
          contact: 'test@example.invalid',
          altcha: 'dGVzdA==',
        }),
      });
      assert(
        response.status === 400,
        `Invalid type must be rejected with 400, got ${response.status}`,
      );
    },
  );

  // Step 9: Invalid email format is rejected
  await runner.step(
    'Contact spam: Nuxt contact endpoint rejects invalid email',
    async () => {
      const response = await fetch(`${frontendUrl}/api/submit-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test',
          type: 'suggestion',
          content: 'Should be rejected',
          name: 'Test User',
          contact: 'not-an-email',
          altcha: 'dGVzdA==',
        }),
      });
      assert(
        response.status === 400,
        `Invalid email must be rejected with 400, got ${response.status}`,
      );
    },
  );

  // Step 10: Oversized title field is rejected
  await runner.step(
    'Contact spam: Nuxt contact endpoint rejects oversized title',
    async () => {
      const response = await fetch(`${frontendUrl}/api/submit-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'A'.repeat(300), // Exceeds MAX_TITLE_LENGTH (200)
          type: 'suggestion',
          content: 'Test',
          name: 'Test User',
          contact: 'test@example.invalid',
          altcha: 'dGVzdA==',
        }),
      });
      assert(
        response.status === 400,
        `Oversized title must be rejected with 400, got ${response.status}`,
      );
    },
  );

  // Step 11: Oversized content field is rejected
  await runner.step(
    'Contact spam: Nuxt contact endpoint rejects oversized content',
    async () => {
      const response = await fetch(`${frontendUrl}/api/submit-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test',
          type: 'suggestion',
          content: 'X'.repeat(6000), // Exceeds MAX_CONTENT_LENGTH (5000)
          name: 'Test User',
          contact: 'test@example.invalid',
          altcha: 'dGVzdA==',
        }),
      });
      assert(
        response.status === 400,
        `Oversized content must be rejected with 400, got ${response.status}`,
      );
    },
  );

  // Step 12: Missing required fields are rejected
  await runner.step(
    'Contact spam: Nuxt contact endpoint rejects missing required fields',
    async () => {
      const response = await fetch(`${frontendUrl}/api/submit-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '',
          type: '',
          content: '',
          name: '',
          contact: '',
        }),
      });
      assert(
        response.status === 400,
        `Missing required fields must be rejected with 400, got ${response.status}`,
      );
    },
  );

  // Step 13: JSON null payload is handled gracefully (not a crash)
  await runner.step(
    'Contact spam: Nuxt contact endpoint handles JSON null gracefully',
    async () => {
      const response = await fetch(`${frontendUrl}/api/submit-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(null),
      });
      assert(
        response.status === 400,
        `Null JSON payload must be rejected with 400, not crash, got ${response.status}`,
      );
    },
  );
}
