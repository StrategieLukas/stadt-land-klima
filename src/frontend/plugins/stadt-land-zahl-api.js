import { useRuntimeConfig } from "#app";
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core'
import gql from 'graphql-tag'

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig();
  const stadtlandzahlURL = runtimeConfig.public.stadtlandzahlUrl || 'http://localhost:8000/graphql/';

  // The stadtlandzahl API returns `access-control-allow-origin: *`, so browser
  // requests can go directly to the API without any proxy.
  const resolvedGraphqlURL = stadtlandzahlURL;

  // Create HTTP link
  const httpLink = new HttpLink({
    uri: resolvedGraphqlURL,
  })

  // Create Apollo client
  const apolloClient = new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'all',
      },
    },
    connectToDevTools: true,
  })

  const searchThroughAdministrativeAreasByName = async (name_slice, options) => {
    try {
      const result = await apolloClient.query({
        query: gql`
          query allAdministrativeAreas($name_Icontains: String!, $isReasonableForMunicipalRating: Boolean) {
            allAdministrativeAreas(first: 5, orderBy: "-population", name_Icontains: $name_Icontains, isReasonableForMunicipalRating: $isReasonableForMunicipalRating) {
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
        variables: { name_Icontains: name_slice, isReasonableForMunicipalRating: options.isReasonableForMunicipalRating }
      })

      return result.data
    } catch (error) {
      console.error(`searchThroughAdministrativeAreasByName failed for name_slice "${name_slice}":`, error)
      return null
    }
  }

  const fetchStatsByARS = async (ars) => {
    try {
      // The stadtlandzahl API allows CORS from all origins, so use the direct URL.
      const baseUrl = stadtlandzahlURL.replace('/graphql/', '').replace('/graphql', '')
      const url = `${baseUrl}/api/areas/${ars}/?format=json`
      console.log('Fetching from URL:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Fetched data:', data)
      
      // Sort contained_by areas by level ascending
      if (data.contained_by) {
        data.contained_by.sort((a, b) => a.level - b.level)
      }

      // Derive the federal state (Bundesland) from the level-2 entry in contained_by.
      // The top-level `state` field on the API response is unreliable; level 2 is always Bundesland.
      const stateArea = data.contained_by?.find(a => a.level === 2)
      if (stateArea) {
        data.state = stateArea.name
      }

      return data
    } catch (error) {
      console.error(`fetchStatsByARS failed for ars "${ars}":`, error)
      return null
    }
  };

  const getNearbyAdministrativeAreas = async (latitude, longitude, radius_km, level_In) => {
    try {
      const result = await apolloClient.query({
        query: gql`
          query allAdministrativeAreas($geoCenterDistance: String!, $level_In: [Int!]) {
            allAdministrativeAreas(first: 15, geoCenterDistance: $geoCenterDistance, isReasonableForMunicipalRating: true, orderBy: "-population", level_In: $level_In) {
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
        variables: { level_In: level_In, geoCenterDistance: JSON.stringify({ "lat": latitude, "lon": longitude, "distance": radius_km }) }
      })
      console.log('getNearbyAdministrativeAreas result:', result)
      return result.data
    } catch (error) {
      console.error(`getNearbyAdministrativeAreas failed for lat "${latitude}", lon "${longitude}", radius_km "${radius_km}":`, error)
      return null
    }
  };

  const fetchHistogramData = async (dataType, attributeName) => {
    try {
      let query = '';
      let variables = {};
      
      // Map new snake_case dataType to legacy GraphQL field names
      const dataTypeToGraphQLField = {
        'ev_charging_data': 'evChargingData',
        'wind_power_data': 'windPowerData',
        'solar_power_data': 'solarPowerData',
        'cycleway_infrastructure_data': 'cyclewayInfrastructureData',
        'population_data': 'populationData',
        'public_transport_score_data': 'publicTransportScoreData'
      };
      
      const graphqlFieldName = dataTypeToGraphQLField[dataType] || `${dataType}Data`;
      
      // Convert snake_case attribute names to camelCase for GraphQL
      const snakeToCamel = (str) => {
        return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
      };
      
      const graphqlAttributeName = snakeToCamel(attributeName);

      query = gql`
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
      let allData = [];
      let hasNextPage = true;
      let cursor = null;

      while (hasNextPage) {
        variables.after = cursor;
        const result = await apolloClient.query({
          query,
          variables
        });
        console.log(result)

        const edges = result.data.allAdministrativeAreas.edges;
        allData = allData.concat(edges.map(edge => edge.node));
        
        hasNextPage = result.data.allAdministrativeAreas.pageInfo.hasNextPage;
        cursor = result.data.allAdministrativeAreas.pageInfo.endCursor;
      }
      console.log('fetchHistogramData allData:', allData);
      return allData;
    } catch (error) {
      console.error(`fetchHistogramData failed for dataType "${dataType}", attributeName "${attributeName}":`, error);
      return [];
    }
  };

  // Expose the API methods via the plugin

  // GraphQL query string for area search — used by searchAdministrativeAreas via plain fetch.
  // Using plain fetch instead of the Apollo client avoids a silent failure in Apollo Client 4's
  // no-cache path on iOS WebKit (which caused empty results on mobile).
  const AREA_SEARCH_GQL = `
    query searchAreas($name_Icontains: String!, $isReasonableForMunicipalRating: Boolean, $level_In: [Int]) {
      allAdministrativeAreas(
        first: 8
        orderBy: "-population"
        name_Icontains: $name_Icontains
        isReasonableForMunicipalRating: $isReasonableForMunicipalRating
        level_In: $level_In
      ) {
        edges {
          node {
            prefix
            name
            ars
            level
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
  `

  /**
   * Unified area search used by useAreaSearch composable.
   * Delegates to the /api/area-search server route so the GraphQL request
   * is made server-side — this avoids mobile network/CORS issues that arise
   * when the browser fetches data.stadt-land-klima.de directly.
   *
   * mode: 'normal'     → level 1-3 areas + reasonable municipalities
   *       'reasonable' → isReasonableForMunicipalRating only
   *       'all'        → no filter
   * Returns a flat array of nodes.
   */
  const searchAdministrativeAreas = async (term, mode = 'reasonable') => {
    try {
      const nodes = await $fetch('/api/area-search', {
        query: { term: term.trim(), mode },
      })
      return Array.isArray(nodes) ? nodes : []
    } catch (error) {
      console.error(`searchAdministrativeAreas failed for "${term}" (mode: ${mode}):`, error)
      return []
    }
  }

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
  const fetchMunicipalitiesInRegion = async (regionArs, level) => {
    const prefixLengths = { 2: 2, 3: 3, 4: 5 };
    const len = prefixLengths[level];
    const prefix = len ? regionArs.slice(0, len) : regionArs.replace(/0+$/, '');
    if (!prefix) return [];

    const PAGE_SIZE = 500;
    const nodes = [];
    let cursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
      try {
        const result = await apolloClient.query({
          query: gql`
            query municipalitiesInRegion($ars_Icontains: String!, $after: String) {
              allAdministrativeAreas(
                first: 500
                after: $after
                isReasonableForMunicipalRating: true
                ars_Icontains: $ars_Icontains
                orderBy: "-population"
              ) {
                pageInfo { hasNextPage endCursor }
                edges {
                  node {
                    ars
                    name
                    prefix
                    population
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
          fetchPolicy: 'no-cache',
        });

        const connection = result.data?.allAdministrativeAreas;
        if (!connection) break;

        for (const edge of connection.edges ?? []) {
          // Client-side guard: discard false positives where the prefix
          // appears somewhere other than the start of the ARS.
          if (edge.node.ars.startsWith(prefix)) {
            nodes.push(edge.node);
          }
        }

        hasNextPage = connection.pageInfo?.hasNextPage ?? false;
        cursor = connection.pageInfo?.endCursor ?? null;
      } catch (e) {
        console.error('fetchMunicipalitiesInRegion error:', e);
        break;
      }
    }

    return nodes;
  };

  const stadtlandzahlAPI = {
    searchThroughAdministrativeAreasByName,
    searchAdministrativeAreas,
    fetchStatsByARS,
    getNearbyAdministrativeAreas,
    fetchHistogramData,
    fetchMunicipalitiesInRegion,
  };

  return {
    provide: {
      stadtlandzahlAPI,
      // Provide Apollo client directly
      apollo: apolloClient,
    },
  };
});
