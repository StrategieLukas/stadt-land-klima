<template lang="">
    <div>
        ITEM IN RANKING
        <p>{{ kommune.score_total }}</p>
					<p>{{ kommune.name }}</p>
					<ProgressBarCity/>
					<progress class="progress progress-success w-56" :value="kommune.score_total" max="100"></progress>
					<DetailCityRanking :kommune="kommune"/>
    </div>
</template>
<script setup >
const props = defineProps(['kommune']);
const { kommune } = props;


</script>
<style lang="">

</style>

