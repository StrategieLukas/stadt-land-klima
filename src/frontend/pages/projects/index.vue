<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">{{ $t("projects.title") }}</h1>
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
          :date="new Date(project.date_created)"
          :tag="project.tag"
          :image_id="project.image"
          :organisation="getOrganisation(project.organisation)"
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
      fields: ["slug", "title", "image", "abstract", "author", "date_created", "municipality_name", "state", "organisation"],
      sort: "-date_created",
      limit: -1,
    }),
  );
});

const projectList = computed(() => projects.value || []);

const { data: organisations } = await useAsyncData("organisations", () => {
  return $directus.request(
    $readItems("organisations", {
      fields: ["id", "name", "logo", "link"],
    }));
});

function getOrganisation(org) {
  if (!org || !organisations.value) return null;
  return organisations.value.find((o) => o.id === org.key);
}

//MetaTags
const title = ref($t("projects.title"));
useHead({
  title,
});

</script>