<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">{{ $t("projects.title") }}</h1>

    <div v-if="!projectList || projectList.length === 0">
      {{ $t('projects.empty_placeholder') }}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <ProjectCard
          v-for="(project, index) in projectList"
          :key="index"
          :slug="project.slug"
          :title="project.title"
          :municipality_name="project.municipality_name"
          :state="project.state"
          :abstract="project.abstract"
          :author="project.author"
          :date="project.date_created ? new Date(project.date_created) : null"
          :tag="project.tag"
          :image_id="project.image.id"
          :image_is_raster="isRaster(project.image.type)"
          :organisation="project.organisation"
        />

    </div>
  </div>
</template>

<script setup>
import { isRaster } from "~/shared/utils";
const { $directus, $readItems, $t } = useNuxtApp();

const { data: projectList } = await useAsyncData("articles-index", () => {
  return  $directus.request(
    $readItems("articles", {
      fields: [
        "slug",
        "title",
        "abstract",
        "author",
        "date_created",
        "municipality_name",
        "state",
        { image: ["id", "type"] },
        { organisation: ["id", "name", "logo"]}
      ],
      sort: "-date_created",
      limit: -1,
    })
  );
});

//MetaTags
const title = ref($t("projects.title"));
useHead({
  title,
});

</script>
