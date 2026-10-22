import { createError } from "h3";

export function queryText(value: unknown, maximum = 160): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value || value.length > maximum) {
    throw createError({statusCode: 400, statusMessage: "Invalid query value"});
  }
  return value;
}
export function queryLimit(value: unknown, fallback: number, maximum: number, all = false): number {
  const text = queryText(value, 10);
  if (text === undefined) return fallback;
  if (all && text === "-1") return -1;
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > maximum) {
    throw createError({statusCode: 400, statusMessage: "Invalid limit"});
  }
  return Number(text);
}
export function queryChoice<const T extends readonly string[]>(value: unknown, choices: T, fallback?: T[number]): T[number] | undefined {
  const text = queryText(value);
  if (text === undefined) return fallback;
  const choice = choices.find(choice => choice === text);
  if (choice === undefined) throw createError({statusCode: 400, statusMessage: "Invalid query choice"});
  return choice;
}
export function queryIds(value: unknown, maximum = 200): string[] {
  const text = queryText(value, maximum * 101);
  if (!text) return [];
  const ids = text.split(",").map(id => id.trim());
  if (ids.length > maximum || ids.some(id => !/^[\w-]{1,100}$/.test(id))) {
    throw createError({statusCode: 400, statusMessage: "Invalid identifiers"});
  }
  return [...new Set(ids)];
}
