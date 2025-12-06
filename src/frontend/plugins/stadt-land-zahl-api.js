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

  const stadtlandzahlAPI = {
    searchThroughAdministrativeAreasByName,
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
