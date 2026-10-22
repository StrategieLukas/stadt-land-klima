type CalArguments = unknown[];
interface CalNamespace {
  (...args: CalArguments): void;
  q: CalArguments[];
}
interface CalClient {
  (...args: CalArguments): void;
  loaded?: boolean;
  q: CalArguments[];
  ns: Record<string, CalNamespace>;
}
declare global {
  interface Window {
    Cal?: CalClient;
  }
}
export default defineNuxtPlugin(() => {
  if (!window.Cal) {
    const cal: CalClient = Object.assign(
      (...args: CalArguments) => {
        if (!cal.loaded) {
          const script = document.createElement("script");
          script.src = "https://app.cal.com/embed/embed.js";
          document.head.appendChild(script);
          cal.loaded = true;
        }
        if (args[0] === "init" && typeof args[1] === "string") {
          const namespace = args[1];
          const api: CalNamespace = Object.assign(
            (...commands: CalArguments) => {
              api.q.push(commands);
            },
            { q: [] as CalArguments[] },
          );
          const registered: CalNamespace = (cal.ns[namespace] ??= api);
          registered.q.push(args);
          cal.q.push(["initNamespace", namespace]);
        } else cal.q.push(args);
      },
      { loaded: false, q: [] as CalArguments[], ns: {} },
    );
    window.Cal = cal;
  }
  window.Cal("init", "onboarding", { origin: "https://app.cal.com" });
  window.Cal.ns.onboarding?.("ui", {
    cssVarsPerTheme: { light: { "cal-brand": "#678203" }, dark: { "cal-brand": "#fafafa" } },
    hideEventTypeDetails: false,
    layout: "month_view",
  });
});
