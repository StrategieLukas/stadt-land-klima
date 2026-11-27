import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let fontFile: Promise<string> | undefined;
export function jobShareFont() {
  fontFile ??= (async () => {
    const font = await useStorage("assets:server").getItemRaw<Buffer>("fonts/RobotoCondensed-Regular.ttf");
    if (!font) throw new Error("Job image font unavailable");
    const file = join(await mkdtemp(join(tmpdir(), "slk-job-share-")), "font.ttf");
    await writeFile(file, font, { mode: 0o600 });
    return file;
  })().catch((error: unknown) => {
    fontFile = undefined;
    throw error;
  });
  return fontFile;
}

/** Only the job's checked logo UUID on the private configured CMS origin is read. */
export async function jobShareLogo(id: string | undefined): Promise<Buffer | undefined> {
  if (!id || !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id)) return undefined;
  try {
    const config = useRuntimeConfig();
    const url = new URL(config.directusServerUrl);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/assets/${id}`;
    url.search = new URLSearchParams({ width: "240", height: "120", fit: "inside", format: "png" }).toString();
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.directusFrontendServerToken}` },
      redirect: "error",
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png") || !response.body) {
      await response.body?.cancel();
      return undefined;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 512 * 1024) {
          await reader.cancel();
          return undefined;
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const png = Buffer.concat(chunks);
    if (
      png.length < 24 ||
      !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      png.readUInt32BE(16) > 240 ||
      png.readUInt32BE(20) > 120 ||
      !png.readUInt32BE(16) ||
      !png.readUInt32BE(20)
    )
      return undefined;
    return png;
  } catch {
    return undefined;
  }
}
