export default defineEventHandler((event) => {
  const url = new URL(event.path, 'http://localhost')
  const previewToken = url.searchParams.get('preview')
  if (previewToken) {
    setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
  }
})
