<template>
    <div class="project-page bg-white shadow-md border rounded-md overflow-hidden">
      <div class="p-6">
        <!-- Location, Author, Date -->
        <p class="text-sm text-gray-600 mb-1">
          {{ location }}
        </p>
        <p class="text-sm text-gray-600 mb-1">
          {{ date.toLocaleDateString($locale) }},  {{ author }}
        </p>
  
        <!-- Title and Subtitle -->
        <h1 class="text-2xl font-bold text-blue-500 mb-1">{{ title }}</h1>
        <h2 class="text-lg text-gray-500 mb-4">{{ subtitle }}</h2>
  
        <!-- Image and Image Credits -->
        <div class="relative mb-4">
          <img v-if="image" :src="toAssetUrl(image)" class="w-full h-full object-cover" />
          <p v-if="image_credits" class="text-xs text-gray-500 mt-1">{{ image_credits }}</p>
        </div>
  
        <!-- Abstract -->
        <p class="text-gray-700 font-semibold mb-4">{{ abstract }}</p>
  
        <!-- Main Text -->
        <div class="text-gray-700 mb-4">
          <div v-html="article_text"></div>
        </div>
  
        <!-- Contact Information -->
        <!-- <div class="border-t pt-4 mt-4">
          <h3 class="text-lg font-semibold mb-2">Kontakt zu den Verantwortlichen:</h3>
          <p class="text-blue-500">
            <a :href="contact.link" target="_blank">{{ contact.text }}</a>
          </p>
        </div> -->
  
        <!-- Navigation Links -->
        <!-- <div class="flex justify-between mt-6">
          <NuxtLink to="#" class="text-blue-500 text-sm">← vorherige Story</NuxtLink>
          <NuxtLink to="#" class="text-blue-500 text-sm">nächste Story →</NuxtLink>
        </div> -->
      </div>
    </div>
  </template>
  
  <script setup>
    import { buildLocationString, toAssetUrl } from '~/shared/utils';
    const { $t, $locale } = useNuxtApp()
    
    const props = defineProps({
        municipality_name: String,
        state: String,
        author: String,
        date: Date,
        title: String,
        subtitle: String,
        image: String,
        image_credits: String,
        abstract: String,
        article_text: String,
    });

    const location = computed(() => buildLocationString(props.municipality_name, props.state));


  </script>