<template>
    <div class="card bg-white shadow-xl rounded-none overflow-hidden max-w-[400px]">
        <div class="relative">

            <NuxtLink :to="`/projects/${slug}`" class="group h-40 bg-gray-200 flex items-center justify-center relative">
                <SmartImg
                    :assetId="image_id"
                    :isRaster="image_is_raster"
                    :alt="title"
                    :height="160"
                    :width="400"
                    fit="cover"
                    sizes="(max-width: 768px) 312px, 400px"
                    format="webp"
                    img-class="object-cover w-full h-full"
                    />
                <div v-if="tag" class="absolute top-2 left-2 bg-yellow-400 text-xs px-2 py-1 rounded">
                    {{ tag }}
                </div>

                <!-- Mini-Logo, if article has associated organisation -->
                <div v-if="organisation" class="absolute top-0 right-0 w-28 h-28 overflow-hidden">
                    <div
                        class="absolute top-0 right-0 w-0 h-0 border-t-[7rem] border-t-white border-l-[7rem] border-l-transparent">
                    </div>
                    <!-- Using raw image url (no width parameter) for easier request caching as organisation logos should be small -->
                    <img fit="cover" class="absolute top-2 right-2" height="48" width="48" :alt="organisation.name" loading="lazy"
                    :src="getRawUrl(organisation.logo)"/>
                </div>

                <!-- Image credits overlay on hover -->
                <div v-if="image_credits" class="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 truncate">
                  {{ image_credits }}
                </div>
            </NuxtLink>



            <!-- Card Content -->
            <div class="p-4">
                <NuxtLink :to="`/projects/${slug}`">
                    <h2 class="text-blue-500 font-semibold mb-2">
                        {{ title }}
                    </h2>
                </NuxtLink>
                <p class="text-sm font-bold mb-1">
                    {{ location }}
                </p>

                <!-- Truncated abstract text -->
                <p class="text-gray-600 text-sm mb-2">
                    {{ truncatedAbstract }}
                </p>

                <!-- Author and Date Section -->
                <p class="text-gray-500 italic text-xs mb-2">
                    {{ author }}, {{ date.toLocaleDateString($locale) }}
                </p>

                <!-- Measures -->
                <div v-if="measures && measures.length" class="flex flex-wrap gap-1 mb-2">
                  <NuxtLink
                    v-for="m in measures"
                    :key="m.id"
                    :to="`/measures/${m.slug || m.id}`"
                    class="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded hover:bg-blue-200 transition"
                  >{{ m.measure_id }}</NuxtLink>
                </div>

                <!-- Read more link -->
                <NuxtLink :to="`/projects/${slug}`" class="text-blue-500 text-sm">{{ $t("article.read_more") }} →
                </NuxtLink>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { buildLocationString }from '~/shared/utils';
const { $locale } = useNuxtApp();

const props = defineProps({
    slug: String,
    title: String,
    municipality_name: String,
    state: String,
    abstract: String,
    author: String,
    date: Date,
    tag: String,
    image_id: String,
    image_is_raster: Boolean,
    image_credits: { type: String, default: null },
    organisation: Object, // can be null
    measures: Array, // can be null/empty
})

const config = useRuntimeConfig();
const location = computed(() => buildLocationString(props.municipality_name, props.state));


const truncatedAbstract = computed(() => {
    if (props.abstract && props.abstract.length > 300) {
        return props.abstract.substring(0, 300) + '...';
    }
    return props.abstract;
});

function getRawUrl(assetId) {
    return `${config.public.clientDirectusUrl}/assets/${assetId}`;
}


</script>

<style scoped>
.card img {
    object-fit: cover;
}
</style>
