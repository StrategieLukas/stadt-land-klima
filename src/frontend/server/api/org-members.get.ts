export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const baseUrl: string = (config.directusServerUrl as string) || 'http://directus:8055'
  const token: string = (config.public.directusToken as string) || ''

  const result = await $fetch<{ data: unknown[] }>(
    `${baseUrl}/users`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        'fields[]': ['id', 'first_name', 'last_name', 'avatar', 'bio', 'slk_team'],
        'filter[show_on_team_page][_eq]': true,
        limit: -1,
      },
    },
  )

  return result.data ?? []
})
