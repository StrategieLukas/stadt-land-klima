/** Exact, dated dispositions. New advisories/versions never inherit an exception. */
export const IMAGE_REVIEW_EXPIRES = "2026-11-24";
export const IMAGE_ADVISORY_REVIEW = [
  {
    name: "directus",
    version: "11.17.4",
    id: "GHSA-c6w9-5g5j-jh2p",
    control: "Response cache is forced off in the maintained Compose configuration.",
  },
  {
    name: "directus",
    version: "11.17.4",
    id: "GHSA-j5h6-vqc3-phqh",
    control:
      "Exact-source unspecified-address guard, connection-time IP validation and production deny-list; image regression rejects literal, DNS and unspecified loopback targets.",
  },
  {
    name: "stream-json",
    version: "1.9.1",
    id: "GHSA-hqr4-qq8f-hg3x",
    control: "JSONC parser/verifier is absent in 1.9.1; the base JSON parser does not accept comments.",
  },
  {
    name: "stream-json",
    version: "1.9.1",
    id: "GHSA-mjw6-4jj6-33hc",
    control: "Exact-source backport uses own-property definitions, tested with __proto__ data.",
  },
  {
    name: "stream-json",
    version: "1.9.1",
    id: "GHSA-528h-pc64-c93x",
    control:
      "Exact-source parser/assembler depth bounds limit filter path work; adversarial depth test rejects before processing.",
  },
  {
    name: "esbuild",
    version: "0.27.3",
    id: "GHSA-g7r4-m6w7-qqqr",
    control:
      "Windows-only development-server advisory; this audited image is Linux and exposes no esbuild development server.",
  },
  {
    name: "pm2",
    version: "6.0.14",
    id: "GHSA-x5gf-qvw8-r2rm",
    control:
      "Operator monitoring CLI regex; maintained start scripts run Directus directly, not PM2. No request-controlled regex reaches its CLI.",
  },
] as const;
