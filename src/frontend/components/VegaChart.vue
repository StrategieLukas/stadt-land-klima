<template>
  <div ref="containerRef" class="relative w-full" :style="height ? `height:${height}px` : 'height:100%'">
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
      <SlkFlowerSpinner :size="24" />
    </div>
    <div
      v-if="renderError"
      class="absolute inset-0 flex items-center justify-center text-xs text-gray-400"
    >
      Diagramm konnte nicht geladen werden.
    </div>
    <div ref="vegaRef" class="w-full h-full" />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  spec: {
    type: Object,
    required: true,
  },
  height: {
    type: Number,
    default: null,
  },
})

const containerRef = ref(null)
const vegaRef = ref(null)
const loading = ref(false)
const renderError = ref(false)
let vegaView = null

async function render() {
  if (!vegaRef.value || !props.spec) return
  loading.value = true
  renderError.value = false

  try {
    const { default: vegaEmbed } = await import('vega-embed')

    if (vegaView) {
      vegaView.finalize()
      vegaView = null
    }
    vegaRef.value.innerHTML = ''

    const result = await vegaEmbed(vegaRef.value, props.spec, {
      renderer: 'canvas',
      actions: false,
      config: {
        background: 'transparent',
        font: 'inherit',
      },
    })
    vegaView = result.view
  } catch (e) {
    console.warn('[VegaChart] render error:', e)
    renderError.value = true
  } finally {
    loading.value = false
  }
}

watch(() => props.spec, () => render(), { deep: true })

onMounted(() => render())

onUnmounted(() => {
  if (vegaView) {
    vegaView.finalize()
    vegaView = null
  }
})
</script>
