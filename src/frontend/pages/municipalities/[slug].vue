<template>
  <!-- PREVIEW_LOCKED: unverified creator, no valid token -->
  <div v-if="pageView === PV.PREVIEW_LOCKED" class="mt-10">
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue">
      &larr; {{ backLabel }}
    </NuxtLink>
    <div class="mt-6 flex flex-col sm:flex-row sm:items-start gap-4 rounded-sm border-l-4 border-rating-1 bg-rating-1-very-light px-5 py-4">
      <img src="~/assets/icons/icon_hint.svg" class="h-7 w-7 flex-shrink-0 mt-0.5 hidden sm:block" style="filter: brightness(0) saturate(100%) invert(62%) sepia(100%) saturate(520%) hue-rotate(355deg) brightness(95%)" />
      <div class="flex-1 min-w-0">
        <p class="font-heading font-bold text-gray text-base leading-snug mb-1">
          Zugriff eingeschränkt: \u201e{{ previewMuniName }}\u201c
        </p>
        <p class="text-sm leading-snug mb-3 text-mid-gray">
          Der Lokalteam-Administrator wurde noch nicht verifiziert. Der Zugang ist eingeschränkt und erfordert
          einen gültigen Vorschau-Token. Melde dich, um verifiziert zu werden.
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            @click="copyShareLink('preview')"
            class="px-4 py-1.5 text-sm font-medium border border-rating-1 text-rating-1 rounded-md hover:bg-rating-1-light transition-colors"
          >{{ copiedState.preview ? '\u2713 Link kopiert' : 'Share-Link kopieren' }}</button>
          <NuxtLink
            :to="`/contact?title=${encodeURIComponent('Verifizierung Lokalteam ' + previewMuniName)}&type=cooperation&content=${encodeURIComponent('Ich bitte um Verifizierung meines Lokalteam-Accounts für ' + previewMuniName + '.\n\nMeine Kontaktdaten:\n')}`"
            class="px-4 py-1.5 text-sm font-semibold bg-olive-green text-white rounded-md hover:opacity-90 transition-colors"
          >Kontakt aufnehmen \u2192</NuxtLink>
        </div>
      </div>
    </div>
  </div>

  <!-- IN_PROGRESS_LOCKED: published but incomplete rating, requires ?preview=true -->
  <div v-else-if="pageView === PV.IN_PROGRESS_LOCKED" class="mt-10">
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue">
      &larr; {{ backLabel }}
    </NuxtLink>
    <div class="mt-6 flex flex-col sm:flex-row sm:items-start gap-4 rounded-sm border-l-4 border-rating-1 bg-rating-1-very-light px-5 py-4">
      <img src="~/assets/icons/icon_hint.svg" class="h-7 w-7 flex-shrink-0 mt-0.5 hidden sm:block" style="filter: brightness(0) saturate(100%) invert(62%) sepia(100%) saturate(520%) hue-rotate(355deg) brightness(95%)" />
      <div class="flex-1 min-w-0">
        <p class="font-heading font-bold text-gray text-base leading-snug mb-1">
          Bewertung noch in Bearbeitung: „{{ directusData.municipalityScore.municipality.name }}"
        </p>
        <p class="text-sm leading-snug mb-3 text-mid-gray">
          Diese Gemeinde bewertet gerade ihren kommunalen Klimaschutz – die Bewertung ist noch nicht abgeschlossen
          und daher noch nicht öffentlich sichtbar. Du kannst das Lokalteam unterstützen oder eine
          benachbarte Gemeinde erkunden.
        </p>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            :to="`/contact?title=${encodeURIComponent('Mitarbeit Lokalteam ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + directusData.municipalityScore.municipality.name + ' mithelfen.\n\nMeine Kontaktdaten:\n')}`"
            class="px-4 py-1.5 text-sm font-semibold bg-olive-green text-white rounded-md hover:opacity-90 transition-colors"
          >Lokalteam kontaktieren →</NuxtLink>
        </div>
      </div>
    </div>
    <NearbyMunicipalitiesCarousel
      :ars="directusData.municipalityScore.municipality.ars"
      :catalog-version-id="selectedCatalogVersion.id"
      :catalog-version-name="selectedCatalogVersion.name"
      class="my-8"
    />
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue">
      &larr; {{ backLabel }}
    </NuxtLink>
  </div>

  <!-- RATED_*: all states that render <detail-municipality> -->
  <div v-else-if="isRatedView">
    <!-- RATED_DRAFT: unlocked draft preview — share banner with copy button -->
    <div
      v-if="pageView === PV.RATED_DRAFT"
      class="mb-6 flex flex-col sm:flex-row sm:items-start gap-4 rounded-sm border-l-4 border-rating-1 bg-rating-1-very-light px-5 py-4"
    >
      <img src="~/assets/icons/icon_hint.svg" class="h-7 w-7 flex-shrink-0 mt-0.5 hidden sm:block" style="filter: brightness(0) saturate(100%) invert(62%) sepia(100%) saturate(520%) hue-rotate(355deg) brightness(95%)" />
      <div class="flex-1 min-w-0">
        <p class="font-heading font-bold text-gray text-base leading-snug mb-1">
          Vorschau: \u201e{{ directusData.municipalityScore.municipality.name }}\u201c
        </p>
        <p class="text-sm leading-snug mb-3 text-mid-gray">
          {{ $t("municipalities.preview_text") }}
        </p>
        <button
          @click="copyShareLink('draft')"
          class="px-4 py-1.5 text-sm font-medium border border-rating-1 text-rating-1 rounded-md hover:bg-rating-1-light transition-colors"
        >{{ copiedState.draft ? '\u2713 Link kopiert' : 'Vorschau-Link teilen' }}</button>
      </div>
    </div>
    <!-- Outdated catalog: info banner with action buttons -->
    <div
      v-else-if="pageView === PV.RATED_OUTDATED"
      class="mt-2 mb-6 flex flex-col sm:flex-row sm:items-start gap-4 rounded-sm border-l-4 border-rating-1 bg-rating-1-very-light px-5 py-4"
    >
      <img src="~/assets/icons/icon_hint.svg" class="h-7 w-7 flex-shrink-0 mt-0.5 hidden sm:block" style="filter: brightness(0) saturate(100%) invert(62%) sepia(100%) saturate(520%) hue-rotate(355deg) brightness(95%)" />
      <div class="flex-1 min-w-0">
        <p class="font-heading font-bold text-gray text-base leading-snug mb-1">
          Älterer Maßnahmenkatalog: „{{ selectedCatalogVersion.name }}"
        </p>
        <p class="text-sm leading-snug mb-3 text-mid-gray">
          Diese Bewertung basiert auf einem älteren Maßnahmenkatalog. Hilf dem Lokalteam, die Bewertung auf den aktuellen Katalog zu aktualisieren!
        </p>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            :to="`/municipalities/${route.params.slug}`"
            class="px-4 py-1.5 text-sm font-medium border border-rating-1 text-rating-1 rounded-md hover:bg-rating-1-light transition-colors"
          >Zur aktuellen Bewertung →</NuxtLink>
          <NuxtLink
            :to="`/contact?title=${encodeURIComponent('Bewertung aktualisieren: ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte das Lokalteam in ' + directusData.municipalityScore.municipality.name + ' dabei unterstützen, die Bewertung auf den aktuellen Maßnahmenkatalog zu aktualisieren.\n\nMeine Kontaktdaten:\n')}`"
            class="px-4 py-1.5 text-sm font-semibold bg-olive-green text-white rounded-md hover:opacity-90 transition-colors"
          >Lokalteam kontaktieren →</NuxtLink>
        </div>
      </div>
    </div>
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue">
      ← {{ backLabel }}
    </NuxtLink>
    <article class="mb-8 mt-10">
      <detail-municipality
        :municipalityScore="directusData.municipalityScore"
        :ratings-by-sector="directusData.ratingsBySector"
      ></detail-municipality>
    </article>

    <!-- CTA block based on rating completeness -->
    <div class="mb-8">
      <!-- RATED_COMPLETE (≥98%): contact / feedback -->
      <div v-if="pageView === PV.RATED_COMPLETE" class="flex flex-col items-center justify-center rounded-sm shadow-list p-10 text-center bg-rating-3-light">
        <img src="~/assets/icons/icon_team.svg" class="h-14 w-auto mb-4 opacity-80" />
        <h2 class="font-heading text-h2 font-bold text-green mb-2">Mitmachen beim Lokalteam</h2>
        <p class="text-gray-600 max-w-sm mb-6">
          <strong>{{ directusData.municipalityScore.municipality.name }}</strong> hat eine vollständige Bewertung.
          Nimm Kontakt zum Lokalteam auf oder schick uns dein Feedback.
        </p>
        <div class="flex flex-col sm:flex-row gap-3">
          <NuxtLink
            :to="`/contact?title=${encodeURIComponent('Lokalteam ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + directusData.municipalityScore.municipality.name + ' mitmachen.\n\nMeine Kontaktdaten:\n')}`"
            class="px-6 py-2.5 bg-green text-white font-semibold rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 transition-colors"
          >
            Kontakt aufnehmen →
          </NuxtLink>
          <NuxtLink
            :to="`/contact?title=${encodeURIComponent('Feedback zu ' + directusData.municipalityScore.municipality.name)}&type=suggestion&content=${encodeURIComponent('Kommune: ' + directusData.municipalityScore.municipality.name + '\nLink: /municipalities/' + route.params.slug + '\n\nMein Feedback:\n')}`"
            class="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors"
          >
            Feedback geben
          </NuxtLink>
        </div>
      </div>

      <!-- RATED_IN_PROGRESS / RATED_DRAFT: help the team complete the rating -->
      <div v-else-if="pageView === PV.RATED_IN_PROGRESS || pageView === PV.RATED_DRAFT" class="flex flex-col items-center justify-center rounded-sm shadow-list p-10 text-center bg-yellow-50">
        <img src="~/assets/icons/icon_team.svg" class="h-14 w-auto mb-4 opacity-60" />
        <h2 class="font-heading text-h2 font-bold text-gray-800 mb-2">Lokalteam unterstützen</h2>
        <p class="text-gray-600 max-w-sm mb-6">
          In <strong>{{ directusData.municipalityScore.municipality.name }}</strong> arbeitet bereits ein Lokalteam an der Bewertung.
          Hilf ihnen dabei, die Bewertung zu vervollständigen.
        </p>
        <NuxtLink
          :to="`/contact?title=${encodeURIComponent('Mitarbeit Lokalteam ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + directusData.municipalityScore.municipality.name + ' mithelfen.\n\nMeine Kontaktdaten:\n')}`"
          class="px-6 py-2.5 bg-green text-white font-semibold rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 transition-colors"
        >
          Lokalteam unterstützen →
        </NuxtLink>
      </div>

      <!-- RATED_OUTDATED: encourage update to current catalog -->
      <div v-else-if="pageView === PV.RATED_OUTDATED" class="flex flex-col items-center justify-center rounded-sm shadow-list p-10 text-center bg-rating-1-very-light">
        <img src="~/assets/icons/icon_hint.svg" class="h-14 w-auto mb-4 opacity-50" />
        <h2 class="font-heading text-h2 font-bold text-rating-1 mb-2">Bewertung aktualisieren</h2>
        <p class="text-mid-gray max-w-sm mb-6">
          <strong>{{ directusData.municipalityScore.municipality.name }}</strong> wurde nach dem Maßnahmenkatalog
          „{{ selectedCatalogVersion.name }}“ bewertet. Hilf dem Lokalteam dabei, die Bewertung
          auf den aktuellen Katalog zu aktualisieren!
        </p>
        <NuxtLink
          :to="`/contact?title=${encodeURIComponent('Bewertung aktualisieren: ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte das Lokalteam in ' + directusData.municipalityScore.municipality.name + ' dabei unterstützen, die Bewertung auf den aktuellen Maßnahmenkatalog zu aktualisieren.\n\nMeine Kontaktdaten:\n')}`"
          class="px-6 py-2.5 bg-olive-green text-white font-semibold rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-olive-green focus:ring-offset-2 transition-colors"
        >
          Lokalteam kontaktieren →
        </NuxtLink>
      </div>
    </div>

    <NearbyMunicipalitiesCarousel
      :ars="directusData.municipalityScore.municipality.ars"
      :catalog-version-id="selectedCatalogVersion.id"
      :catalog-version-name="selectedCatalogVersion.name"
      class="my-8"
    />
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue">
      ← {{ backLabel }}
    </NuxtLink>
  </div>

  <!-- LOADING: waiting for Stadt-Land-Zahl look-up -->
  <div v-else-if="pageView === PV.LOADING" class="animate-pulse mt-10">
    <div class="h-5 w-40 bg-gray-200 rounded mb-8"></div>
    <div class="relative mb-3 flex items-stretch gap-4 bg-opacity-10 py-5 pl-10 pr-4 bg-rating-0">
      <div class="h-8 w-8 bg-gray-300 rounded mt-6 flex-shrink-0"></div>
      <div class="grow space-y-2 pt-2">
        <div class="h-8 w-64 bg-gray-300 rounded"></div>
        <div class="h-4 w-32 bg-gray-200 rounded"></div>
      </div>
    </div>
    <div class="h-12 w-full bg-gray-200 rounded mb-6"></div>
    <div class="space-y-4 mt-6">
      <div class="h-36 w-full bg-gray-100 rounded shadow-list"></div>
      <div class="h-16 w-full bg-gray-100 rounded shadow-list"></div>
      <div class="h-16 w-full bg-gray-100 rounded shadow-list"></div>
    </div>
  </div>

  <!-- SLZ_FOUND: no score, area found in Stadt-Land-Zahl (ARS-based page) -->
  <div v-else-if="pageView === PV.SLZ_FOUND">
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue">
      ← {{ backLabel }}
    </NuxtLink>
    <article class="mb-8 mt-10">
      <!-- Header band (mirrors ItemRanking, no score) -->
      <div class="relative mb-3 flex items-stretch gap-4 py-5 pl-10 pr-4" style="background-color: #e5e7eb;">
        <div class="relative h-full pt-6">
          <img src="~/assets/icons/icon_location_green_marker.svg" class="my-auto h-auto w-8" />
          <div class="absolute top-0 w-full text-center font-heading text-3xl font-bold text-black">?</div>
        </div>
        <div class="grow">
          <h3 class="font-heading text-h2 font-bold text-black">{{ slzArea.name }}</h3>
          <p class="text-sm text-gray-500">{{ slzArea.prefix }}</p>
          <!-- Gray placeholder bar instead of score progress -->
          <div class="mt-2 h-3 w-full rounded bg-gray-300 opacity-60"></div>
        </div>
        <div v-if="slzArea.geo_center" class="flex items-center flex-shrink-0">
          <GermanyMapIndicator
            :lat="slzArea.geo_center.coordinates[1]"
            :lon="slzArea.geo_center.coordinates[0]"
            :size="80"
          />
        </div>
      </div>

      <!-- Mobile layout -->
      <div class="block lg:hidden mt-6 space-y-4">
        <!-- Info box -->
        <div class="rounded-sm shadow-list">
          <div class="flex items-center gap-2 px-6 py-4">
            <img src="~/assets/icons/icon_info.svg" class="h-6 w-6 opacity-60" />
            <h3 class="font-heading text-h3 text-green">{{ $t("municipality.municipality_info") }}</h3>
          </div>
          <div class="px-6 pb-6 space-y-3">
            <div v-if="slzArea.state" class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_location.svg" class="h-5 w-5 opacity-60" />
                <span class="text-sm text-gray-700">{{ $t("state") }}</span>
              </div>
              <span class="text-sm font-bold text-gray-900">{{ slzArea.state }}</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_team.svg" class="h-5 w-5 opacity-60" />
                <span class="text-sm text-gray-700">{{ $t("municipality.population") }}</span>
              </div>
              <span class="text-sm font-bold text-gray-900">
                {{ slzArea.population ? slzArea.population.toLocaleString() : $t("generic.not_entered") }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_politics.svg" class="h-5 w-5 opacity-60" />
                <span class="text-sm text-gray-700">{{ $t("municipality.mayor") }}</span>
              </div>
              <span class="text-sm font-bold text-gray-400 italic">{{ $t("generic.not_entered") }}</span>
            </div>
            <div v-if="directusMuniByArs?.localteam_id?.date_created" class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_team.svg" class="h-5 w-5 opacity-60" />
                <span class="text-sm text-gray-700">{{ $t("municipality.localteam_founded") }}</span>
              </div>
              <span class="text-sm font-bold text-gray-900">
                {{ new Date(directusMuniByArs.localteam_id.date_created).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Stats link -->
        <NuxtLink
          :to="`/stats/${slzArea.ars}`"
          class="shadow-list flex items-center gap-4 rounded-sm bg-blue-100 p-5 px-6 text-sm font-medium text-blue-600 hover:bg-blue-200"
        >
          <img src="~/assets/icons/icon_evaluation_criteria.svg" class="h-auto w-12 opacity-50 md:w-14" />
          <h2 class="font-heading text-h2">{{ $t("stats.title") }} →</h2>
        </NuxtLink>

        <!-- CTA: support existing localteam or invite to found one -->
        <div v-if="hasLocalteam" class="flex flex-col items-center justify-center rounded-sm shadow-list p-10 text-center bg-yellow-50">
          <img src="~/assets/icons/icon_team.svg" class="h-14 w-auto mb-4 opacity-60" />
          <h2 class="font-heading text-h2 font-bold text-gray-800 mb-2">Lokalteam unterstützen</h2>
          <p class="text-gray-600 max-w-sm mb-6">
            In <strong>{{ slzArea.name }}</strong> arbeitet bereits ein Lokalteam an der Bewertung.
            Hilf ihnen dabei, die Bewertung zu vervollständigen.
          </p>
          <CanonicalButton
            :href="`/contact?title=${encodeURIComponent('Mitarbeit Lokalteam ' + slzArea.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + slzArea.name + ' mithelfen.\n\nMeine Kontaktdaten:\n')}`"
            label="Lokalteam unterstützen"
            icon-slug="icon_team"
            color="dark-green"
          />
        </div>
        <div v-else class="flex flex-col items-center justify-center rounded-sm shadow-list p-10 text-center bg-rating-3-light">
          <img src="~/assets/icons/icon_location_green_marker.svg" class="h-14 w-auto mb-4 opacity-80" />
          <h2 class="font-heading text-h2 font-bold text-green mb-2">Lokalteam gründen</h2>
          <p class="text-gray-600 max-w-sm mb-6">
            <strong>{{ slzArea.name }}</strong> wurde noch nicht bewertet.
            Gründe ein Lokalteam und bringe aktiven Klimaschutz in deine Kommune.
          </p>
          <CanonicalButton
            :href="`/register_localteam?ars=${slzArea.ars}&name=${encodeURIComponent(slzArea.name)}`"
            label="Jetzt Lokalteam gründen"
            icon-slug="icon_location_green_marker"
            color="green"
          />
        </div>
      </div>

      <!-- Desktop layout -->
      <div class="hidden lg:grid lg:grid-cols-3 lg:gap-8 mt-6">
        <!-- Left column (2/3): CTA -->
        <div class="lg:col-span-2">
          <div v-if="hasLocalteam" class="flex flex-col items-center justify-center rounded-sm shadow-list p-10 text-center bg-yellow-50">
            <img src="~/assets/icons/icon_team.svg" class="h-14 w-auto mb-4 opacity-60" />
            <h2 class="font-heading text-h2 font-bold text-gray-800 mb-2">Lokalteam unterstützen</h2>
            <p class="text-gray-600 max-w-sm mb-6">
              In <strong>{{ slzArea.name }}</strong> arbeitet bereits ein Lokalteam an der Bewertung.
              Hilf ihnen dabei, die Bewertung zu vervollständigen.
            </p>
            <CanonicalButton
              :href="`/contact?title=${encodeURIComponent('Mitarbeit Lokalteam ' + slzArea.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + slzArea.name + ' mithelfen.\n\nMeine Kontaktdaten:\n')}`"
              label="Lokalteam unterstützen"
              icon-slug="icon_team"
              color="dark-green"
            />
          </div>
          <div v-else class="flex flex-col items-center justify-center rounded-sm shadow-list p-10 text-center bg-rating-3-light">
            <img src="~/assets/icons/icon_location_green_marker.svg" class="h-14 w-auto mb-4 opacity-80" />
            <h2 class="font-heading text-h2 font-bold text-green mb-2">Lokalteam gründen</h2>
            <p class="text-gray-600 max-w-sm mb-6">
              <strong>{{ slzArea.name }}</strong> wurde noch nicht bewertet.
              Gründe ein Lokalteam und bringe aktiven Klimaschutz in deine Kommune.
            </p>
            <CanonicalButton
              :href="`/register_localteam?ars=${slzArea.ars}&name=${encodeURIComponent(slzArea.name)}`"
              label="Jetzt Lokalteam gründen"
              icon-slug="icon_location_green_marker"
              color="green"
            />
          </div>
        </div>

        <!-- Right column (1/3): sticky sidebar -->
        <div class="lg:col-span-1 pb-4">
          <div class="sticky top-24 space-y-6">
            <!-- Info box -->
            <div class="rounded-sm shadow-list">
              <div class="flex items-center gap-2 px-6 py-4">
                <img src="~/assets/icons/icon_info.svg" class="h-6 w-6 opacity-60" />
                <h3 class="font-heading text-h3 text-green">{{ $t("municipality.municipality_info") }}</h3>
              </div>
              <div class="px-6 pb-6 space-y-3">
                <div v-if="slzArea.state" class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img src="~/assets/icons/icon_location.svg" class="h-5 w-5 opacity-60" />
                    <span class="text-sm text-gray-700">{{ $t("state") }}</span>
                  </div>
                  <span class="text-sm font-bold text-gray-900">{{ slzArea.state }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img src="~/assets/icons/icon_team.svg" class="h-5 w-5 opacity-60" />
                    <span class="text-sm text-gray-700">{{ $t("municipality.population") }}</span>
                  </div>
                  <span class="text-sm font-bold text-gray-900">
                    {{ slzArea.population ? slzArea.population.toLocaleString() : $t("generic.not_entered") }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img src="~/assets/icons/icon_politics.svg" class="h-5 w-5 opacity-60" />
                    <span class="text-sm text-gray-700">{{ $t("municipality.mayor") }}</span>
                  </div>
                  <span class="text-sm font-bold text-gray-400 italic">{{ $t("generic.not_entered") }}</span>
                </div>
                <div v-if="directusMuniByArs?.localteam_id?.date_created" class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img src="~/assets/icons/icon_team.svg" class="h-5 w-5 opacity-60" />
                    <span class="text-sm text-gray-700">{{ $t("municipality.localteam_founded") }}</span>
                  </div>
                  <span class="text-sm font-bold text-gray-900">
                    {{ new Date(directusMuniByArs.localteam_id.date_created).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Stats link -->
            <NuxtLink
              :to="`/stats/${slzArea.ars}`"
              class="shadow-list flex items-center gap-3 rounded-sm bg-blue-100 p-5 px-6 text-sm font-medium text-blue-600 hover:bg-blue-200"
            >
              <img src="~/assets/icons/icon_evaluation_criteria.svg" class="h-6 w-6 opacity-60" />
              <h3 class="font-heading text-h3">{{ $t("stats.title") }} →</h3>
            </NuxtLink>

          </div>
        </div>
      </div>
    </article>
    <NearbyMunicipalitiesCarousel
      :ars="slzArea.ars"
      :catalog-version-id="selectedCatalogVersion.id"
      :catalog-version-name="selectedCatalogVersion.name"
      class="my-8"
    />
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue">
      ← {{ backLabel }}
    </NuxtLink>
  </div>

  <!-- Case 3: Not found anywhere -->
  <div v-else>
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue">
      ← {{ backLabel }}
    </NuxtLink>
    <waving-banner>
      {{ $t("municipality_missing") }}
    </waving-banner>
  </div>
</template>


<script setup>
const { $directus, $readItems, $stadtlandzahlAPI, $t } = useNuxtApp();
const router = useRouter();

import { getCatalogVersion } from '~/composables/getCatalogVersion.js';
import { fetchMunicipalityData } from '~/shared/directus-calls/complex-data-fetches.js';
import { useMunicipalityPageState } from '~/composables/useMunicipalityPageState.js';
import { getStateMunicipalElectionYear } from '~/shared/utils.js';
import { useReferrer } from '~/composables/useReferrer';
const route = useRoute();

// Guard against browser devtools / extension source-map requests like "installHook.js.map"
// Municipality slugs are always lowercase alphanumeric + hyphens and never contain dots.
if (typeof route.params.slug === 'string' && route.params.slug.includes('.')) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
}

const selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route);
const { backHref, backLabel } = useReferrer(
  computed(() => `/municipalities?v=${selectedCatalogVersion.name}`),
  computed(() => $t('municipality.back_label')),
);

// Change the URL to match the catalog version, if it didn't to begin with
if (process.client && route.query.v != selectedCatalogVersion.name) {
  onMounted(() => {
    router.replace({ query: { ...route.query, v: selectedCatalogVersion.name } });
  });
}

const directusData = await fetchMunicipalityData($directus, $readItems, route.params.slug, selectedCatalogVersion.id, route.query.preview === 'true');

// If no Directus data, fetch from Stadt-Land-Zahl with a loading state
const { data: slzArea, pending: slzPending } = useAsyncData(
  `slz-area-${route.params.slug}`,
  async () => {
    if (directusData?.municipalityScore || !$stadtlandzahlAPI) return null;
    try {
      const data = await $stadtlandzahlAPI.fetchStatsByARS(route.params.slug);
      if (data?.name) {
        return {
          name: data.name,
          prefix: data.prefix ?? '',
          state: data.state ?? null,
          ars: data.ars ?? route.params.slug,
          population: data.data_products?.population_data?.population ?? null,
          geo_center: data.geo_center ?? null,
        };
      }
      return null;
    } catch (_) {
      return null;
    }
  }
);

// When there is no score data, directly fetch the municipality by slug to check
// preview_token / creator_verified (gates locked preview for newly registered municipalities).
const { data: directusMuniBySlug } = useAsyncData(
  `directus-muni-slug-${route.params.slug}`,
  async () => {
    if (directusData?.municipalityScore) return null;
    try {
      const results = await $directus.request(
        $readItems('municipalities', {
          filter: { slug: { _eq: route.params.slug } },
          fields: ['id', 'name', 'slug', 'status', 'preview_token', 'creator_verified', 'localteam_id', 'ars'],
          limit: 1,
        })
      );
      return results?.[0] ?? null;
    } catch (_) {
      return null;
    }
  }
);

// When the slug is an ARS (unpublished municipality), check if Directus has
// a municipality record with that ARS that already has a localteam.
const { data: directusMuniByArs } = useAsyncData(
  `directus-muni-ars-${route.params.slug}`,
  async () => {
    if (directusData?.municipalityScore) return null;
    try {
      const results = await $directus.request(
        $readItems('municipalities', {
          filter: { ars: { _eq: route.params.slug }, localteam_id: { _nnull: true } },
          fields: ['id', 'name', { localteam_id: ['id', 'date_created'] }],
          limit: 1,
        })
      );
      return results?.[0] ?? null;
    } catch (_) {
      return null;
    }
  }
);

// Centralised page-view state. All 9 cases are documented in useMunicipalityPageState.js.
// Debug tip: console.log(pageView.value) to see which view is active.
const { pageView, isRatedView, hasLocalteam, PAGE_VIEWS: PV } = useMunicipalityPageState({
  directusData,
  selectedCatalogVersion,
  directusMuniBySlug,
  slzArea,
  slzPending,
  directusMuniByArs,
  route,
});

// Show 404 once all look-ups have settled and nothing was found.
// Guard: if directusMuniBySlug resolves (published-but-unscored edge case), suppress the 404.
watch(
  [pageView, directusMuniBySlug],
  ([view, muniBySlug]) => {
    if (view === PV.NOT_FOUND && !muniBySlug) {
      showError({ statusCode: 404, statusMessage: 'Gemeinde nicht gefunden' })
    }
  },
  { immediate: true },
);

// Copy-to-clipboard state for share buttons
const copiedState = reactive({ preview: false, draft: false })
function copyShareLink(key) {
  if (process.client) {
    navigator.clipboard.writeText(window.location.href).then(() => {
      copiedState[key] = true
      setTimeout(() => { copiedState[key] = false }, 2000)
    })
  }
}

// Display name for the municipality on locked/preview pages (score may not always exist)
const previewMuniName = computed(() =>
  directusData?.municipalityScore?.municipality?.name
  ?? directusMuniBySlug.value?.name
  ?? String(route.params.slug)
)

// MetaTags
const pageTitle = directusData?.municipalityScore?.municipality?.name
  ?? slzArea.value?.name
  ?? route.params.slug;
const title = ref(pageTitle);
useHead({ title });
</script>
