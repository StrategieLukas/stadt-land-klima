import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core'
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
            allAdministrativeAreas(orderBy: "-population", name_Icontains: $name_Icontains, isReasonableForMunicipalRating: $isReasonableForMunicipalRating) {
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
            allAdministrativeAreas(ars: $ars) {
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
            allAdministrativeAreas(geoCenterDistance: $geoCenterDistance, isReasonableForMunicipalRating: true, orderBy: "-population", level_In: $level_In) {
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

  // Expose the API methods via the plugin

  const stadtlandzahlAPI = {
    searchThroughAdministrativeAreasByName,
    fetchStatsByARS,
    getNearbyAdministrativeAreas
  };

  return {
    provide: {
      stadtlandzahlAPI,
      // Provide Apollo client directly
      apollo: apolloClient,
    },
  };
});
