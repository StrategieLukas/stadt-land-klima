let lokalteamAdminRoleId: string | null = null

export async function getLokalteamAdminRoleId(): Promise<string> {
  if (lokalteamAdminRoleId) return lokalteamAdminRoleId

  const config = useRuntimeConfig()
  const result = await $fetch<{ data: Array<{ id: string }> }>(
    `${(config.directusServerUrl as string) || 'http://directus:8055'}/roles`,
    {
      headers: { Authorization: `Bearer ${config.directusAdminToken}` },
      params: { 'filter[name][_eq]': 'AdminLokalteam', 'fields[]': 'id', limit: 1 },
    },
  )
  const id = result.data?.[0]?.id
  if (!id) throw new Error('[directusRoles] AdminLokalteam role not found in Directus')
  lokalteamAdminRoleId = id
  return id
}
