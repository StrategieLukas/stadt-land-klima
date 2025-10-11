import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core'
import { data } from 'autoprefixer';
import gql from 'graphql-tag'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  
  // Create HTTP link
  const httpLink = new HttpLink({
    uri: config.public.graphqlEndpoint || 'http://localhost:8000/graphql/', // url needs to end with a trailing slash
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
                  stadtlandklimaData {
                    slug
                    scoreTotal
                    percentageRated
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
      const result = await apolloClient.query({
        query: gql`
          query allAdministrativeAreas($ars: String!) {
            allAdministrativeAreas(ars: $ars, first: 1) {
              edges {
                node {
                  prefix
                  name
                  ars
                  geoCenter
                  geoArea
                  geoAreaKm2
                  level
                  isReasonableForMunicipalRating
                  containedBy {
                    edges {
                      node {
                        name
                        level
                        prefix
                        ars
                      }
                    }
                  }
                  stadtlandklimaData {
                    slug
                    scoreTotal
                    percentageRated
                  }
                  populationData {
                    population
                    dataSourceDownload {
                      effectiveDt
                      attribution
                      attributionUrl
                      license {
                        name
                        text
                        url
                      }
                    }
                  }
                  evChargingData {
                    nStations
                    power
                    powerUnit
                    dataSourceDownload {
                      effectiveDt
                      attribution
                      attributionUrl
                      license {
                        name
                        text
                        url
                      }
                    }
                  }
                  solarPowerData {
                    nUnits
                    power
                    powerUnit
                    dataSourceDownload {
                      effectiveDt
                      attribution
                      attributionUrl
                      license {
                        name
                        text
                        url
                      }
                    }
                  }
                  windPowerData {
                    nTurbines
                    power
                    powerUnit
                    dataSourceDownload {
                      effectiveDt
                      attribution
                      attributionUrl
                      license {
                        name
                        text
                        url
                      }
                    }
                  }
                  publicTransportScoreData {
                    meanTravelTimeMinutes
                    stdDevTravelTimeMinutes
                    commonTravelVelocity
                    commonTravelVelocityStd
                    validSinceDt
                    validUntilDt
                    simulationCount
                    pipelineRun {
                      downloads {
                        effectiveDt
                        license {
                          name
                          text
                          url
                        }
                        attribution
                        attributionUrl
                      }
                    }
                  }
                  cyclewayInfrastructureData {
                    bicycleInfrastructureRatio
                    dataSourceDownload {
                      attribution
                      attributionUrl
                      downloadDt
                      license {
                        name
                        text
                        url
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        variables: { ars }
      })
      
      // Get the node and create a mutable copy
      const node = result.data.allAdministrativeAreas.edges[0]?.node
      if (!node) return null
      
      // Create a deep copy of the node to make it mutable
      const mutableNode = JSON.parse(JSON.stringify(node))
      
      // Sort contained by areas by level ascending on the mutable copy
      if (mutableNode.containedBy?.edges) {
        mutableNode.containedBy.edges.sort((a, b) => a.node.level - b.node.level)
      }
      
      return mutableNode
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
                  stadtlandklimaData {
                    slug
                    scoreTotal
                    percentageRated
                  }
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
                ${dataType} {
                  ${attributeName}
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
