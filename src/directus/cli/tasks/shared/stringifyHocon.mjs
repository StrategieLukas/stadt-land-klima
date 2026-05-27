/**
 * Stringifies a JavaScript object to HOCON format.
 * HOCON is a superset of JSON, so we can use JSON.stringify as a base
 * and then format it in a more HOCON-like way (without quotes for simple keys, etc.)
 * 
 * For minimal implementation, we use JSON with indentation which is valid HOCON.
 */

function stringifyHocon(obj, options = {}) {
  const indent = options.indent !== undefined ? options.indent : 2;
  return JSON.stringify(obj, null, indent);
}

export default stringifyHocon;
