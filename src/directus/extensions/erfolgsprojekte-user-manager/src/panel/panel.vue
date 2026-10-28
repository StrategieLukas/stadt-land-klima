<template>
  <InvitationForm endpoint="/erfolgsprojekte-users/invite" />
</template>
<script setup lang="ts">
import InvitationForm from "../shared/InvitationForm.vue";
defineProps({ showHeader: { type: Boolean, default: false } });
</script>
