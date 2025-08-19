<template lang="">
  <div class="px-5">
    <!-- Logo + Legend -->
    <div class="w-1/4 absolute top-10 right-0">
      <img src="~/assets/images/StadtLandKlima-Logo.svg" class="w-5/6"/>
    </div>

    <!-- HEADING -->
    <h1 class="font-bold text-2xl text-black text-center w-full content-center">
      Stadt-Land-Ranking II/2024
    </h1>

    <div class="flex w-fill h-1/5">
      <div class="grow-5 w-[15rem]">
        <!-- Ploar chart + date -->
        <div class="w-[15rem]">
          <!-- plar chart-->
          <div class="">
            <municipality-polar-chart height="13rem" :sub-scores="subScores" :name-municipality="municipality.name" />
          </div>
          <!-- date -->
          <p class="mb-2 mt-0 text-center text-[5px]">
            {{ $t("municipalities.last_updated_at") + formatLastUpdated(municipality.date_updated) }}
          </p>
        </div>

        <!-- Traffic lights -->
        <div>
          <implementation-traffic-light :small=true />
        </div>
      </div>

      <div class="relative grid grid-cols-6 gap-4 content-center p-10 grow-2">
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
      <div class="gap-3 grid grid-cols-8 font-bold text-[9px] w-96 self-center">
        <div class="h-4"></div>
        <div class="col-span-8">Sektoren</div>
        <div class="content-center">
          <img src="~/assets/icons/icon_category_energy.svg" class=""/>
        </div>
        <div class="col-span-7 content-center">EN - Energie</div>
        <div class="content-center">
          <img src="~/assets/icons/icon_category_bh.svg" class=""/>
        </div>
        <div class="col-span-7 content-center">GW - Gebäude und Wärme</div>
        <div class="content-center">
          <img src="~/assets/icons/icon_category_iec.svg" class=""/>
        </div>
        <div class="col-span-7 content-center">IWK - Industrie, Wirtschaft & Konsum</div>
        <div class="content-center">
          <img src="~/assets/icons/icon_category_cpma.svg" class=""/>
        </div>
        <div class="col-span-7 content-center">KV - Klimaschutz & Verwaltung</div>
        <div class="content-center">
          <img src="~/assets/icons/icon_category_ann.svg" class=""/>
        </div>
        <div class="col-span-7 content-center">LNE - Landwirtschaft, Natur und Ernährung</div>
        <div class="content-center">
          <img src="~/assets/icons/icon_category_transport.svg" class=""/>
        </div>
        <div class="col-span-7 content-center">VK - Verkehr</div>
      </div>

    </div>


    <!-- Result Table -->
    <div class="w-full">
      <table class="w-full text-black text-[10px]">
        <thead>
          <!-- First Row - Icons -->
          <tr class="h-5">
            <th>
            </th>
            <th>
            </th>
            <th class="text-neutral font-light">
              <ul class="flex items-end justify-center gap-4">
                <li v-for="(rating, index) in 4" :key="`rating-image-${index}`" class="flex flex-col items-center">
                  <img :src="ratingIcons[index]" class="h-5" />
                  <div>{{ $t(`measure_rating.${index}_caption`) }}</div>
                </li>
              </ul>
            </th>
            <th>
              <img src="/assets/icons/icon_impact.svg" class="h-[1.5rem] mx-auto"/>
            </th>
            <th>
              <img src="/assets/icons/icon_politics.svg" class="h-[1.5rem] mx-auto"/>
            </th>
            <th>
              <img src="/assets/icons/icon_invest.svg" class="h-[1.5rem] mx-auto"/>
            </th>
          </tr>

          <!-- Second Row Table Heading -->
          <tr class="bg-neutral-200">
            <th></th>
            <th>
              Nummer
            </th>
            <th class="text-left">
              Maßnahme zur CO2-Reduktion
            </th>
            <th class="w-10">
              Impact
            </th>
            <th class="w-10">
              Politisch
            </th>
            <th class="w-10">
              Invest
            </th>
          </tr>
        </thead>
        
        <!-- Iterate Through Data -->
        <tbody>
          <template v-for="(sector, key) in sortedRatings" :key="index">
            <template v-for="(item, index) in sector" :key="key + '-' + index">
              <tr v-if="item.applicable" :class="[ratingColor[ratingIndex(item.rating)], 'bg-opacity-20']">
                <td class="bg-white w-5">
                  <img :src="ratingIcons[ratingIndex(item.rating)]" class="h-[0.8rem] mx-auto"/>
                </td>
                <td class="text-center w-5">
                  {{item.measure.measure_id}}
                </td>
                <td>
                  {{item.measure.name}}
                </td>
                <td>
                  <span v-for="star in Math.max(0, parseInt(item.measure.impact, 10) || 0)" :key="star">★</span>
                </td>
                <td>
                  <span v-for="star in Math.max(0, parseInt(item.measure.feasibility_political, 10) || 0)" :key="star">★</span>
                </td>
                <td>
                  <span v-for="star in Math.max(0, parseInt(item.measure.feasibility_economical, 10) || 0)" :key="star">★</span>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>

    </div>
  </div>
</template>
  
  
<script setup>
  import lodash from "lodash";
  import sanitizeHtml from "sanitize-html";
  import linkifyStr from "linkify-string";
  import sectorImages from "../shared/sectorImages.js";
  import ratingIcons, { ratingIndex } from "../shared/ratingIcons.js";
  import { ratingColor, ratingTextOpacity, ratingHeaderOpacity } from "../shared/ratingColors.js";

  const { range } = lodash;
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

</script>


<style scoped>
@media print {
header, nav, #page-drawer-toggle, footer{
    display: none;
  }
* {
  visibility: visible !important;
}
}
* {
  visibility: hidden;
  height: --spacing(0.5);
}
td {
  /* overflow: hidden; */
  white-space: nowrap;
}
.grid {
  gap: 5px;
}
.scale-polar {
  transform: scale(0.6);
}
table, td, th {
  border: 3px solid;
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
  