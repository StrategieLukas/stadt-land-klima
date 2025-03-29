<template>
    <div class="card bg-white shadow-md border rounded-md overflow-hidden">
        <div class="relative">

            <NuxtLink :to="`/projects/${slug}`" class="h-40 bg-gray-200 flex items-center justify-center relative">
                <img :src="toAssetUrl(image_id)" alt="Project Image" class="object-cover w-full h-full" />
                <div v-if="tag" class="absolute top-2 left-2 bg-yellow-400 text-xs px-2 py-1 rounded">
                    {{ tag }}
                </div>

                <!-- Mini-Logo, if article has associated organisation -->
                <div v-if="organisation" class="absolute top-0 right-0 w-28 h-28 overflow-hidden">
                    <div
                        class="absolute top-0 right-0 w-0 h-0 border-t-[7rem] border-t-white border-l-[7rem] border-l-transparent">
                    </div>
                    <img :src="toAssetUrl(organisation.logo)" :alt="`${organisation.name} Logo`"
                        class="absolute top-2 right-2 w-12 h-12" />
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

                <!-- Read more link -->
                <NuxtLink :to="`/projects/${slug}`" class="text-blue-500 text-sm">{{ $t("article.read_more") }} →
                </NuxtLink>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { buildLocationString, toAssetUrl }from '~/shared/utils';
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
    organisation: Object, // can be null
})


const location = computed(() => buildLocationString(props.municipality_name, props.state));


const truncatedAbstract = computed(() => {
    if (props.abstract && props.abstract.length > 300) {
        return props.abstract.substring(0, 300) + '...';
    }
    return props.abstract;
});


</script>

<style scoped>
.card img {
    object-fit: cover;
}
</style>