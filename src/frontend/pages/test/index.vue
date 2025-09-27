<template>
  <div>
    <h1>Municipality PDF</h1>
    <input v-model="slug" placeholder="Enter municipality slug" />
    <button @click="fetchPDF">Get PDF</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRuntimeConfig } from '#app';

const slug = ref('');
const config = useRuntimeConfig(); // Nuxt 3 way to access runtime config

async function fetchPDF() {
  if (!slug.value) return;

  try {
    const baseUrl = config.public.clientDirectusUrl;
    const token = config.public.directusToken;

    const response = await fetch(`${baseUrl}/pdf-service/municipality/${slug.value}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ slug: slug.value }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

  } catch (err) {
    console.error('Error fetching PDF:', err);
  }
}
</script>
