export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const endpoint = config.listmonkEndpoint as string | undefined
  const username = config.listmonkApiUsername as string | undefined
  const token = config.listmonkApiToken as string | undefined

  if (!endpoint || !username || !token) {
    throw createError({ statusCode: 503, message: 'Newsletter-Dienst nicht konfiguriert.' })
  }

  const credentials = Buffer.from(`${username}:${token}`).toString('base64')

  try {
    const result = await $fetch<{
      data: {
        results: Array<{ id: number; name: string; description: string; type: string }>
      }
    }>(`${endpoint}/api/lists`, {
      headers: { Authorization: `Basic ${credentials}` },
      query: { page: 1, per_page: 100 },
    })

    const lists = (result?.data?.results ?? [])
      .filter((l) => l.type === 'public')
      .map((l) => ({ id: l.id, name: l.name, description: l.description ?? '' }))

    return { lists }
  } catch (err) {
    console.error('[newsletter-lists] Listmonk error:', err)
    throw createError({ statusCode: 502, message: 'Newsletter-Listen konnten nicht geladen werden.' })
  }
})
