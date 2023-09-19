<template lang="">
    <div m-5>
       The Ranking:
       <ul>
			<li v-for="kommune in kommunen" :key="kommune.id">
				<p>{{ kommune.score_total }}</p>
					<p>{{ kommune.name }}</p>
					<ProgressBarCity/>
					<progress class="progress progress-success w-56" :value="kommune.score_total" max="100"></progress>
					<DetailCityRanking />
				
			</li>
		</ul>
    </div>
</template>
<script setup >
const props = defineProps(['kommunen'])
const { kommunen } = props;
console.log(kommunen)

</script>
<style lang="">
    
</style>