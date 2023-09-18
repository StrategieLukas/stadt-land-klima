<template>
  <div>
    <h3>{{ item.rank }} - {{ item.name }}</h3>
    <p>{{ item.score }}/100</p>
  </div>
</template>

<script>
export default {
  props: {
    item: {
      type: Object,
      required: true,
    },
  },
};
</script>
