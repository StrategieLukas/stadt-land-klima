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

  const searchThroughAdministrativeAreasByName = async (name_slice) => {
    try {
      const result = await apolloClient.query({
        query: gql`
          query allAdministrativeAreas($name_Icontains: String!) {
            allAdministrativeAreas(name_Icontains: $name_Icontains) {
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
                }
              }
            }
          }
        `,
        variables: { name_Icontains: name_slice }
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
                  stadtlandklimaData {
                    slug
                    scoreTotal
                  }
                  populationData {
                    population
                    license {
                      name
                    }
                    dataSourceDownload {
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
                    }
                    dataSourceDownload {
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
                    }
                    dataSourceDownload {
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
                    }
                    dataSourceDownload {
                      attribution
                      attributionUrl
                    }
                  }
                  publicTransportScore {
                    meanTravelTimeMinutes
                    stdDevTravelTimeMinutes
                    simulationCount
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
