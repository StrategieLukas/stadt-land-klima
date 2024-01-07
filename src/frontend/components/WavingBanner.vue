<template>
  <div class="w-full px-2">
    <div class="banner mb-3 w-full rounded border-2 border-double border-rating-0 text-center" ref="banner">
      <h1 class="text-rating-0">
        Dies ist eine Test Version.
        <br />
        Bitte <a class="underline" href="mailto:info@stadt-land-klima.de">schreibt</a> uns an, falls ihr Fehler entdeckt. :)
      </h1>
    </div>
  </div>
</template>

<script setup>
const banner = ref(null);
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
