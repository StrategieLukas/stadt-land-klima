import path from 'path';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';
import readYamlFile from '../shared/readYamlFile.mjs';

const RETRYABLE_SCHEMA_STATUSES = new Set([408, 429, 502, 503, 504]);

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getRetryConfig() {
  return {
    attempts: readPositiveInt(process.env.DIRECTUS_SCHEMA_IMPORT_MAX_ATTEMPTS, 6),
    applyDelayMs: readNonNegativeInt(process.env.DIRECTUS_SCHEMA_IMPORT_APPLY_DELAY_MS, 1000),
    baseDelayMs: readPositiveInt(process.env.DIRECTUS_SCHEMA_IMPORT_RETRY_DELAY_MS, 2000),
    maxDelayMs: readPositiveInt(process.env.DIRECTUS_SCHEMA_IMPORT_MAX_RETRY_DELAY_MS, 30000),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(headerValue) {
  if (!headerValue) {
    return null;
  }

  const seconds = Number.parseInt(headerValue, 10);
  if (Number.isFinite(seconds)) {
    return seconds * 1000;
  }

  const date = Date.parse(headerValue);
  if (!Number.isNaN(date)) {
    return Math.max(date - Date.now(), 0);
  }

  return null;
}

function getRetryDelayMs(attempt, retryAfterMs, retryConfig) {
  if (retryAfterMs !== null) {
    return Math.min(retryAfterMs, retryConfig.maxDelayMs);
  }

  const delay = retryConfig.baseDelayMs * (2 ** (attempt - 1));

  return Math.min(delay, retryConfig.maxDelayMs);
}

function getErrorSummary(body) {
  if (!body.trim()) {
    return '';
  }

  try {
    const parsed = JSON.parse(body);
    const firstError = parsed.errors?.[0];

    if (firstError) {
      return [
        firstError.extensions?.code,
        firstError.message,
      ].filter(Boolean).join(': ');
    }
  } catch (err) {
    // Fall back to a compact raw response below.
  }

  return body.replace(/\s+/g, ' ').substring(0, 200);
}

function createSchemaRequestError(label, status, body, retryAfterMs) {
  const summary = getErrorSummary(body);
  const error = new Error(summary ? `${label} failed with HTTP ${status}: ${summary}` : `${label} failed with HTTP ${status}`);

  error.label = label;
  error.status = status;
  error.body = body;
  error.retryAfterMs = retryAfterMs;
  error.retryable = RETRYABLE_SCHEMA_STATUSES.has(status);

  return error;
}

function createSchemaNetworkError(label, cause) {
  const error = new Error(`${label} request failed: ${cause.message}`);

  error.label = label;
  error.cause = cause;
  error.retryable = true;

  return error;
}

function createSchemaParseError(label, status, body, cause) {
  const error = new Error(`Failed to parse ${label.toLowerCase()} response: ${cause.message}`);

  error.label = label;
  error.status = status;
  error.body = body;
  error.retryable = false;

  return error;
}

async function postSchemaRequest(label, url, body) {
  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw createSchemaNetworkError(label, err);
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw createSchemaRequestError(
      label,
      response.status,
      responseText,
      parseRetryAfterMs(response.headers.get('retry-after'))
    );
  }

  return {
    status: response.status,
    text: responseText,
  };
}

function logFinalSchemaError(err) {
  if (err.status) {
    if (err.message) {
      console.error(err.message);
    }

    console.error(`${err.label} error:`, err.status, err.body);
    return;
  }

  console.error(err);
}

function getRetryReason(err) {
  if (!err.status) {
    return `failed: ${err.message}`;
  }

  const summary = getErrorSummary(err.body);

  return `returned HTTP ${err.status}${summary ? ` (${summary})` : ''}`;
}

async function runSchemaImport(src, options, client, retryConfig) {
  const header = readYamlFile(path.join(src, 'header.yaml'));
  const collections = readYamlFiles(path.join(src, 'collections'));
  const fields = readYamlFiles(path.join(src, 'fields'));
  const relations = readYamlFiles(path.join(src, 'relations'));
  const schema = Object.assign({}, header, {
    collections: collections,
    fields: fields,
    relations: relations,
  });

  if (options.verbose) {
    console.info('Applying schema...');
  }

  // Use REST API directly for schema operations
  let diffUrl = new URL('/schema/diff?force=true', client.url).toString();
  let applyUrl = new URL('/schema/apply?force=true', client.url).toString();

  // First, try schema/diff
  const diffResponse = await postSchemaRequest('Schema diff', diffUrl, schema);

  // Handle 204 No Content (schema already matches)
  if (diffResponse.status === 204 || !diffResponse.text.trim()) {
    if (options.verbose) {
      console.info('No schema differences. Done.');
    }
    return;
  }

  let diffData;

  try {
    diffData = JSON.parse(diffResponse.text);
  } catch (e) {
    throw createSchemaParseError('Schema diff', diffResponse.status, diffResponse.text.substring(0, 500), e);
  }

  const diff = diffData.data;

  // If no differences, exit early
  if (!diff) {
    if (options.verbose) {
      console.info('No schema differences. Done.');
    }
    return;
  }

  if (options.verbose) {
    console.info('Schema differences found. Applying...');
  }

  if (retryConfig.applyDelayMs > 0) {
    if (options.verbose) {
      console.info(`Waiting ${(retryConfig.applyDelayMs / 1000).toFixed(1)}s before applying schema...`);
    }
    await sleep(retryConfig.applyDelayMs);
  }

  const applyResponse = await postSchemaRequest('Schema apply', applyUrl, diff);

  // Handle 204 No Content for apply as well
  if (applyResponse.status !== 204 && applyResponse.text.trim()) {
    try {
      const applyData = JSON.parse(applyResponse.text);
      if (options.verbose) {
        console.info('Schema apply response:', applyData);
      }
    } catch (e) {
      // Non-JSON response is OK
    }
  }

  if (options.verbose) {
    console.info('Schema imported.');
  }
}

async function importSchema(src, options = {verbose: false}) {
  const client = createDirectusClient();
  const retryConfig = getRetryConfig();

  try {
    for (let attempt = 1; attempt <= retryConfig.attempts; attempt++) {
      try {
        await runSchemaImport(src, options, client, retryConfig);
        return;
      } catch (err) {
        if (!err.retryable || attempt === retryConfig.attempts) {
          logFinalSchemaError(err);
          return process.exit(1);
        }

        const delayMs = getRetryDelayMs(attempt, err.retryAfterMs ?? null, retryConfig);

        console.warn(`${err.label} ${getRetryReason(err)}. Retrying schema import in ${(delayMs / 1000).toFixed(1)}s (${attempt + 1}/${retryConfig.attempts})...`);
        await sleep(delayMs);
      }
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importSchema;
