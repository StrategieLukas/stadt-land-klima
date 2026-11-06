import { legacyCmsHtml } from "~/utils/legacyCmsHtml";

export function useCmsHtml() {
  const config = useRuntimeConfig();
  return (raw: string | null | undefined) => legacyCmsHtml(raw, config.public.clientDirectusUrl);
}
