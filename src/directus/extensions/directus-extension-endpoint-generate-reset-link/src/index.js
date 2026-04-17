/**
 * Generates a Directus password-reset link for an existing user and returns
 * the URL without sending any email.  Used by the registration flow so we
 * can embed the link directly in the welcome email instead of sending two
 * separate emails.
 *
 * POST /generate-reset-link
 * Body: { "email": "user@example.com" }
 * Returns: { "url": "https://.../admin/reset-password?token=..." }
 *
 * Requires an admin Bearer token (req.accountability.admin === true).
 */

import jwt from 'jsonwebtoken';

/** Replicates Directus's internal getSimpleHash() used for password-reset tokens. */
function getSimpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; hash &= hash) {
    hash = 31 * hash + str.charCodeAt(i++);
  }
  return Math.abs(hash).toString(16);
}

export default {
  id: 'generate-reset-link',
  handler: (router, { env, database }) => {
    router.post('/', async (req, res) => {
      // Only allow admin callers (static admin token or admin user)
      if (!req.accountability?.admin) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { email } = req.body ?? {};
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid "email" field' });
      }

      const secret = env.SECRET;
      if (!secret) {
        return res.status(503).json({ error: 'Server configuration error: Directus SECRET is not set' });
      }

      // Look up the user – must exist and be active
      const user = await database('directus_users')
        .where('email', email.trim().toLowerCase())
        .where('status', 'active')
        .first()
        .catch(() => null);

      if (!user) {
        // Return 404 so the caller can decide whether to fall back
        return res.status(404).json({ error: 'User not found or not active' });
      }

      // Replicate exactly what Directus does in UsersService.requestPasswordReset()
      const payload = {
        email: user.email,
        scope: 'password-reset',
        hash: getSimpleHash('' + user.password),
      };
      const token = jwt.sign(payload, secret, { expiresIn: '1d', issuer: 'directus' });

      const publicUrl = (env.PUBLIC_URL || '').replace(/\/$/, '');
      const url = `${publicUrl}/admin/reset-password?token=${token}`;

      return res.json({ url });
    });
  },
};
