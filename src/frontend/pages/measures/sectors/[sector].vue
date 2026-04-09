<script setup>
const route = useRoute();
const sector = route.params.sector;
const v = route.query.v;
throw navigateTo(`/measures?sector=${sector}${v ? `&v=${v}` : ''}`, { redirectCode: 301 });
</script>
<template></template>
