/** Real logging modules for VM tests; keep their transports separate from application mocks. */
import * as portable from "../../../../src/frontend/shared/securityLog.ts";
import * as server from "../../../../src/frontend/server/utils/securityLogging.ts";
import * as directus from "../../../../src/directus/extensions/shared/securityLogger.ts";
export function loggingModule(id: string): unknown {
  const name = id
    .split("/")
    .at(-1)
    ?.replace(/\.(?:ts|js)$/, "");
  return name === "securityLog"
    ? portable
    : name === "securityLogging"
      ? server
      : name === "securityLogger"
        ? directus
        : undefined;
}
