/** Prepare checked-in SVGs while preserving the two existing button variants. */
export function prepareButtonIcons(files: Record<string, string>, variant: "canonical" | "blokkli") {
  return Object.fromEntries(
    Object.entries(files).map(([path, raw]): [string, string] => {
      const name = path.split("/").pop()?.replace(".svg", "") ?? "";
      const rectClass = variant === "canonical" ? "cls-[123]" : "cls-[23]";
      let svg = raw
        .replace(/<\?xml[^?]*\?>/g, "")
        .replace(/(<svg[^>]*?)\s+width="[^"]*"/g, "$1")
        .replace(/(<svg[^>]*?)\s+height="[^"]*"/g, "$1")
        .replace(new RegExp(`<rect[^>]*class="${rectClass}"[^/>]*/>`, "g"), "")
        .replace(new RegExp(`<rect[^>]*class="${rectClass}"[^>]*>[^<]*</rect>`, "g"), "");
      if (variant === "canonical") {
        svg = svg
          .replace(/<circle[^>]*class="cls-1"[^/>]*\/>/g, "")
          .replace(/<circle[^>]*class="cls-1"[^>]*>[^<]*<\/circle>/g, "");
      }
      return [
        name,
        svg
          .replace(/<circle[^>]*class="st0"[^/>]*\/>/g, "")
          .replace(/<circle[^>]*class="st0"[^>]*>[^<]*<\/circle>/g, "")
          .replace(/fill:\s*#[0-9a-fA-F]{3,6}/g, "fill: currentColor")
          .replace(/stroke:\s*#[0-9a-fA-F]{3,6}/g, "stroke: currentColor")
          .replace(/fill="(?:#[0-9a-fA-F]{3,6}|black|white)"/g, 'fill="currentColor"')
          .replace(/stroke="(?:#[0-9a-fA-F]{3,6}|black|white)"/g, 'stroke="currentColor"'),
      ];
    }),
  );
}
