/** Narrow, source-verified hardening of the pinned 11.17.4 image. No version upgrade. */
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const deepGuard = `
  // SLK pinned-runtime guard: reject inherited path segments before any setter.
  let slkNodes = 0;
  function slkCheck(value, depth = 0, relationPath = true) {
    if (++slkNodes > 10000 || depth > 20) throw new InvalidQueryError({reason: 'Deep query exceeds safety limits'});
    if (Array.isArray(value)) { for (const child of value) slkCheck(child, depth + 1, relationPath); return; }
    if (value && typeof value === 'object') for (const [name, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(name)) throw new InvalidQueryError({reason: 'Invalid deep path'});
      const parameter = name.startsWith('_');
      if (relationPath && !parameter && name.split(/[.[\\]]/).some(segment => segment === 'prototype' || segment in Object.prototype || segment in Array.prototype || (segment !== 'name' && segment in Function.prototype))) throw new InvalidQueryError({reason: 'Invalid deep path'});
      slkCheck(child, depth + 1, relationPath && (!parameter || name === '_deep'));
    }
  }
  slkCheck(deep);
`;
export const geometryGuard = `
    // SLK pinned-runtime guard: a geometry subtype is an identifier, never SQL.
    if (!/^geometry(?:\\.(?:point|linestring|polygon|multipoint|multilinestring|multipolygon|geometrycollection))?$/i.test(field.type)) throw new Error('Invalid geometry subtype');
`;
export const assetGuard = `
    // SLK pinned-runtime guard: cap output dimensions, including raw transforms.
    for (const [slkMethod, ...slkArgs] of transforms) {
      if (slkMethod === 'resize') {
        const slkOptions = slkArgs[0] && typeof slkArgs[0] === 'object' ? slkArgs[0] : {width: slkArgs[0], height: slkArgs[1]};
        for (const slkDimension of [slkOptions.width, slkOptions.height]) {
          if (slkDimension != null && (!Number.isInteger(slkDimension) || slkDimension < 1 || slkDimension > 4096)) throw new IllegalAssetTransformationError({invalidTransformations: ['width', 'height']});
        }
      }
      // These advanced canvas operations are not used by the website or Studio presets.
      if (['extend', 'affine', 'composite', 'joinChannel'].includes(slkMethod)) throw new IllegalAssetTransformationError({invalidTransformations: [slkMethod]});
    }
`;
export function patchDirectusApi(root: string) {
  const definitions = [
    ['dist/utils/sanitize-query.js', '422460fef55a286403407c1e6ce24b58cb0dcd9c995231de2233632161f21e1f', '\tawait parse(deep);', deepGuard + '\tawait parse(deep);'],
    ['dist/database/helpers/geometry/dialects/postgres.js', '7141f87befe1a9c9de052126a6200180f0d84a7d238e42c0269497df7b606f0d', '\tcreateColumn(table, field) {', '\tcreateColumn(table, field) {' + geometryGuard],
    ['dist/services/assets.js', 'ed0bbcfcdc8fa3247a4e1d15665eb4d3989e41f231bc218a45713399df82478e', '\t\tconst modifiedOn =', assetGuard + '\t\tconst modifiedOn ='],
  ] as const;
  // Verify every original before changing any file. Unexpected vendor bytes fail the build.
  const checked = definitions.map(([file, digest, marker, replacement]) => {
    const path = join(root, file), source = readFileSync(path, 'utf8');
    if (createHash('sha256').update(source).digest('hex') !== digest || source.split(marker).length !== 2) throw new Error(`Unreviewed Directus source: ${file}`);
    return {path, source: source.replace(marker, replacement)};
  });
  for (const {path, source} of checked) writeFileSync(path, source);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const require = createRequire('/directus/package.json');
  const version: unknown = JSON.parse(readFileSync('/directus/package.json', 'utf8'));
  if (!version || typeof version !== 'object' || !('version' in version) || version.version !== '11.17.4') throw new Error('Expected Directus 11.17.4');
  patchDirectusApi(dirname(require.resolve('@directus/api/package.json')));
  console.info('Applied verified Directus 11.17.4 deep/geometry/asset guards.');
}
