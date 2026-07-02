let lokalteamAdminRoleId: string | null = null
const lokalteamAdminRoleNames = ['LokalteamAdmin', 'AdminLokalteam']

export async function getLokalteamAdminRoleId(): Promise<string> {
  if (lokalteamAdminRoleId) return lokalteamAdminRoleId

  const config = useRuntimeConfig()
  const directusUrl = (config.directusServerUrl as string) || 'http://directus:8055'

  for (const roleName of lokalteamAdminRoleNames) {
    const result = await $fetch<{ data: Array<{ id: string }> }>(
      `${directusUrl}/roles`,
      {
        headers: { Authorization: `Bearer ${config.directusAdminToken}` },
        params: { 'filter[name][_eq]': roleName, 'fields[]': 'id', limit: 1 },
      },
    )
    const id = result.data?.[0]?.id
    if (id) {
      lokalteamAdminRoleId = id
      return id
    }
  }

  throw new Error(`[directusRoles] Lokalteam admin role not found in Directus. Tried: ${lokalteamAdminRoleNames.join(', ')}`)
}
