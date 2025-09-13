import { defineHook } from "@directus/extensions-sdk";

export default defineHook(({ action }, { services, logger, env }) => {
  const { AssetsService, FilesService } = services;
  const quality = env.EXTENSIONS_SANE_IMAGE_SIZE_UPLOAD_QUALITY ?? 70;
  const maxSize = env.EXTENSIONS_SANE_IMAGE_SIZE_MAXSIZE ?? 1920;

  action("files.upload", async ({ payload, key }, context) => {
    if (payload.optimized === true) return;

    const transformation = getTransformation(payload.type, quality, maxSize);
    if (!transformation) return;

    const serviceOptions = { ...context, knex: context.database };
    const assets = new AssetsService(serviceOptions);
    const files = new FilesService(serviceOptions);

    try {
      const { stream, stat } = await assets.getAsset(key, transformation);

      if (stat.size < payload.filesize) {
        // Wait briefly to avoid conflicts with original upload
        await sleep(4000);

        // Remove potentially stale metadata, Directus will regenerate
        delete payload.width;
        delete payload.height;
        delete payload.size;

        await files.uploadOne(
          stream,
          {
            ...payload,
            optimized: true,
          },
          key,
          { emitEvents: false }
        );

        logger.info(
          `Optimized image "${payload.filename_download}" (${payload.filesize} → ${stat.size} bytes)`
        );
      } else {
        logger.info(
          `Skipped optimization for "${payload.filename_download}" (no size improvement)`
        );
      }
    } catch (err) {
      logger.warn(
        `Image optimization failed for "${payload.filename_download}": ${err.message}`
      );
    }
  });
});

function getTransformation(type, quality, maxSize) {
  const format = type.split("/")[1] ?? "";
  if (["jpg", "jpeg", "png", "webp", "tiff", "avif"].includes(format)) {
    const transforms = [["withMetadata"]];
    // No progressive encoding (to avoid libvips SOS errors)
    return {
      transformationParams: {
        format,
        quality,
        width: maxSize,
        height: maxSize,
        fit: "inside",
        withoutEnlargement: true,
        transforms,
      },
    };
  }
  return undefined;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
