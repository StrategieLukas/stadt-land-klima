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
            allAdministrativeAreas(name_Icontains: $name_Icontains, isReasonableForMunicipalRating: $isReasonableForMunicipalRating) {
              edges {
                node {
                  prefix
                  name
                  ars
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
                  isReasonableForMunicipalRating
                  stadtlandklimaData {
                    slug
                    scoreTotal
                  }
                  populationData {
                    population
                    license {
                      name
                      text
                      url
                    }
                    dataSourceDownload {
                      effectiveDt
                      attribution
                      attributionUrl
                    }
                  }
                  evChargingData {
                    nStations
                    power
                    powerUnit
                    license {
                      name
                      text
                      url
                    }
                    dataSourceDownload {
                      effectiveDt
                      attribution
                      attributionUrl
                    }
                  }
                  solarPowerData {
                    nUnits
                    power
                    powerUnit
                    license {
                      name
                      text
                      url
                    }
                    dataSourceDownload {
                      effectiveDt
                      attribution
                      attributionUrl
                    }
                  }
                  windPowerData {
                    nTurbines
                    power
                    powerUnit
                    license {
                      name
                      text
                      url
                    }
                    dataSourceDownload {
                      effectiveDt
                      attribution
                      attributionUrl
                    }
                  }
                  publicTransportScoreData {
                    meanTravelTimeMinutes
                    stdDevTravelTimeMinutes
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
                }
              }
            }
          }
        `,
        variables: { ars }
      })
      
      return result.data.allAdministrativeAreas.edges[0]?.node || null
    } catch (error) {
      console.error(`fetchStatsByARS failed for ars "${ars}":`, error)
      return null
    }
  };

  const stadtlandzahlAPI = {
    searchThroughAdministrativeAreasByName,
    fetchStatsByARS,
    apolloClient
  };

  return {
    provide: {
      stadtlandzahlAPI,
      // Provide Apollo client directly
      apollo: apolloClient,
    },
  };
});
