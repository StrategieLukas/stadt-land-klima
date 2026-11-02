import { legacyCmsHtml } from "~/utils/legacyCmsHtml";
import checker from "~/assets/icons/icon_klimachecker.svg?url&no-inline";
import team from "~/assets/icons/icon_team.svg?url&no-inline";
import research from "~/assets/icons/icon_list_view.svg?url&no-inline";
import assessment from "~/assets/icons/icon_evaluation_criteria.svg?url&no-inline";
import politics from "~/assets/icons/icon_politics.svg?url&no-inline";
import history from "~/assets/icons/icon_history.svg?url&no-inline";

export function useCmsHtml() {
  const config = useRuntimeConfig();
  return (raw: string | null | undefined) =>
    legacyCmsHtml(raw, config.public.clientDirectusUrl, [checker, team, research, assessment, politics, history]);
}
