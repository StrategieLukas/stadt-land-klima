/** Result links open the full public page, including when generated inside an embed. */
export function wahlcheckStandaloneUrl(href: string): string {
  const url = new URL(href);
  url.pathname = url.pathname.replace(/^\/embed\/wahlcheck(?=\/|$)/, "/elections/wahlcheck");
  return url.href;
}
