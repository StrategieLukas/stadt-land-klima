type RequestUrlEvent = {
  node?: {
    req?: {
      url?: string
    }
  }
  req?: {
    url?: string
  }
}

export function getRequestSearchParams(event: RequestUrlEvent): URLSearchParams {
  const requestUrl = event.node?.req?.url || event.req?.url || '/'
  return new URL(requestUrl, 'http://localhost').searchParams
}
