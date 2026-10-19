import { municipalityPageHandler } from '../../../utils/municipalityPageData'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  return municipalityPageHandler(event, true)
})
