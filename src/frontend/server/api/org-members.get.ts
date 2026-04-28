export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const baseUrl: string = (config.directusServerUrl as string) || 'http://directus:8055'
  const token: string = (config.public.directusToken as string) || ''

  // Note: no explicit filter[show_on_team_page] needed — the row-level permission
  // on the frontend role already restricts results to show_on_team_page = true.
  const result = await $fetch<{ data: unknown[] }>(
    `${baseUrl}/users`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        'fields[]': ['id', 'first_name', 'last_name', 'avatar', 'bio', 'slk_team'],
        limit: -1,
      },
    },
  )

  return result.data ?? []
})
