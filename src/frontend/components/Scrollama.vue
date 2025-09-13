<template>
  <div ref="container">
    <slot />
  </div>
</template>

<script setup>
const props = defineProps({
  offset: {
    type: Number,
    default: 0.5
  }
})

const emit = defineEmits(['step-enter', 'step-exit'])

const container = ref(null)
let scroller = null

onMounted(async () => {
  if (process.client) {
    try {
      // Import polyfill first
      await import('intersection-observer')
      
      // Then import scrollama
      const { default: scrollama } = await import('scrollama')
      
      // Initialize scrollama
      scroller = scrollama()
      
      scroller
        .setup({
          step: '.step',
          offset: props.offset,
        })
        .onStepEnter((response) => {
          emit('step-enter', response)
        })
        .onStepExit((response) => {
          emit('step-exit', response)
        })
        
      console.log('Scrollama initialized successfully')
      
    } catch (error) {
      console.error('Failed to initialize scrollama:', error)
    }
  }
})

onBeforeUnmount(() => {
  if (scroller) {
    scroller.destroy()
  }
})
</script>