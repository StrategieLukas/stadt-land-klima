<template>
    <div class="dock dock-xl bg-white/80 backdrop-blur-lg border-t border-gray-200 text-color-black flex justify-around items-center">
        <button 
            v-for="page in pages" 
            :key="page.id"
            :class="{ 'dock-active': isPageActive(page.slug) }"
            @click="followLink(page.slug); closeDrawer()"
            class="flex flex-col items-center justify-end min-w-0 min-h-[48px] py-3"
        >
            <div class="size-[3em]">
                <div v-html="page.icon_svg"></div>
            </div>
            <span class="dock-label text-center text-sm truncate max-w-full">{{ page.name }}</span>
        </button>

        <button 
            id="page-drawer-toggle"
            @click="toggleDrawer"
            :class="{ 'dock-active': isDrawerOpen }"
            class="flex flex-col items-center justify-end min-w-0 min-h-[48px] py-3"
        >
            <svg class="size-[3em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" />
            </svg>
            <span class="dock-label text-center text-sm truncate max-w-full">{{ $t('generic.menu') }}</span>
        </button>
    </div>
</template>

<script setup>
import { defineProps } from "vue";
const { $t } = useNuxtApp();
const route = useRoute();
const props = defineProps(["pages"]);

// Use the shared drawer state
const { isDrawerOpen, toggleDrawer, closeDrawer } = useDrawer();

// Check if current page is active - mimicking TheHeaderDesktop.vue logic
const isPageActive = (slug) => {
    return route.path === `/${slug}` || (route.path === '/' && slug === '');
};

const followLink = (pageSlug) => {
    const nuxtApp = useNuxtApp();
    nuxtApp.$router.push('/' + pageSlug);
};
</script>

<style scoped>
.dock-active {
    color: #afca0b !important;
}

.dock-active svg {
    color: #afca0b !important;
}
</style>