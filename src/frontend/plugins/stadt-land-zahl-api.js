import { useRuntimeConfig } from "#app";
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core'
import { data } from 'autoprefixer';
import gql from 'graphql-tag'

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig();
  const stadtlandzahlURL = runtimeConfig.public.stadtlandzahlUrl;
  
  // Create HTTP link
  const httpLink = new HttpLink({
    uri: stadtlandzahlURL || 'http://localhost:8000/graphql/', // url needs to end with a trailing slash
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
      // Remove /graphql/ from the URL and construct the API endpoint
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

  // Shared query used by searchAdministrativeAreas — includes `level` field
  const AREA_SEARCH_QUERY = gql`
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
   * mode: 'normal'     → level 1-3 areas + reasonable municipalities (two parallel queries merged)
   *       'reasonable' → isReasonableForMunicipalRating only
   *       'all'        → no filter (all administrative areas)
   * Returns a flat array of nodes.
   */
  const searchAdministrativeAreas = async (term, mode = 'reasonable') => {
    const extract = (res) => res.data?.allAdministrativeAreas?.edges?.map(e => e.node) ?? []
    try {
      if (mode === 'normal') {
        const [areaRes, muniRes] = await Promise.all([
          apolloClient.query({
            query: AREA_SEARCH_QUERY,
            variables: { name_Icontains: term, level_In: [1, 2, 3] },
            fetchPolicy: 'no-cache',
          }),
          apolloClient.query({
            query: AREA_SEARCH_QUERY,
            variables: { name_Icontains: term, isReasonableForMunicipalRating: true },
            fetchPolicy: 'no-cache',
          }),
        ])
        const seen = new Set()
        const merged = []
        for (const node of [...extract(areaRes), ...extract(muniRes)]) {
          if (!seen.has(node.ars)) { seen.add(node.ars); merged.push(node) }
        }
        return merged
      } else if (mode === 'reasonable') {
        const res = await apolloClient.query({
          query: AREA_SEARCH_QUERY,
          variables: { name_Icontains: term, isReasonableForMunicipalRating: true },
          fetchPolicy: 'no-cache',
        })
        return extract(res)
      } else {
        // 'all' — no reasonableness or level filter
        const res = await apolloClient.query({
          query: AREA_SEARCH_QUERY,
          variables: { name_Icontains: term },
          fetchPolicy: 'no-cache',
        })
        return extract(res)
      }
    } catch (error) {
      console.error(`searchAdministrativeAreas failed for "${term}" (mode: ${mode}):`, error)
      return []
    }
  }

  const stadtlandzahlAPI = {
    searchThroughAdministrativeAreasByName,
    searchAdministrativeAreas,
    fetchStatsByARS,
    getNearbyAdministrativeAreas,
    fetchHistogramData
  };

  return {
    provide: {
      stadtlandzahlAPI,
      // Provide Apollo client directly
      apollo: apolloClient,
    },
  };
});
