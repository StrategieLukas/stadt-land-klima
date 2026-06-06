function getBasicAuthValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseBasicAuthHeader(header: string): { username: string; password: string } | null {
  if (!header.toLowerCase().startsWith("basic ")) {
    return null;
  }

  const encodedCredentials = header.slice("basic ".length).trim();
  const decodedCredentials = Buffer.from(encodedCredentials, "base64").toString("utf8");
  const separatorIndex = decodedCredentials.indexOf(":");

  if (separatorIndex === -1) {
    return null;
  }

  return {
    username: decodedCredentials.slice(0, separatorIndex),
    password: decodedCredentials.slice(separatorIndex + 1),
  };
}

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  const configuredUsername = getBasicAuthValue(config.frontendBasicAuthUsername);
  const configuredPassword = getBasicAuthValue(config.frontendBasicAuthPassword);

  if (!configuredUsername || !configuredPassword) {
    return;
  }

  const authorizationHeader = event.node.req.headers.authorization ?? "";
  const credentials = parseBasicAuthHeader(
    Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader,
  );

  if (credentials?.username === configuredUsername && credentials.password === configuredPassword) {
    return;
  }

  event.node.res.setHeader("WWW-Authenticate", 'Basic realm="Stadt Land Klima", charset="UTF-8"');
  event.node.res.statusCode = 401;
  event.node.res.end("Authentication required");
});
