/** Disposable Caddy integration upstream. Never included in application images. */
import { createServer } from "node:http";
const frontend = createServer((request, response) => {
  if (request.url === "/_test/cms-down") {
    cms.close();
    response.end("stopped");
    return;
  }
  response.setHeader("X-Powered-By", "synthetic-upstream");
  response.setHeader("Content-Security-Policy", "script-src 'nonce-syntheticNonce'; object-src 'none'");
  if (request.url?.includes("unavailable")) response.statusCode = 503;
  response.end("frontend");
});
const cms = createServer((request, response) => {
  request.resume();
  request.on("end", () => {
    if (request.url?.includes("unavailable")) response.statusCode = 503;
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        path: request.url,
        method: request.method,
        realIp: request.headers["x-real-ip"],
        forwardedFor: request.headers["x-forwarded-for"],
        forwardedProto: request.headers["x-forwarded-proto"],
        forwarded: request.headers.forwarded,
      }),
    );
  });
});
const maintenance = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.end(
    JSON.stringify({
      maintenance: true,
      method: request.method,
      authorization: request.headers.authorization,
      cookie: request.headers.cookie,
    }),
  );
});
frontend.listen(9000, "0.0.0.0");
cms.listen(9001, "0.0.0.0");
maintenance.listen(9090, "0.0.0.0");
