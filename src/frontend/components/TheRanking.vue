<template lang="">
    <div>
       The Ranking:
       <ul>
			<li v-for="kommune in kommunen" :key="kommune.id">
				<p>{{ kommune.score_total }}</p>
					<p>{{ kommune.name }}</p>
				
				
				
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