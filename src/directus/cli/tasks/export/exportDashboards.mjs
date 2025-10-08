import fse from 'fse'
import path from 'path'
import { stringify } from 'yaml'
import { readDashboards } from '@directus/sdk';
import slugify from 'slugify'
import createDirectusClient from '../shared/createDirectusClient.mjs'

async function exportDashboards(dest, options = { verbose: false, overwrite: false }) {
  const client = createDirectusClient()

  try {
    // Fetch all dashboards
    const dashboardsResponse = await client.request(readDashboards({
      method: 'GET',
      url: '/dashboards',
      params: { limit: -1 }
    }))

    const dashboards = dashboardsResponse.data

    if (!fse.existsSync(dest)) fse.mkdirSync(dest, { recursive: true })

    for (const dashboard of dashboards) {
      // Fetch panels/widgets for this dashboard
      const panelsResp = await client.request({
        method: 'GET',
        url: '/panels',
        params: { filter: { dashboard: { _eq: dashboard.id } } }
      })
      const panels = panelsResp.data || []

      const destPath = path.join(dest, `${slugify(dashboard.name || dashboard.id, '_')}.yaml`)

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) console.info(`File ${destPath} already exists.`)
        continue
      }

      // Remove fields we don’t want to export
      const { id, user_created, date_created, user_updated, date_updated, ...dashboardData } = dashboard

      const exportData = {
        ...dashboardData,
        panels: panels.map(({ id, dashboard, user_created, date_created, user_updated, date_updated, ...p }) => p)
      }

      fse.writeFileSync(destPath, stringify(exportData), { encoding: 'utf8' })

      if (options.verbose) console.info(`Exported dashboard: ${dashboard.name}`)
    }

    if (options.verbose) console.info('All dashboards exported.')
  } catch (err) {
    console.error('Error exporting dashboards:', err)
    process.exit(1)
  }
}

export default exportDashboards
