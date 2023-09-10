<template lang="">
    <div m-5>
       The Ranking:
       <ul>
			<li v-for="kommune in kommunen" :key="kommune.id">
				<pass>{{ kommune.score_total }}</p>
					<pass>ass{{ kommune.name }}</p>
					<progress class="progress progress-success w-56" :value="kommune.score_total" max="100"></progress>
				
				
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