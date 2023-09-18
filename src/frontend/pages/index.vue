<template>
  <div>
    <h1>Land-Stadt-Ranking 2023</h1>
    <sub>Letzte Aktualisierung: 14.09.2023, 10:12</sub>
    <RankingItem v-for="item in items" :key="item.id" :item="item" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      items: [
        { id: 1, name: "Nettetal", score: 75, rank: 1 },
        { id: 2, name: "Mülsen", score: 86, rank: 2 },
        { id: 3, name: "Oberammergau", score: 73, rank: 3 },
        { id: 4, name: "Stendal", score: 45, rank: 4 },
        { id: 5, name: "Bergisch Gladbach", score: 65, rank: 5 },
        { id: 6, name: "Bergkamen", score: 55, rank: 6 },
        { id: 7, name: "Bergneustadt", score: 35, rank: 7 },
        { id: 8, name: "Bergen", score: 25, rank: 8 },
        { id: 9, name: "Bergen auf Rügen", score: 15, rank: 9 },
        { id: 10, name: "Bergisch Gladbach", score: 5, rank: 10 },
      ],
    };
  },
};
</script>
