export const BLOKKLI_CONTENT_FIELD = 'content'

export function getBlokkliDataKey(
  entityType: string,
  entityUuid: string,
): string {
  return `blokkli-blocks-${entityType}-${entityUuid}`
}

export function mapBlokkliBlocks(blocks: any[] | null | undefined) {
  return (blocks ?? [])
    .filter((block) => block?.uuid && block?.bundle)
    .map((block) => ({
      uuid: block.uuid,
      bundle: block.bundle,
      options: block.options || {},
      props: block.props || {},
    }))
}
