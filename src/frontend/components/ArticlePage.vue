<template>
  <!-- Mobile version -->
  <div class="block lg:hidden project-page bg-[#E8F9FD] shadow-md rounded-md overflow-hidden">

      <div class="p-6">

        <NuxtLink :to="`/projects/`" class="text-blue-500 text-sm">← zurück zur Übersicht</NuxtLink>
  
        <!-- Title and Subtitle -->
        <h1 class="text-2xl font-bold text-blue-500 mb-1">{{ title }}</h1>
        <h2 class="text-lg text-gray-500 mb-4">{{ subtitle }}</h2>

        <!-- Location, Author and Date -->
        <p class="text-sm text-gray-600 mb-1">
          {{ location }}
        </p>
        <p class="text-sm text-gray-600 mb-1">
          <i>Artikel von {{ author }} vom {{ date.toLocaleDateString($locale) }}</i>
        </p>

  
        <!-- Image and Image Credits -->
        <div class="relative mb-4">
          <img v-if="image" :src="toAssetUrl(image)" class="w-full h-full object-cover" />
          <div v-if="organisation" class="absolute top-0 right-0 w-32 h-32 bg-white clip-triangle flex items-center justify-center">
            <img :src="toAssetUrl(organisation.logo)" :alt="`${organisation.name} Logo`" class="absolute top-2 right-2 w-14 h-14" />
          </div>
          <p v-if="image_credits" class="text-xs text-gray-500 mt-1">{{ image_credits }}</p>
        </div>
  
        <!-- Abstract -->
        <p class="text-gray-700 font-semibold mb-4">{{ abstract }}</p>
  
        <!-- Main Text -->
        <div class="text-gray-700 mb-4">
          <div v-html="article_text"></div>
        </div>

        <!-- Organisation note -->
        <p v-if="organisation" class="text-sm text-gray-600 mb-1">
          Ein Projekt von {{ organisation.name }}
        </p>
  
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


  <!-- Desktop version -->
  <div class="hidden lg:block project-page bg-[#E8F9FD] shadow-lg rounded-lg p-8 relative">
    <NuxtLink :to="`/projects/`" class="text-blue-500 text-sm">← zurück zur Übersicht</NuxtLink>
    <!-- Top Right Logo with White Triangle Background -->
    <div v-if="organisation" class="absolute top-0 right-0 w-32 h-32 bg-white clip-triangle flex items-center justify-center">
      <img :src="toAssetUrl(organisation.logo)" :alt="`${organisation.name} Logo`" class="absolute top-2 right-2 w-14 h-14" />
    </div>
    
    <div class="grid grid-cols-3 gap-6">
      <!-- Sidebar -->
      <div class="flex flex-col text-sm text-gray-700 space-y-4 bg-white p-6 rounded-lg shadow-md">
        <div class="w-full h-48 bg-gray-200 flex items-center justify-center mb-4 rounded-lg">
          <span v-if="!image" class="text-gray-500">[Image Placeholder]</span>
          <img v-if="image" :src="toAssetUrl(image)" class="w-full h-full object-cover rounded-lg" />
        </div>

        <p v-if="municipality_name" class="pb-2 border-b border-gray-300 flex justify-between">
          <strong>Kommune</strong>
          <span class="text-right">{{ municipality_name }}</span>
        </p>
        <p v-if="state" class="pb-2 border-b border-gray-300 flex justify-between">
          <strong>Bundesland</strong>
          <span class="text-right">{{ state }}</span>
        </p>
        <p v-if="date" class="pb-2 border-b border-gray-300 flex justify-between">
          <strong>Datum</strong>
          <span class="text-right">{{ date.toLocaleDateString($locale) }}</span>
        </p>
        <p v-if="author" class="pb-2 border-b border-gray-300 flex justify-between">
          <strong>Autor</strong>
          <span class="text-right">{{ author }}</span>
        </p>
        <p v-if="link" class="pb-2 border-b border-gray-300 flex justify-between">
          <strong>Link</strong>
          <a 
            :href="link" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="text-blue-500 hover:underline"
          >{{ link }}</a>
        </p>
        
        <!-- Missing categories: Tag, Municipality size, Contact for this project (i.e. from the local group that did the project, not necessarily the author) -->

        <!-- Social Media Icons -->
        <div class="flex space-x-3 mt-4">
          <!-- <img src="/icons/facebook.svg" class="w-6 h-6" alt="Facebook" /> -->
          <a 
            href="https://www.instagram.com/stadt.land.klima/" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="text-blue-500 hover:underline"
          >
            <img src="~/assets/icons/icon_instagram.svg" class="w-6 h-6" alt="Instagram" />
          </a>

          <a 
            href="https://www.linkedin.com/company/stadt-land-klima" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="text-blue-500 hover:underline"
          >
            <img src="~/assets/icons/icon_linkedin.svg" class="w-6 h-6" alt="LinkedIn" />
          </a>
          
          <!-- <img src="/icons/mastodon.svg" class="w-6 h-6" alt="Mastodon" /> -->
        </div>
      </div>
      
      <!-- Main Content -->
      <div class="col-span-2 flex flex-col">
        <h1 class="text-3xl font-bold text-blue-600 mb-2">{{ title }}</h1>
        <p class="text-lg text-gray-500 mb-6">{{ subtitle }}</p>
        
        <div class="text-gray-700 leading-relaxed flex-grow">
          <div v-html="article_text"></div>
        </div>
      </div>
    </div>
    
    <!-- Footer Buttons -->
    <!-- <div class="flex justify-center space-x-4 mt-8">
      <button class="bg-[#009FE3] text-white px-6 py-3 rounded-full shadow-md hover:bg-[#0082C3] transition">
        Übersicht Erfolgsprojekte
      </button>
      <button class="bg-[#009FE3] text-white px-6 py-3 rounded-full shadow-md hover:bg-[#0082C3] transition flex items-center">
        <span class="mr-2">✖</span> Fenster schließen
      </button>
    </div> -->
  </div>
</template>

<style>
.clip-triangle {
  clip-path: polygon(100% 0, 0 0, 100% 100%);
}
</style>
  
  <script setup>
    import { buildLocationString, toAssetUrl } from '~/shared/utils';
    const { $t, $locale } = useNuxtApp()
    
    const props = defineProps({
        title: String,
        subtitle: String,
        municipality_name: String,
        state: String,
        author: String,
        date: Date,
        image: String,
        image_credits: String,
        abstract: String,
        article_text: String,
        link: String,
        organisation: Object, // can be null
    });

    const location = computed(() => buildLocationString(props.municipality_name, props.state));

  </script>