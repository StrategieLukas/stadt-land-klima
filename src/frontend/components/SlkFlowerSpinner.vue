<template>
  <svg
    viewBox="-1 2 112 120"
    xmlns="http://www.w3.org/2000/svg"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-label="Laden…"
    role="status"
  >
    <!--
      5 petals taken verbatim from the SLK logo SVG.
      Each petal path combines the outer teardrop shape and inner circle hole
      using fill-rule="evenodd" so the inner circle punches a transparent hole.
      All petals are rendered in gray with a staggered pulse animation.
      Flower center≈(54, 60.3) in SVG coords → ≈49 % / 49 % of the viewBox.
    -->
    <!-- Petal 1: top -->
    <path
      class="slk-petal"
      style="animation-delay: 0ms"
      fill="#9ca3af"
      fill-rule="evenodd"
      d="M70.6,20.9c0-9.2-8-16.6-16.6-16.6s-16.6,7.4-16.6,16.6c0,1.7-0.4,3.6,2.1,10
         c1.4,3.5,14.5,26.6,14.5,26.6s13.1-23,14.5-26.6C71,24.5,70.6,22.7,70.6,20.9z
         M54,28.5c-3.9,0-7.1-3.2-7.1-7.3c0-4,3.2-7.3,7.1-7.3c3.9,0,7.1,3.2,7.1,7.3
         C61.1,25.2,57.9,28.5,54,28.5z"
    />
    <!-- Petal 2: top-right -->
    <path
      class="slk-petal"
      style="animation-delay: 200ms"
      fill="#9ca3af"
      fill-rule="evenodd"
      d="M95.3,55.5c7.9-4.6,10.4-15.2,6.1-22.7s-14.8-10.7-22.7-6.1
         c-1.5,0.9-3.3,1.4-7.6,6.8c-2.3,2.9-15.7,25.9-15.7,25.9s26.5-0.1,30.3-0.7
         C92.4,57.7,93.8,56.4,95.3,55.5z
         M80.5,44.9c-2-3.4-0.8-7.8,2.7-9.8c3.5-2,7.9-0.9,9.9,2.6
         c2,3.4,0.8,7.8-2.7,9.8C86.9,49.5,82.5,48.3,80.5,44.9z"
    />
    <!-- Petal 3: bottom -->
    <path
      class="slk-petal"
      style="animation-delay: 400ms"
      fill="#9ca3af"
      fill-rule="evenodd"
      d="M37.3,99.7c0,9.2,8,16.6,16.6,16.6s16.6-7.4,16.6-16.6c0-1.7,0.4-3.6-2.1-10
         c-1.4-3.5-14.5-26.6-14.5-26.6s-13.1,23-14.5,26.6C36.9,96.1,37.3,98,37.3,99.7z
         M53.9,92.2c3.9,0,7.1,3.2,7.1,7.3c0,4-3.2,7.3-7.1,7.3c-3.9,0-7.1-3.2-7.1-7.3
         C46.8,95.4,50,92.2,53.9,92.2z"
    />
    <!-- Petal 4: upper-left -->
    <path
      class="slk-petal"
      style="animation-delay: 600ms"
      fill="#9ca3af"
      fill-rule="evenodd"
      d="M29.2,26.7c-7.9-4.6-18.4-1.4-22.7,6.1s-1.9,18.1,6.1,22.7
         c1.5,0.9,2.9,2.2,9.7,3.2c3.7,0.5,30.3,0.7,30.3,0.7S39.2,36.5,36.8,33.5
         C32.5,28.1,30.7,27.6,29.2,26.7z
         M27.4,44.9c-2,3.4-6.4,4.6-9.9,2.6c-3.5-2-4.7-6.4-2.7-9.8
         c2-3.4,6.4-4.6,9.9-2.6C28.2,37,29.4,41.4,27.4,44.9z"
    />
    <!-- Petal 5: lower-left -->
    <path
      class="slk-petal"
      style="animation-delay: 800ms"
      fill="#9ca3af"
      fill-rule="evenodd"
      d="M12.6,65.2C4.6,69.7,2.2,80.4,6.5,87.9c4.3,7.5,14.8,10.7,22.7,6.1
         c1.5-0.9,3.3-1.4,7.6-6.8c2.3-2.9,15.7-25.9,15.7-25.9S26,61.4,22.2,62
         C15.5,63,14.1,64.3,12.6,65.2z
         M27.4,75.8c2,3.4,0.8,7.8-2.7,9.8c-3.5,2-7.9,0.9-9.9-2.6
         c-2-3.4-0.8-7.8,2.7-9.8C21,71.2,25.4,72.4,27.4,75.8z"
    />
  </svg>
</template>

<script setup>
defineProps({
  size: { type: Number, default: 24 },
})
</script>

<style scoped>
.slk-petal {
  /*
   * Scale each petal relative to the flower center (≈49 % / 49 % of viewBox
   * "-1 2 112 120", which corresponds to SVG coordinate (54, 60.3)).
   */
  transform-box: view-box;
  transform-origin: 49% 49%;
  animation: slk-petal-pulse 1s ease-in-out infinite;
}

@keyframes slk-petal-pulse {
  0%, 100% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.8;
  }
}
</style>
