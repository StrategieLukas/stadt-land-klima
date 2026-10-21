import type { FieldListItem } from '#blokkli/types'

export const BLOKKLI_CONTENT_FIELD = 'content'

export function getBlokkliDataKey(
  entityType: string,
  entityUuid: string,
): string {
  return `blokkli-blocks-${entityType}-${entityUuid}`
}

function isBlock(value: unknown): value is Record<string, unknown> & { uuid: string; bundle: string } {
  return !!value && typeof value === 'object' &&
    typeof (value as Record<string, unknown>).uuid === 'string' &&
    typeof (value as Record<string, unknown>).bundle === 'string'
}

export function mapBlokkliBlocks(blocks: unknown): FieldListItem[] {
  if (!Array.isArray(blocks)) return []
  return blocks.filter(isBlock).map((block) => {
    const props = block.props && typeof block.props === 'object' ? block.props : {}
    return {
      uuid: block.uuid,
      bundle: block.bundle,
      // V1 persisted no visibility flag. V2 requires it on root and nested
      // items, otherwise existing published content is filtered out.
      isVisible: block.isVisible !== false,
      options: (block.options || {}) as Record<string, unknown>,
      props: Object.fromEntries(Object.entries(props).map(([key, value]) => [
        key,
        Array.isArray(value) && value.every(isBlock) ? mapBlokkliBlocks(value) : value,
      ])),
    }
  })
}
