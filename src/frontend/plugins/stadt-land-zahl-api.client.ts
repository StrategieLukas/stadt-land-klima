import { clientFailure } from "../shared/securityLog";
import { serviceBaseUrl } from "~/shared/serviceUrl";
import { z } from "zod";
import { AreaSchema, AreaListSchema, type Area, type SearchMode } from "~/shared/contracts/search";
import { RenderResponseSchema, RenderElementSchema } from "~/shared/contracts/slz";
import { useRuntimeConfig } from "#app";
import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client/core";
import gql from "graphql-tag";
declare module "@apollo/client" {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy: "all";
      }
    }
  }
}
const ConnectionSchema = z.object({
  allAdministrativeAreas: z.object({
    edges: z.array(z.object({ node: AreaSchema })),
    pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }).optional(),
  }),
});

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig();
  const stadtlandzahlBaseURL = serviceBaseUrl(runtimeConfig.public.stadtlandzahlBaseUrl, "/api/stadtlandzahl");
  const stadtlandzahlURL = `${stadtlandzahlBaseURL}/graphql/`;

  // Create HTTP link
  const httpLink = new HttpLink({
    uri: stadtlandzahlURL,
  });

  // Create Apollo client
  const apolloClient = new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        errorPolicy: "all",
      },
    },
    devtools: { enabled: import.meta.dev },
  });

  const searchThroughAdministrativeAreasByName = async (
    name_slice: string,
    options: { isReasonableForMunicipalRating?: boolean | undefined },
  ) => {
    try {
      const result: { data?: unknown } = await apolloClient.query({
        query: gql`
          query allAdministrativeAreas($name_Icontains: String!, $isReasonableForMunicipalRating: Boolean) {
            allAdministrativeAreas(
              first: 5
              orderBy: "-population"
              name_Icontains: $name_Icontains
              isReasonableForMunicipalRating: $isReasonableForMunicipalRating
            ) {
              edges {
                node {
                  prefix
                  name
                  ars
                  population
                  stadtlandklimaDataAll {
                    slug
                    scoreTotal
                    percentageRated
                    measureCatalogName
                  }
                  isReasonableForMunicipalRating
                }
              }
            }
          }
        `,
        variables: {
          name_Icontains: name_slice,
          isReasonableForMunicipalRating: options.isReasonableForMunicipalRating,
        },
      });

      return ConnectionSchema.parse(result.data);
    } catch (error) {
      clientFailure("app.plugins.stadt-land-zahl-api.client.failed", error);
      return null;
    }
  };

  const fetchStatsByARS = async (ars: string) => {
    try {
      const url = `${stadtlandzahlBaseURL}/api/areas/${ars}/?format=json`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = AreaSchema.parse((await response.json()) as unknown);

      // Sort contained_by areas by level ascending
      if (data.contained_by) {
        data.contained_by.sort((a, b) => a.level - b.level);
      }

      // Derive the federal state (Bundesland) from the level-2 entry in contained_by.
      // The top-level `state` field on the API response is unreliable; level 2 is always Bundesland.
      const stateArea = data.contained_by?.find((a) => a.level === 2);
      if (stateArea) {
        data.state = stateArea.name;
      }

      return data;
    } catch (error) {
      clientFailure("app.plugins.stadt-land-zahl-api.client.failed", error);
      return null;
    }
  };

  const getNearbyAdministrativeAreas = async (
    latitude: number,
    longitude: number,
    radius_km: number,
    level_In?: number[],
  ) => {
    try {
      const result: { data?: unknown } = await apolloClient.query({
        query: gql`
          query allAdministrativeAreas($geoCenterDistance: String!, $level_In: [Int!]) {
            allAdministrativeAreas(
              first: 15
              geoCenterDistance: $geoCenterDistance
              isReasonableForMunicipalRating: true
              orderBy: "-population"
              level_In: $level_In
            ) {
              edges {
                node {
                  prefix
                  name
                  ars
                  population
                  geoCenter
                  geoArea
                  level
                  isReasonableForMunicipalRating
                }
              }
            }
          }
        `,
        variables: {
          level_In: level_In,
          geoCenterDistance: JSON.stringify({ lat: latitude, lon: longitude, distance: radius_km }),
        },
      });
      return ConnectionSchema.parse(result.data);
    } catch (error) {
      clientFailure("app.plugins.stadt-land-zahl-api.client.failed", error);
      return null;
    }
  };

  const fetchHistogramData = async (dataType: string, attributeName: string) => {
    try {
      if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(dataType) || !/^[_A-Za-z][_0-9A-Za-z]*$/.test(attributeName))
        throw new Error("Invalid histogram selector");
      const variables: { after?: string | null } = {};

      // Map new snake_case dataType to legacy GraphQL field names
      const dataTypeToGraphQLField: Record<string, string> = {
        ev_charging_data: "evChargingData",
        wind_power_data: "windPowerData",
        solar_power_data: "solarPowerData",
        cycleway_infrastructure_data: "cyclewayInfrastructureData",
        population_data: "populationData",
        public_transport_score_data: "publicTransportScoreData",
      };

      const graphqlFieldName = dataTypeToGraphQLField[dataType] || `${dataType}Data`;

      // Convert snake_case attribute names to camelCase for GraphQL
      const snakeToCamel = (str: string) => {
        return str.replace(/_([a-z])/g, (_match: string, letter: string) => letter.toUpperCase());
      };

      const graphqlAttributeName = snakeToCamel(attributeName);

      const query = gql`
        query allAdministrativeAreas($after: String) {
          allAdministrativeAreas(
            isReasonableForMunicipalRating: true,
            after: $after,
            first: 500
          ) {
            edges {
              node {
                name
                prefix
                ars
                ${graphqlFieldName} {
                  ${graphqlAttributeName}
                }
                populationData {
                  population
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      // Fetch all data using cursor pagination
      let allData: Area[] = [];
      const seenCursors = new Set<string>();
      let hasNextPage = true;
      let cursor: string | null = null;

      while (hasNextPage) {
        variables.after = cursor;
        const result: { data?: unknown } = await apolloClient.query({
          query,
          variables,
        });

        const connection = ConnectionSchema.parse(result.data).allAdministrativeAreas;
        allData = allData.concat(connection.edges.map((edge) => edge.node));

        const pageInfo = connection.pageInfo;
        if (!pageInfo) throw new Error("Missing pagination metadata");
        hasNextPage = pageInfo.hasNextPage;
        if (hasNextPage && (!pageInfo.endCursor || seenCursors.has(pageInfo.endCursor)))
          throw new Error("Invalid pagination cursor");
        cursor = pageInfo.endCursor;
        if (cursor) seenCursors.add(cursor);
      }
      return allData;
    } catch (error) {
      clientFailure("app.plugins.stadt-land-zahl-api.client.failed", error);
      return [];
    }
  };

  // Expose the API methods via the plugin

  /**
   * Unified area search used by useAreaSearch composable.
   * Delegates to the /api/area-search server route so the GraphQL request
   * is made server-side — this avoids mobile network/CORS issues and keeps
   * Stadtlandzahl credentials out of the browser.
   *
   * mode: 'normal'     → level 1-3 areas + reasonable municipalities
   *       'reasonable' → isReasonableForMunicipalRating only
   *       'all'        → no filter
   * Returns a flat array of nodes.
   */
  const searchAdministrativeAreas = async (term: string, mode: SearchMode = "reasonable") => {
    try {
      const nodes = await $fetch("/api/area-search", {
        query: { term: term.trim(), mode },
      });
      return AreaListSchema.parse(nodes);
    } catch (error) {
      clientFailure("app.plugins.stadt-land-zahl-api.client.failed", error);
      return [];
    }
  };

  /**
   * Fetch all municipalities (isReasonableForMunicipalRating) that belong to a
   * given region, identified by its ARS and administrative level.
   *
   * The API only exposes ars_Icontains, so we use that for a server-side
   * pre-filter and then apply a client-side startsWith check to eliminate any
   * false positives (e.g. a Kreis whose code appears in the middle of another
   * area's ARS).
   *
   * Prefix lengths by level:
   *   2 (Bundesland)         → 2 chars  (SS)
   *   3 (Regierungsbezirk)   → 3 chars  (SS R)
   *   4 (Kreis)              → 5 chars  (SS R KK)
   */
  const fetchMunicipalitiesInRegion = async (regionArs: string, level: number) => {
    const prefixLengths: Record<number, number> = { 2: 2, 3: 3, 4: 5 };
    const len = prefixLengths[level];
    const prefix = len ? regionArs.slice(0, len) : regionArs.replace(/0+$/, "");
    if (!prefix) return [];

    const seenCursors = new Set<string>();
    const nodes: Area[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      try {
        const result: { data?: unknown } = await apolloClient.query({
          query: gql`
            query municipalitiesInRegion($ars_Icontains: String!, $after: String) {
              allAdministrativeAreas(
                first: 1000
                after: $after
                isReasonableForMunicipalRating: true
                ars_Icontains: $ars_Icontains
                orderBy: "-population"
              ) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                edges {
                  node {
                    ars
                    name
                    prefix
                    population
                    geoCenter
                    stadtlandklimaDataAll {
                      slug
                      scoreTotal
                      percentageRated
                      measureCatalogName
                    }
                  }
                }
              }
            }
          `,
          variables: { ars_Icontains: prefix, after: cursor },
          fetchPolicy: "no-cache",
        });

        const connection: z.infer<typeof ConnectionSchema>["allAdministrativeAreas"] = ConnectionSchema.parse(
          result.data,
        ).allAdministrativeAreas;

        for (const edge of connection.edges) {
          // Client-side guard: discard false positives where the prefix
          // appears somewhere other than the start of the ARS.
          if (edge.node.ars.startsWith(prefix)) {
            nodes.push(edge.node);
          }
        }

        hasNextPage = connection.pageInfo?.hasNextPage ?? false;
        cursor = connection.pageInfo?.endCursor ?? null;
        if (hasNextPage && (!cursor || seenCursors.has(cursor))) throw new Error("Invalid pagination cursor");
        if (cursor) seenCursors.add(cursor);
      } catch (e) {
        clientFailure("app.plugins.stadt-land-zahl-api.client.failed", e);
        break;
      }
    }

    return nodes;
  };

  const fetchCollectionRender = async (slug: string, areaArs: string, step: number | null = null) => {
    const params = new URLSearchParams({ area: areaArs });
    if (step !== null) params.set("step", String(step));
    const res = await fetch(`${stadtlandzahlBaseURL}/api/collections/${slug}/render/?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return RenderResponseSchema.parse((await res.json()) as unknown);
  };

  const fetchRenderElement = async (slug: string, plotId: string, areaArs: string) => {
    const res = await fetch(
      `${stadtlandzahlBaseURL}/api/collections/${slug}/render/${plotId}/?area=${encodeURIComponent(areaArs)}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return RenderElementSchema.parse((await res.json()) as unknown);
  };

  const stadtlandzahlAPI = {
    searchThroughAdministrativeAreasByName,
    searchAdministrativeAreas,
    fetchStatsByARS,
    getNearbyAdministrativeAreas,
    fetchHistogramData,
    fetchMunicipalitiesInRegion,
    fetchCollectionRender,
    fetchRenderElement,
  };

  return {
    provide: {
      stadtlandzahlAPI,
      // Provide Apollo client directly
      apollo: apolloClient,
    },
  };
});
