<template lang="">
    <div class="w-fill grid grid-cols-6">
      <h1 class="col-span-4 font-bold text-3xl text-black text-right pr-5 content-center">Stadt-Land-Ranking II/2024</h1>
      <img src="~/assets/images/StadtLandKlima-Logo.svg" class="h-24 float-right flex-1"/>

      <div class="col-span-2">
        <div class="mb-4">
          <municipality-polar-chart :sub-scores="subScores" :name-municipality="municipality.name" />
        </div>
        <p class="mb-4 mt-0 text-center text-xs">
          {{ $t("municipalities.last_updated_at") + formatLastUpdated(municipality.date_updated) }}
        </p>
      </div>

      <div class="col-span-2 relative grid grid-cols-6 gap-4 content-center p-10">
        <div class="relative h-full pt-6">
          <img src="~/assets/icons/icon_location_green_marker.svg" class="my-auto h-auto w-8" />

          <div class="absolute top-0 w-full text-center font-heading text-h1 font-bold text-black">
            {{ municipality.place || "?" }}
          </div>
        </div>

        <div class="grow">
          <div class="flex flex-row items-start">
            <div class="mb-2">
              <h3 class="font-heading text-h1 font-bold text-black">{{ municipality.name }}</h3>
              <p>{{ municipality.state }}</p>
            </div>
          </div>
        </div>

        <div class="col-span-5">
          <progress-bar :score-total="scoreTotalRounded"></progress-bar>
        </div>
      </div>

      <!-- Legend -->
      <div class="col-span-2 gap-3 grid grid-cols-8 text-black font-bold text-sm">
        <div class="content-center"></div>
        <div class="col-span-8">Sektoren</div>
        <div class="content-center">
          <img src="~/assets/icons/icon_category_energy.svg" class=""/>
        </div>
        <div class="col-span-7 content-center">EN – Energie</div>
        <div class="content-center">
          <img src="~/assets/icons/icon_category_bh.svg" class=""/>
        </div>
        <div class="col-span-7 content-center">GW – Gebäude und Wärme</div>
        <div class="content-center">
          <img src="~/assets/icons/icon_category_iec.svg" class=""/>
        </div>
        <div class="col-span-7 content-center">IWK – Industrie, Wirtschaft & Konsum</div>
        <div class="content-center">
          <img src="~/assets/icons/icon_category_cpma.svg" class=""/>
        </div>
        <div class="col-span-7 content-center">KV – Klimaschutz & Verwaltung</div>
        <div class="content-center">
          <img src="~/assets/icons/icon_category_ann.svg" class=""/>
        </div>
        <div class="col-span-7 content-center">LNE – Landwirtschaft, Natur und Ernährung</div>
        <div class="content-center">
          <img src="~/assets/icons/icon_category_transport.svg" class=""/>
        </div>
        <div class="col-span-7 content-center">VK –Verkehr</div>
      </div>

      <!-- Traffic lights -->
      <div class="text-xs col-span-3">
        <implementation-traffic-light class=""/>
      </div>
    </div>

    <div>
    </div>

    <div class="w-full">
      <table class="w-full text-black text-xs">
        <thead>
          <!-- First Row - Icons -->
          <tr class="h-5">
            <th>
            </th>
            <th>
            </th>
            <th class="text-neutral font-light">
              <ul class="mb-2 flex items-end justify-center gap-4">
                <li v-for="(rating, index) in 4" :key="`rating-image-${index}`" class="flex flex-col items-center">
                  <img :src="ratingImages[index]" class="h-5" />
                  <div class="text-xs">{{ $t(`measure_rating.${index}_caption`) }}</div>
                </li>
              </ul>
            </th>
            <th>
              <img src="/assets/icons/icon_impact.svg" class="h-10 mx-auto"/>
            </th>
            <th>
              <img src="/assets/icons/icon_politics.svg" class="h-10 mx-auto"/>
            </th>
            <th>
              <img src="/assets/icons/icon_invest.svg" class="h-10 mx-auto"/>
            </th>
          </tr>

          <!-- Second Row Table Heading -->
          <tr class="bg-neutral-200">
            <th>
              .
            </th>
            <th>
              Nummer
            </th>
            <th class="text-left">
              Maßnahme zur CO2-Reduktion
            </th>
            <th>
              Impact
            </th>
            <th>
              Politisch
            </th>
            <th>
              Invest
            </th>
          </tr>
        </thead>

        <!-- Iterate Through Data -->
        <tbody>
          <template v-for="(sector, key) in sortedRatings" :key="index">
            <template v-for="(item, index) in sector" :key="key + '-' + index">
              <tr v-if="item.applicable" :class="[ratingColor[ratingIndex(item.rating)], 'bg-opacity-20']">
                <td class="bg-white w-10">
                  <img :src="ratingImages[ratingIndex(item.rating)]" class="h-5 mx-auto"/>
                </td>
                <td class="text-center w-5">
                  {{item.measure.measure_id}}
                </td>
                <td>
                  {{item.measure.name}}
                </td>
                <td>
                  <span v-for="star in item.measure.impact" :key="star">★</span>
                </td>
                <td>
                  <span v-for="star in item.measure.feasibility_political" :key="star">★</span>
                </td>
                <td>
                  <span v-for="star in item.measure.feasibility_economical" :key="star">★</span>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>

    </div>
  </template>
  
  
<script setup>
  import lodash from "lodash";
  import sanitizeHtml from "sanitize-html";
  import linkifyStr from "linkify-string";
  const { range } = lodash;
  import sectorImages from "../shared/sectorImages.js";
  import ratingImages from "../shared/ratingImages.js";
  import { ratingColor, ratingTextOpacity, ratingHeaderOpacity } from "../shared/ratingColors.js";
  const { $t, $locale } = useNuxtApp();
  const props = defineProps({
    municipality: {
      type: Object,
      required: true,
    },
    sortedRatings: {
      type: Object,
      required: true,
    },
  });
  


  const scoreTotalRounded = Math.round(Number(props.municipality.score_total) * 10) / 10;

  /**
   * @param {string} dateString
   * @returns {string} Properly formatted date and time
   */
  const formatLastUpdated = (dateString) => {
    const lastUpdatedAt = new Date(dateString);
    return `${lastUpdatedAt.toLocaleDateString($locale, {
      year: "numeric",
      month: "2-digit",
      day: "numeric",
    })}, ${lastUpdatedAt.toLocaleTimeString($locale)}`;
  };
  
  const municipality = props.municipality;
  const subScores = createSubScoreObject(municipality);
  
  function createSubScoreObject(municipality) {
    const temp = {};
    for (const [key, value] of Object.entries(municipality)) {
      if (key.includes("score")) {
        temp[key] = Number(value);
      }
    }
    return temp;
  }
  function ratingIndex(value) {
    const tempVal = Number(value);
    if (tempVal === 0) return 0;
    if (tempVal === 0.3333) return 1;
    if (tempVal === 0.6666) return 2;
    return 3;
  }
</script>


<style scoped>
@media print {
header, nav, #page-drawer-toggle, footer{
    display: none;
}
}

table, td, th {
  border: 5px solid;
  border-color: white;
  padding: 0 5px;
}

table {
  width: 100%;
  border-collapse: collapse;
}
td {
  height: min-content;
}
</style>
  