import { z } from "zod";
import { ClimateToolSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { defineEventHandler, setResponseHeader } from 'h3'
import { readPublicItems } from '../../utils/publicItems'

const toolFields = ['id', 'title', 'description', 'category', 'link', 'image', 'image_credits', 'vendor', 'sort']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')

  const tools = await readPublicItems('climate_tools', {
    filter: { status: { _eq: 'published' } },
    fields: [...toolFields.filter(field => field !== 'image'), 'image.id', 'image.type'],
    sort: ['sort'],
  })

  return { tools: parseCms(z.array(ClimateToolSchema), tools) }
})
