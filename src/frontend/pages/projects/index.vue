<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">{{ $t("projects.title") }}</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <ProjectCard
          v-for="(project, index) in projects"
          :key="index"
          :slug="project.slug"
          :title="project.title"
          :municipality_name="project.municipality_name"
          :state="project.state"
          :abstract="project.abstract"
          :date="new Date(project.date_created)"
          :tag="project.tag"
          :image_id="project.image"
          :organisation="getOrganisation(project.organisation.key)"
        />

    </div>
  </div>
</template>

<script setup>
import ProjectCard from "~/components/ProjectCard.vue";
const { $directus, $readItems, $t } = useNuxtApp();

const { data: projects } = await useAsyncData("articles", () => {
  return $directus.request(
    $readItems("articles", {
      fields: ["slug", "title", "image", "abstract", "date_created", "municipality_name", "state", "organisation"],
      sort: "-date_created",
      limit: -1,
    }),
  )
});

const { data: organisations } = await useAsyncData("organisations", () => {
  return $directus.request(
    $readItems("organisations", {
      fields: ["id", "name", "logo", "link"],
    }));
});



function getOrganisation(org_id) {
  return organisations.value.find((org) => org.id === org_id);
}

//MetaTags
const title = ref($t("projects.title"));
useHead({
  title,
});

</script>