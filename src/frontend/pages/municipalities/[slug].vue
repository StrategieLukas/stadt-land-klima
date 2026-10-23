<template>
  <!-- PREVIEW_LOCKED: unverified creator, no valid token -->
  <div v-if="pageView === PV.PREVIEW_LOCKED" class="mt-10">
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> &larr; {{ backLabel }} </NuxtLink>
    <div
      class="mt-6 flex flex-col gap-4 rounded-sm border-l-4 border-rating-1 bg-rating-1-very-light px-5 py-4 sm:flex-row sm:items-start"
    >
      <img
        src="~/assets/icons/icon_hint.svg"
        class="mt-0.5 hidden h-7 w-7 flex-shrink-0 sm:block"
        style="
          filter: brightness(0) saturate(100%) invert(62%) sepia(100%) saturate(520%) hue-rotate(355deg) brightness(95%);
        "
      />
      <div class="min-w-0 flex-1">
        <p class="mb-1 font-heading text-base font-bold leading-snug text-gray">
          Zugriff eingeschränkt: „{{ previewMuniName }}“
        </p>
        <p class="mb-3 text-sm leading-snug text-mid-gray">
          {{ $t("municipalities.preview_locked") }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            class="rounded-md border border-rating-1 px-4 py-1.5 text-sm font-medium text-rating-1 transition-colors hover:bg-rating-1-light"
            @click="copyShareLink('preview')"
          >
            {{ copiedState.preview ? "\u2713 Link kopiert" : "Share-Link kopieren" }}
          </button>
          <NuxtLink
            :to="`/contact?title=${encodeURIComponent('Verifizierung Lokalteam ' + previewMuniName)}&type=cooperation&content=${encodeURIComponent('Ich bitte um Verifizierung meines Lokalteam-Accounts für ' + previewMuniName + '.\n\nMeine Kontaktdaten:\n')}`"
            class="rounded-md bg-olive-green px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
            >Kontakt aufnehmen →</NuxtLink
          >
        </div>
      </div>
    </div>
  </div>

  <!-- IN_PROGRESS_LOCKED: incomplete rating, requires ?preview=true -->
  <div v-else-if="pageView === PV.IN_PROGRESS_LOCKED && directusData.municipalityScore" class="mt-10">
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> &larr; {{ backLabel }} </NuxtLink>
    <div
      class="mt-6 flex flex-col gap-4 rounded-sm border-l-4 border-rating-1 bg-rating-1-very-light px-5 py-4 sm:flex-row sm:items-start"
    >
      <img
        src="~/assets/icons/icon_hint.svg"
        class="mt-0.5 hidden h-7 w-7 flex-shrink-0 sm:block"
        style="
          filter: brightness(0) saturate(100%) invert(62%) sepia(100%) saturate(520%) hue-rotate(355deg) brightness(95%);
        "
      />
      <div class="min-w-0 flex-1">
        <p class="mb-1 font-heading text-base font-bold leading-snug text-gray">
          Bewertung noch in Bearbeitung: „{{ directusData.municipalityScore.municipality.name }}"
        </p>
        <p class="mb-3 text-sm leading-snug text-mid-gray">
          Diese Gemeinde bewertet gerade ihren kommunalen Klimaschutz – die Bewertung ist noch nicht abgeschlossen und
          daher noch nicht öffentlich sichtbar. Du kannst das Lokalteam unterstützen oder eine benachbarte Gemeinde
          erkunden.
        </p>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            :to="`/contact?title=${encodeURIComponent('Mitarbeit Lokalteam ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + directusData.municipalityScore.municipality.name + ' mithelfen.\n\nMeine Kontaktdaten:\n')}`"
            class="rounded-md bg-olive-green px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
            >Lokalteam kontaktieren →</NuxtLink
          >
        </div>
      </div>
    </div>
    <NearbyMunicipalitiesCarousel
      v-if="directusData.municipalityScore.municipality.ars"
      :ars="directusData.municipalityScore.municipality.ars"
      :catalog-version-id="selectedCatalogVersion.id"
      :catalog-version-name="selectedCatalogVersion.name"
      class="my-8"
    />
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> &larr; {{ backLabel }} </NuxtLink>
  </div>

  <!-- RATED_*: all states that render <detail-municipality> -->
  <div v-else-if="isRatedView && directusData.municipalityScore">
    <!-- RATED_DRAFT: unlocked draft preview — share banner with copy button -->
    <div
      v-if="pageView === PV.RATED_DRAFT"
      class="mb-6 flex flex-col gap-4 rounded-sm border-l-4 border-rating-1 bg-rating-1-very-light px-5 py-4 sm:flex-row sm:items-start"
    >
      <img
        src="~/assets/icons/icon_hint.svg"
        class="mt-0.5 hidden h-7 w-7 flex-shrink-0 sm:block"
        style="
          filter: brightness(0) saturate(100%) invert(62%) sepia(100%) saturate(520%) hue-rotate(355deg) brightness(95%);
        "
      />
      <div class="min-w-0 flex-1">
        <p class="mb-1 font-heading text-base font-bold leading-snug text-gray">
          Vorschau: „{{ directusData.municipalityScore.municipality.name }}“
        </p>
        <p class="mb-3 text-sm leading-snug text-mid-gray">
          {{ $t("municipalities.preview_text") }}
        </p>
        <button
          class="rounded-md border border-rating-1 px-4 py-1.5 text-sm font-medium text-rating-1 transition-colors hover:bg-rating-1-light"
          @click="copyShareLink('draft')"
        >
          {{ copiedState.draft ? "\u2713 Link kopiert" : "Vorschau-Link teilen" }}
        </button>
      </div>
    </div>
    <!-- Outdated catalog: info banner with action buttons -->
    <div
      v-else-if="pageView === PV.RATED_OUTDATED"
      class="mb-6 mt-2 flex flex-col gap-4 rounded-sm border-l-4 border-rating-1 bg-rating-1-very-light px-5 py-4 sm:flex-row sm:items-start"
    >
      <img
        src="~/assets/icons/icon_hint.svg"
        class="mt-0.5 hidden h-7 w-7 flex-shrink-0 sm:block"
        style="
          filter: brightness(0) saturate(100%) invert(62%) sepia(100%) saturate(520%) hue-rotate(355deg) brightness(95%);
        "
      />
      <div class="min-w-0 flex-1">
        <p class="mb-1 font-heading text-base font-bold leading-snug text-gray">
          Älterer Maßnahmenkatalog: „{{ selectedCatalogVersion.name }}"
        </p>
        <p class="mb-3 text-sm leading-snug text-mid-gray">
          Diese Bewertung basiert auf einem älteren Maßnahmenkatalog. Hilf dem Lokalteam, die Bewertung auf den
          aktuellen Katalog zu aktualisieren!
        </p>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            :to="`/municipalities/${slug}`"
            class="rounded-md border border-rating-1 px-4 py-1.5 text-sm font-medium text-rating-1 transition-colors hover:bg-rating-1-light"
            >Zur aktuellen Bewertung →</NuxtLink
          >
          <NuxtLink
            :to="`/contact?title=${encodeURIComponent('Bewertung aktualisieren: ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte das Lokalteam in ' + directusData.municipalityScore.municipality.name + ' dabei unterstützen, die Bewertung auf den aktuellen Maßnahmenkatalog zu aktualisieren.\n\nMeine Kontaktdaten:\n')}`"
            class="rounded-md bg-olive-green px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
            >Lokalteam kontaktieren →</NuxtLink
          >
        </div>
      </div>
    </div>
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> ← {{ backLabel }} </NuxtLink>
    <article class="mb-8 mt-10">
      <detail-municipality
        :municipality-score="directusData.municipalityScore"
        :ratings-by-sector="directusData.ratingsBySector ?? {}"
      ></detail-municipality>
    </article>

    <!-- CTA block based on rating completeness -->
    <div class="mb-8">
      <!-- RATED_COMPLETE (all measures rated): contact / feedback -->
      <div
        v-if="pageView === PV.RATED_COMPLETE"
        class="flex flex-col items-center justify-center rounded-sm bg-rating-3-light p-10 text-center shadow-list"
      >
        <img src="~/assets/icons/icon_team.svg" class="mb-4 h-14 w-auto opacity-80" />
        <h2 class="mb-2 font-heading text-h2 font-bold text-green">Mitmachen beim Lokalteam</h2>
        <p class="text-gray-600 mb-6 max-w-sm">
          <strong>{{ directusData.municipalityScore.municipality.name }}</strong> hat eine vollständige Bewertung. Nimm
          Kontakt zum Lokalteam auf oder schick uns dein Feedback.
        </p>
        <div class="flex flex-col gap-3 sm:flex-row">
          <NuxtLink
            :to="`/contact?title=${encodeURIComponent('Lokalteam ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + directusData.municipalityScore.municipality.name + ' mitmachen.\n\nMeine Kontaktdaten:\n')}`"
            class="rounded-md bg-green px-6 py-2.5 font-semibold text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2"
          >
            Kontakt aufnehmen →
          </NuxtLink>
          <NuxtLink
            :to="`/contact?title=${encodeURIComponent('Feedback zu ' + directusData.municipalityScore.municipality.name)}&type=suggestion&content=${encodeURIComponent('Kommune: ' + directusData.municipalityScore.municipality.name + '\nLink: /municipalities/' + route.params.slug + '\n\nMein Feedback:\n')}`"
            class="border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300 rounded-md border px-6 py-2.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
          >
            Feedback geben
          </NuxtLink>
        </div>
      </div>

      <!-- RATED_IN_PROGRESS / RATED_DRAFT: help the team complete the rating -->
      <div
        v-else-if="pageView === PV.RATED_DRAFT"
        class="slk-municipality-pending-card slk-municipality-pending-card--support flex flex-col items-center justify-center rounded-sm p-10 text-center shadow-list"
      >
        <img src="~/assets/icons/icon_team.svg" class="mb-4 h-14 w-auto opacity-60" />
        <h2 class="text-gray-800 mb-2 font-heading text-h2 font-bold">Lokalteam unterstützen</h2>
        <p class="text-gray-600 mb-6 max-w-sm">
          In <strong>{{ directusData.municipalityScore.municipality.name }}</strong> arbeitet bereits ein Lokalteam an
          der Bewertung. Hilf ihnen dabei, die Bewertung zu vervollständigen.
        </p>
        <NuxtLink
          :to="`/contact?title=${encodeURIComponent('Mitarbeit Lokalteam ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + directusData.municipalityScore.municipality.name + ' mithelfen.\n\nMeine Kontaktdaten:\n')}`"
          class="rounded-md bg-green px-6 py-2.5 font-semibold text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2"
        >
          Lokalteam unterstützen →
        </NuxtLink>
      </div>

      <!-- RATED_OUTDATED: encourage update to current catalog -->
      <div
        v-else-if="pageView === PV.RATED_OUTDATED"
        class="flex flex-col items-center justify-center rounded-sm bg-rating-1-very-light p-10 text-center shadow-list"
      >
        <img src="~/assets/icons/icon_hint.svg" class="mb-4 h-14 w-auto opacity-50" />
        <h2 class="mb-2 font-heading text-h2 font-bold text-rating-1">Bewertung aktualisieren</h2>
        <p class="mb-6 max-w-sm text-mid-gray">
          <strong>{{ directusData.municipalityScore.municipality.name }}</strong> wurde nach dem Maßnahmenkatalog „{{
            selectedCatalogVersion.name
          }}“ bewertet. Hilf dem Lokalteam dabei, die Bewertung auf den aktuellen Katalog zu aktualisieren!
        </p>
        <NuxtLink
          :to="`/contact?title=${encodeURIComponent('Bewertung aktualisieren: ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte das Lokalteam in ' + directusData.municipalityScore.municipality.name + ' dabei unterstützen, die Bewertung auf den aktuellen Maßnahmenkatalog zu aktualisieren.\n\nMeine Kontaktdaten:\n')}`"
          class="rounded-md bg-olive-green px-6 py-2.5 font-semibold text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-olive-green focus:ring-offset-2"
        >
          Lokalteam kontaktieren →
        </NuxtLink>
      </div>
    </div>

    <NearbyMunicipalitiesCarousel
      v-if="directusData.municipalityScore.municipality.ars"
      :ars="directusData.municipalityScore.municipality.ars ?? undefined"
      :catalog-version-id="selectedCatalogVersion.id"
      :catalog-version-name="selectedCatalogVersion.name"
      class="my-8"
    />
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> ← {{ backLabel }} </NuxtLink>
  </div>

  <!-- LOADING: waiting for Stadt-Land-Zahl look-up -->
  <div v-else-if="pageView === PV.LOADING" class="mt-10 animate-pulse">
    <div class="bg-gray-200 mb-8 h-5 w-40 rounded"></div>
    <div class="relative mb-3 flex items-stretch gap-4 bg-rating-0 bg-opacity-10 py-5 pl-10 pr-4">
      <div class="bg-gray-300 mt-6 h-8 w-8 flex-shrink-0 rounded"></div>
      <div class="grow space-y-2 pt-2">
        <div class="bg-gray-300 h-8 w-64 rounded"></div>
        <div class="bg-gray-200 h-4 w-32 rounded"></div>
      </div>
    </div>
    <div class="bg-gray-200 mb-6 h-12 w-full rounded"></div>
    <div class="mt-6 space-y-4">
      <div class="bg-gray-100 h-36 w-full rounded shadow-list"></div>
      <div class="bg-gray-100 h-16 w-full rounded shadow-list"></div>
      <div class="bg-gray-100 h-16 w-full rounded shadow-list"></div>
    </div>
  </div>

  <!-- SLZ_FOUND: no score, area found in Stadt-Land-Zahl (ARS-based page) -->
  <div v-else-if="pageView === PV.SLZ_FOUND && slzArea" class="slk-municipality-pending">
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> ← {{ backLabel }} </NuxtLink>
    <article class="mb-8 mt-10">
      <!-- Header band (mirrors ItemRanking, no score) -->
      <div class="slk-municipality-pending-header relative mb-3 flex items-stretch gap-4 py-5 pl-10 pr-4">
        <div class="relative h-full pt-6">
          <img src="~/assets/icons/icon_location_green_marker.svg" class="my-auto h-auto w-8" />
          <div class="absolute top-0 w-full text-center font-heading text-3xl font-bold text-black">?</div>
        </div>
        <div class="grow">
          <h3 class="font-heading text-h2 font-bold text-black">{{ slzArea.name }}</h3>
          <p class="text-gray-500 text-sm">{{ slzArea.prefix }}</p>
          <!-- Gray placeholder bar instead of score progress -->
          <div class="slk-municipality-pending-progress mt-2 h-3 w-full rounded"></div>
        </div>
        <div v-if="slzArea.geo_center" class="flex flex-shrink-0 items-center">
          <GermanyMapIndicator :lat="slzArea.geo_center.lat" :lon="slzArea.geo_center.lon" :size="80" />
        </div>
      </div>

      <!-- Mobile layout -->
      <div class="mt-6 block space-y-4 lg:hidden">
        <!-- Info box -->
        <div class="slk-municipality-pending-card rounded-sm shadow-list">
          <div class="flex items-center gap-2 px-6 py-4">
            <img src="~/assets/icons/icon_info.svg" alt="" class="slk-theme-icon--light h-6 w-6 opacity-60" />
            <img src="~/assets/icons/icon_info-dark.svg" alt="" class="slk-theme-icon--dark h-6 w-6" />
            <h3 class="font-heading text-h3 text-green">{{ $t("municipality.municipality_info") }}</h3>
          </div>
          <div class="space-y-3 px-6 pb-6">
            <div v-if="slzArea.state" class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_location.svg" class="h-5 w-5 opacity-60" />
                <span class="text-gray-700 text-sm">{{ $t("state") }}</span>
              </div>
              <span class="text-gray-900 text-sm font-bold">{{ slzArea.state }}</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_team.svg" class="h-5 w-5 opacity-60" />
                <span class="text-gray-700 text-sm">{{ $t("municipality.population") }}</span>
              </div>
              <span class="text-gray-900 text-sm font-bold">
                {{ slzArea.population ? slzArea.population.toLocaleString() : $t("generic.not_entered") }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_politics.svg" alt="" class="slk-theme-icon--light h-5 w-5 opacity-60" />
                <img src="~/assets/icons/icon_politics-dark.svg" alt="" class="slk-theme-icon--dark h-5 w-5" />
                <span class="text-gray-700 text-sm">{{ $t("municipality.mayor") }}</span>
              </div>
              <span class="text-gray-400 text-sm font-bold italic">{{ $t("generic.not_entered") }}</span>
            </div>
            <div v-if="directusMuniByArs?.localteam_id?.date_created" class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_team.svg" class="h-5 w-5 opacity-60" />
                <span class="text-gray-700 text-sm">{{ $t("municipality.localteam_founded") }}</span>
              </div>
              <span class="text-gray-900 text-sm font-bold">
                {{
                  new Date(directusMuniByArs.localteam_id.date_created).toLocaleDateString("de-DE", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })
                }}
              </span>
            </div>
          </div>
        </div>

        <!-- Stats link -->
        <NuxtLink
          :to="`/data/${slzArea.ars}`"
          class="slk-municipality-cta slk-municipality-cta--stats flex items-center gap-4 rounded-sm bg-blue-100 p-5 px-6 text-sm font-medium text-blue-600 shadow-list hover:bg-blue-200"
        >
          <img
            src="~/assets/icons/icon_evaluation_criteria.svg"
            alt=""
            class="slk-municipality-cta-icon slk-theme-icon--light h-auto w-12 opacity-50 md:w-14"
          />
          <img
            src="~/assets/icons/icon_evaluation_criteria-dark.svg"
            alt=""
            class="slk-municipality-cta-icon slk-theme-icon--dark h-auto w-12 md:w-14"
          />
          <h2 class="font-heading text-h2">{{ $t("stats.title") }} →</h2>
        </NuxtLink>

        <!-- CTA: support existing localteam or invite to found one -->
        <div
          v-if="hasLocalteam"
          class="slk-municipality-pending-card slk-municipality-pending-card--support flex flex-col items-center justify-center rounded-sm p-10 text-center shadow-list"
        >
          <img src="~/assets/icons/icon_team.svg" class="mb-4 h-14 w-auto opacity-60" />
          <h2 class="text-gray-800 mb-2 font-heading text-h2 font-bold">Lokalteam unterstützen</h2>
          <p class="text-gray-600 mb-6 max-w-sm">
            In <strong>{{ slzArea.name }}</strong> arbeitet bereits ein Lokalteam an der Bewertung. Hilf ihnen dabei,
            die Bewertung zu vervollständigen.
          </p>
          <CanonicalButton
            :href="`/contact?title=${encodeURIComponent('Mitarbeit Lokalteam ' + slzArea.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + slzArea.name + ' mithelfen.\n\nMeine Kontaktdaten:\n')}`"
            label="Lokalteam unterstützen"
            icon-slug="icon_team"
            color="dark-green"
          />
        </div>
        <div
          v-else
          class="slk-municipality-pending-card slk-municipality-pending-card--found flex flex-col items-center justify-center rounded-sm p-10 text-center shadow-list"
        >
          <img src="~/assets/icons/icon_location_green_marker.svg" class="mb-4 h-14 w-auto opacity-80" />
          <h2 class="mb-2 font-heading text-h2 font-bold text-green">Lokalteam gründen</h2>
          <p class="text-gray-600 mb-6 max-w-sm">
            <strong>{{ slzArea.name }}</strong> wurde noch nicht bewertet. Gründe ein Lokalteam und bringe aktiven
            Klimaschutz in deine Kommune.
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
      <div class="mt-6 hidden lg:grid lg:grid-cols-3 lg:gap-8">
        <!-- Left column (2/3): CTA -->
        <div class="lg:col-span-2">
          <div
            v-if="hasLocalteam"
            class="slk-municipality-pending-card slk-municipality-pending-card--support flex flex-col items-center justify-center rounded-sm p-10 text-center shadow-list"
          >
            <img src="~/assets/icons/icon_team.svg" class="mb-4 h-14 w-auto opacity-60" />
            <h2 class="text-gray-800 mb-2 font-heading text-h2 font-bold">Lokalteam unterstützen</h2>
            <p class="text-gray-600 mb-6 max-w-sm">
              In <strong>{{ slzArea.name }}</strong> arbeitet bereits ein Lokalteam an der Bewertung. Hilf ihnen dabei,
              die Bewertung zu vervollständigen.
            </p>
            <CanonicalButton
              :href="`/contact?title=${encodeURIComponent('Mitarbeit Lokalteam ' + slzArea.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + slzArea.name + ' mithelfen.\n\nMeine Kontaktdaten:\n')}`"
              label="Lokalteam unterstützen"
              icon-slug="icon_team"
              color="dark-green"
            />
          </div>
          <div
            v-else
            class="slk-municipality-pending-card slk-municipality-pending-card--found flex flex-col items-center justify-center rounded-sm p-10 text-center shadow-list"
          >
            <img src="~/assets/icons/icon_location_green_marker.svg" class="mb-4 h-14 w-auto opacity-80" />
            <h2 class="mb-2 font-heading text-h2 font-bold text-green">Lokalteam gründen</h2>
            <p class="text-gray-600 mb-6 max-w-sm">
              <strong>{{ slzArea.name }}</strong> wurde noch nicht bewertet. Gründe ein Lokalteam und bringe aktiven
              Klimaschutz in deine Kommune.
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
        <div class="pb-4 lg:col-span-1">
          <div class="sticky top-24 space-y-6">
            <!-- Info box -->
            <div class="slk-municipality-pending-card rounded-sm shadow-list">
              <div class="flex items-center gap-2 px-6 py-4">
                <img src="~/assets/icons/icon_info.svg" alt="" class="slk-theme-icon--light h-6 w-6 opacity-60" />
                <img src="~/assets/icons/icon_info-dark.svg" alt="" class="slk-theme-icon--dark h-6 w-6" />
                <h3 class="font-heading text-h3 text-green">{{ $t("municipality.municipality_info") }}</h3>
              </div>
              <div class="space-y-3 px-6 pb-6">
                <div v-if="slzArea.state" class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img src="~/assets/icons/icon_location.svg" class="h-5 w-5 opacity-60" />
                    <span class="text-gray-700 text-sm">{{ $t("state") }}</span>
                  </div>
                  <span class="text-gray-900 text-sm font-bold">{{ slzArea.state }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img src="~/assets/icons/icon_team.svg" class="h-5 w-5 opacity-60" />
                    <span class="text-gray-700 text-sm">{{ $t("municipality.population") }}</span>
                  </div>
                  <span class="text-gray-900 text-sm font-bold">
                    {{ slzArea.population ? slzArea.population.toLocaleString() : $t("generic.not_entered") }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img
                      src="~/assets/icons/icon_politics.svg"
                      alt=""
                      class="slk-theme-icon--light h-5 w-5 opacity-60"
                    />
                    <img src="~/assets/icons/icon_politics-dark.svg" alt="" class="slk-theme-icon--dark h-5 w-5" />
                    <span class="text-gray-700 text-sm">{{ $t("municipality.mayor") }}</span>
                  </div>
                  <span class="text-gray-400 text-sm font-bold italic">{{ $t("generic.not_entered") }}</span>
                </div>
                <div v-if="directusMuniByArs?.localteam_id?.date_created" class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img src="~/assets/icons/icon_team.svg" class="h-5 w-5 opacity-60" />
                    <span class="text-gray-700 text-sm">{{ $t("municipality.localteam_founded") }}</span>
                  </div>
                  <span class="text-gray-900 text-sm font-bold">
                    {{
                      new Date(directusMuniByArs.localteam_id.date_created).toLocaleDateString("de-DE", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                    }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Stats link -->
            <NuxtLink
              :to="`/data/${slzArea.ars}`"
              class="slk-municipality-cta slk-municipality-cta--stats flex items-center gap-3 rounded-sm bg-blue-100 p-5 px-6 text-sm font-medium text-blue-600 shadow-list hover:bg-blue-200"
            >
              <img
                src="~/assets/icons/icon_evaluation_criteria.svg"
                alt=""
                class="slk-municipality-cta-icon slk-theme-icon--light h-6 w-6 opacity-60"
              />
              <img
                src="~/assets/icons/icon_evaluation_criteria-dark.svg"
                alt=""
                class="slk-municipality-cta-icon slk-theme-icon--dark h-6 w-6"
              />
              <h3 class="font-heading text-h3">{{ $t("stats.title") }} →</h3>
            </NuxtLink>
          </div>
        </div>
      </div>
    </article>
    <NearbyMunicipalitiesCarousel
      v-if="slzArea.ars"
      :ars="slzArea.ars"
      :catalog-version-id="selectedCatalogVersion.id"
      :catalog-version-name="selectedCatalogVersion.name"
      class="my-8"
    />
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> ← {{ backLabel }} </NuxtLink>
  </div>

  <!-- Case 3: Not found anywhere -->
  <div v-else>
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> ← {{ backLabel }} </NuxtLink>
    <waving-banner>
      {{ $t("municipality_missing") }}
    </waving-banner>
  </div>
</template>

<script setup lang="ts">
import { useMunicipalityPageState } from "~/composables/useMunicipalityPageState";
import { useReferrer } from "~/composables/useReferrer";
import { MunicipalityPageSchema } from "~/shared/contracts/municipality";
import { parseGeoCenter } from "~/shared/contracts/geometry";
import { routeSlug, singleRouteValue } from "~/shared/routeValues";

const { $t } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const slug = routeSlug(route.params.slug);
if (!slug) throw createError({ statusCode: 404, statusMessage: "Municipality not found" });

// Guard against browser devtools / extension source-map requests like "installHook.js.map"
// Municipality slugs are always lowercase alphanumeric + hyphens and never contain dots.
if (typeof route.params.slug === "string" && route.params.slug.includes(".")) {
  throw createError({ statusCode: 404, statusMessage: "Not Found" });
}

// Remount for catalog/preview changes so children that capture initial props
// update too. This uses the caller's own URL, never a stored Directus credential.
definePageMeta({ key: (route) => route.fullPath });
const suppliedPreview = route.query.preview === "true" ? route.query.preview_token : route.query.preview;
const previewToken = typeof suppliedPreview === "string" ? suppliedPreview : "";
const municipalityPath = encodeURIComponent(slug);
// useId is SSR/hydration-stable and changes with each page instance. Never use
// the raw token as an async-data key or reuse a previous authorized navigation.
const pageDataKey = `municipality-page-${useId()}`;
const loadPage = async (preview: boolean) =>
  MunicipalityPageSchema.parse(
    await $fetch(
      preview ? `/api/previews/municipality/${municipalityPath}` : `/api/public/municipalities/${municipalityPath}`,
      {
        query: { v: singleRouteValue(route.query.v) },
        ...(preview ? { headers: { "x-preview-token": previewToken } } : {}),
      },
    ),
  );
const { data: pageData, error: pageDataError } = await useAsyncData(pageDataKey, () => loadPage(!!previewToken), {
  getCachedData: (key, app) => {
    if (!app.isHydrating) return undefined;
    const result = MunicipalityPageSchema.safeParse(app.payload.data[key]);
    return result.success ? result.data : undefined;
  },
});
onUnmounted(() => {
  clearNuxtData(pageDataKey);
});
// Invalid preview credentials show the ordinary locked page, while the API
// itself rejects them. Upstream failures must not silently become public data.
if (pageDataError.value?.status === 404 && previewToken) {
  pageData.value = await loadPage(false);
} else if (pageDataError.value) {
  throw createError({ statusCode: 502, statusMessage: "Municipality data unavailable" });
}
if (!pageData.value) throw createError({ statusCode: 502, statusMessage: "Municipality data unavailable" });
const selectedCatalogVersion = pageData.value.selectedCatalogVersion;
const directusData = pageData.value.directusData;
const previewAuthorized = pageData.value.previewAuthorized;
const directusMuniBySlug = ref(pageData.value.municipality);
const directusMuniByArs = ref(pageData.value.municipality?.localteam_id ? pageData.value.municipality : null);
const { backHref, backLabel } = useReferrer(
  computed(() => `/municipalities?v=${selectedCatalogVersion.name}`),
  computed(() => $t("municipality.back_label")),
);

// Change the URL to match the catalog version, if it didn't to begin with
if (import.meta.client && route.query.v != selectedCatalogVersion.name) {
  onMounted(() => {
    void router.replace({ query: { ...route.query, v: selectedCatalogVersion.name } });
  });
}

// If no Directus data, fetch the area through the Nuxt server endpoint so the
// same lookup works during SSR and client-side navigation.
const slzAreaLookup = useAsyncData(`slz-area-${slug}`, async () => {
  if (directusData?.municipalityScore) return null;
  try {
    const data = await $fetch("/api/area-by-slug", {
      query: { slug },
    });
    if (data?.name) {
      const stateArea = data.contained_by?.find((area) => area.level === 2);
      return {
        name: data.name,
        prefix: data.prefix ?? "",
        state: stateArea?.name ?? data.state ?? null,
        ars: data.ars ?? slug!,
        population: data.data_products?.population_data?.population ?? null,
        geo_center: parseGeoCenter(data.geo_center),
      };
    }
    return null;
  } catch {
    return null;
  }
});

const { data: slzArea, pending: slzPending } = await slzAreaLookup;

// Centralised page-view state. All 9 cases are documented in useMunicipalityPageState.js.
// Debug tip: console.log(pageView.value) to see which view is active.
const {
  pageView,
  isRatedView,
  hasLocalteam,
  PAGE_VIEWS: PV,
} = useMunicipalityPageState({
  directusData,
  selectedCatalogVersion,
  directusMuniBySlug,
  slzArea,
  slzPending,
  directusMuniByArs,
  previewAuthorized,
});

// Show 404 once all look-ups have settled and nothing was found.
// Guard: if directusMuniBySlug resolves (published-but-unscored edge case), suppress the 404.
watch(
  [pageView, directusMuniBySlug],
  ([view, muniBySlug]) => {
    if (view === PV.NOT_FOUND && !muniBySlug) {
      showError({ statusCode: 404, statusMessage: "Gemeinde nicht gefunden" });
    }
  },
  { immediate: true },
);

// Copy-to-clipboard state for share buttons
const copiedState = reactive({ preview: false, draft: false });
function copyShareLink(key: "preview" | "draft") {
  if (import.meta.client) {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      copiedState[key] = true;
      setTimeout(() => {
        copiedState[key] = false;
      }, 2000);
    });
  }
}

// Display name for the municipality on locked/preview pages (score may not always exist)
const previewMuniName = computed(
  () =>
    directusData?.municipalityScore?.municipality?.name ??
    (directusMuniBySlug.value && directusMuniBySlug.value.name) ??
    String(route.params.slug),
);

// MetaTags
const pageTitle = directusData?.municipalityScore?.municipality?.name ?? slzArea.value?.name ?? slug;
const title = ref(pageTitle);
useHead({ title });
</script>
