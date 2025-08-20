/**
 * Load an SVG from a file and replace st0–stN with dynamic classes.
 * @param {string} rawSvg - Raw content of the SVG file, i.e. by import with "?raw"
 * @param {Object} classMap - Mapping of st-class names to CSS classes
 *                            e.g. { st0: 'fill-white', st1: 'fill-red', st3: 'fill-blue' }
 * @returns {Promise<string>} - SVG HTML string
 */
export async function overwriteSvgStyles(rawSvg, classMap = {}) {
  // Remove any embedded <style> blocks
  // Regex on html tags, i know... but should be okay for a locally-controlled svg
  rawSvg = rawSvg.replace(/<style[\s\S]*?<\/style>/g, '');

  // Replace class references dynamically
  for (const [st, cssClass] of Object.entries(classMap)) {
    if (cssClass) {
      const regex = new RegExp(`class="${st}"`, 'g');
      rawSvg = rawSvg.replace(regex, `class="${cssClass}"`);
    }
  }
  return rawSvg;
}
