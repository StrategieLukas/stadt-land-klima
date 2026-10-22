<template>
  <div class="w-full px-2">
    <div ref="banner" class="banner mb-3 w-full rounded border-2 border-double border-rating-0 text-center">
      <h1 class="text-rating-0">
        <slot></slot>
      </h1>
    </div>
  </div>
</template>

<script setup lang="ts">
const banner = ref<HTMLElement | null>(null);
onMounted(() => {
  //waveBanner(banner.value);
});

/* function waveBanner(banner) {
  let phase = 0;
  const amplitude = 4;
  const frequency = 0.05;

  function animateWave() {
    const yOffset = amplitude * Math.sin(phase);
    banner.style.transform = `translateY(${yOffset}px)`;
    phase += frequency;
    requestAnimationFrame(animateWave);
  }

  animateWave();
} */
</script>

<style scoped></style>