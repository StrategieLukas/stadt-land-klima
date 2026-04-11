<template>
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-label="Laden…"
    role="status"
  >
    <!--
      5 petals at 72° intervals, matching the SLK flower signet.
      Each petal is an ellipse that scales from its inner edge (near flower center)
      outward, staggered so the animation travels around the flower.
      Colors: yellow → orange → lime → blue → dark-green (clockwise from top).
    -->
    <g v-for="(color, i) in colors" :key="i" :transform="`rotate(${i * 72}, 12, 12)`">
      <ellipse
        cx="12"
        cy="4.5"
        rx="2"
        ry="3.5"
        :fill="color"
        class="slk-petal"
        :style="{ animationDelay: `${i * 160}ms` }"
      />
    </g>
  </svg>
</template>

<script setup>
defineProps({
  size: { type: Number, default: 24 },
})

// SLK brand colours: yellow, orange, lime-green, sky-blue, dark-green
const colors = ['#FFDD00', '#F39200', '#AFCA0B', '#16BAE7', '#1EA64A']
</script>

<style scoped>
.slk-petal {
  /* scale from the inner edge of the petal (bottom of its own bounding box),
     so the petal grows outward from the flower center */
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: slk-petal-pulse 1s ease-in-out infinite;
}

@keyframes slk-petal-pulse {
  0%, 100% {
    transform: scale(0.65);
    opacity: 0.35;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}
</style>
