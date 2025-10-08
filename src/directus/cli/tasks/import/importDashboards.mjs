import fse from 'fse'
import path from 'path'
import { parse } from 'yaml'
import { createItem, updateItem, readItems } from '@directus/sdk'
import createDirectusClient from '../shared/createDirectusClient.mjs'

async function importDashboards(src, options = { verbose: false, overwrite: false }) {
  const client = createDirectusClient()

  try {
    const files = fse.readdirSync(src).filter((f) => f.endsWith('.yaml'))
    const existingDashboards = await client.request(readItems('directus_dashboards', { limit: -1 }))
    const existingByName = Object.fromEntries(existingDashboards.map(d => [d.name, d]))

    for (const file of files) {
      const filePath = path.join(src, file)
      const dashboardData = parse(fse.readFileSync(filePath, 'utf8'))

      const existing = existingByName[dashboardData.name]

      if (existing) {
        if (options.overwrite) {
          await client.request(updateItem('directus_dashboards', existing.id, dashboardData))
          if (options.verbose) console.info(`Updated existing dashboard: ${dashboardData.name}`)
        } else if (options.verbose) {
          console.info(`Skipped existing dashboard: ${dashboardData.name}`)
        }
      } else {
        await client.request(createItem('directus_dashboards', dashboardData))
        if (options.verbose) console.info(`Created new dashboard: ${dashboardData.name}`)
      }
    }

    if (options.verbose) console.info('All dashboards imported.')
  } catch (err) {
    console.error('Error importing dashboards:', err)
    process.exit(1)
  }
}

export default importDashboards
