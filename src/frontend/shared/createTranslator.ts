import type { DynamicTranslator, TranslationEntry, Translator } from "./i18n";

export default function createTranslator(translations: readonly TranslationEntry[]) {
  const messages = new Map(translations.map((entry) => [entry.key, entry.value]));
  const dynamic: DynamicTranslator = (key, params = {}) => {
    let message = messages.get(key);
    if (!message) return key;
    for (const [placeholder, value] of Object.entries(params)) message = message.replace(placeholder, String(value));
    return message;
  };
  const t: Translator = dynamic;
  return { t, dynamic };
}
