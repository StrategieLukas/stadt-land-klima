interface EventWithPossibleRequestShapes {
  req?: { text?: () => Promise<string> };
  request?: { text?: () => Promise<string> };
  node?: {
    req?: {
      on?: (event: string, cb: (chunk?: Buffer | string) => void) => void;
    };
  };
}

const DEFAULT_MAX_BODY_SIZE = 65536; // 64 KB

function parseJsonBody<T>(rawBody: string, maxSize?: number): T {
  if (!rawBody.trim()) return {} as T;

  // Enforce body size limit
  const byteLength = Buffer.byteLength(rawBody, 'utf8');
  const limit = maxSize ?? DEFAULT_MAX_BODY_SIZE;
  if (byteLength > limit) {
    throw createError({ statusCode: 413, message: 'Request-Body ist zu groß.' });
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw createError({ statusCode: 400, message: 'Ungültiger Request-Body.' });
  }
}

async function readNodeRequestBody(req: NonNullable<EventWithPossibleRequestShapes['node']>['req'], maxSize?: number): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let raw = '';
    let totalBytes = 0;
    const limit = maxSize ?? DEFAULT_MAX_BODY_SIZE;
    req?.on?.('data', (chunk) => {
      const segment = typeof chunk === 'string' ? chunk : chunk?.toString('utf8') || '';
      totalBytes += Buffer.byteLength(segment, 'utf8');
      if (totalBytes > limit) {
        reject(createError({ statusCode: 413, message: 'Request-Body ist zu groß.' }));
        return;
      }
      raw += segment;
    });
    req?.on?.('end', () => resolve(raw));
    req?.on?.('error', reject);
  });
}

export async function readRequestBody<T = Record<string, unknown>>(event: EventWithPossibleRequestShapes, maxSize?: number): Promise<T> {
  if (typeof event?.req?.text === 'function') {
    return parseJsonBody<T>(await event.req.text(), maxSize);
  }

  if (typeof event?.request?.text === 'function') {
    return parseJsonBody<T>(await event.request.text(), maxSize);
  }

  if (event?.node?.req?.on) {
    return parseJsonBody<T>(await readNodeRequestBody(event.node.req, maxSize), maxSize);
  }

  throw createError({ statusCode: 500, message: 'Request-Body konnte nicht gelesen werden.' });
}
