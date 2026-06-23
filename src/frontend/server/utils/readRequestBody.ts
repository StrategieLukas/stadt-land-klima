interface EventWithPossibleRequestShapes {
  req?: { text?: () => Promise<string> };
  request?: { text?: () => Promise<string> };
  node?: {
    req?: {
      on?: (event: string, cb: (chunk?: Buffer | string) => void) => void;
    };
  };
}

function parseJsonBody<T>(rawBody: string): T {
  if (!rawBody.trim()) return {} as T;

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw createError({ statusCode: 400, message: 'Ungültiger Request-Body.' });
  }
}

async function readNodeRequestBody(req: NonNullable<EventWithPossibleRequestShapes['node']>['req']): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let raw = '';
    req?.on?.('data', (chunk) => {
      raw += typeof chunk === 'string' ? chunk : chunk?.toString('utf8') || '';
    });
    req?.on?.('end', () => resolve(raw));
    req?.on?.('error', reject);
  });
}

export async function readRequestBody<T = Record<string, unknown>>(event: EventWithPossibleRequestShapes): Promise<T> {
  if (typeof event?.req?.text === 'function') {
    return parseJsonBody<T>(await event.req.text());
  }

  if (typeof event?.request?.text === 'function') {
    return parseJsonBody<T>(await event.request.text());
  }

  if (event?.node?.req?.on) {
    return parseJsonBody<T>(await readNodeRequestBody(event.node.req));
  }

  throw createError({ statusCode: 500, message: 'Request-Body konnte nicht gelesen werden.' });
}
