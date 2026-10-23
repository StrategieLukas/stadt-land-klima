<template>
  <div class="relative space-y-8">
    <!-- Confetti Animation -->
    <div v-if="showConfetti" class="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <div
        v-for="i in 100"
        :key="i"
        class="confetti"
        :style="{
          '--left': `${Math.random() * 100}%`,
          '--animation-duration': `${2 + Math.random() * 2}s`,
          '--animation-delay': `${Math.random() * 2}s`,
          '--color': getConfettiColor(i),
          '--size': `${5 + Math.random() * 10}px`,
        }"
      ></div>
    </div>

    <!-- Header -->
    <div class="rounded-xl border border-solid-gray-10 bg-white p-4 text-center shadow-list sm:p-8">
      <div class="mb-6">
        <ElectionsWahlCheckLogo
          :logo="election?.custom_logo"
          fallback="wahlcheck"
          :alt="$t('elections.wahlcheck.header_title')"
          logo-class="mx-auto h-auto max-h-48 w-auto max-w-full object-contain"
          fallback-class="mx-auto h-auto w-full max-w-lg object-contain"
        />
      </div>
      <h2 class="mb-4 text-xl font-bold text-stats-dark sm:text-2xl">
        {{ $t(isPartyElection ? "elections.wahlcheck.results.title_parties" : "elections.wahlcheck.results.title") }}
      </h2>
      <p class="mx-auto max-w-2xl text-sm text-mid-gray sm:text-base">
        {{
          $t(
            isPartyElection
              ? "elections.wahlcheck.results.description_parties"
              : "elections.wahlcheck.results.description",
          )
        }}
      </p>
      <p v-if="election" class="mt-4 text-sm text-mid-gray">
        <strong>{{ $t("elections.election") }}:</strong> {{ election.descriptor }}
      </p>
    </div>

    <div
      v-if="nonRespondingCandidates.length > 0"
      class="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-lg border border-solid-gray-20 bg-solid-gray-05 px-4 py-3 text-sm leading-relaxed text-mid-gray"
    >
      <span class="font-semibold text-gray">{{ $t("elections.wahlcheck.results.no_response") }}:</span>
      <template v-for="(candidate, index) in nonRespondingCandidates" :key="candidate.id">
        <span v-if="index > 0" aria-hidden="true">,</span>
        <span v-if="!isPartyElection">{{ getCandidateDisplayName(candidate) }}</span>
        <CandidatePartyLabel v-if="candidate.party" :party="candidate.party" :state="null" class="text-xs" />
      </template>
    </div>

    <!-- Unified match overview and details -->
    <div
      v-if="results.length > 0"
      data-testid="wahlcheck-results-overview"
      class="rounded-xl border border-solid-gray-10 bg-white p-4 shadow-list sm:p-6"
    >
      <h3 class="mb-6 text-center text-lg font-bold text-stats-dark sm:text-xl">
        {{
          $t(isPartyElection ? "elections.wahlcheck.results.all_parties" : "elections.wahlcheck.results.all_candidates")
        }}
      </h3>
      <div data-testid="wahlcheck-progress-match-list" class="space-y-2 md:space-y-4">
        <div
          v-for="(result, index) in sortedResults"
          :key="result.candidateId"
          data-testid="wahlcheck-progress-match-row"
          class="border-b border-solid-gray-10 pb-1.5 last:border-0 md:pb-0"
        >
          <button
            type="button"
            data-testid="wahlcheck-result-toggle"
            class="group flex w-full flex-col gap-1 rounded-lg text-left transition-colors hover:bg-solid-ff-green-05 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ff-green md:flex-row md:items-center md:gap-4 md:px-2 md:py-1"
            :aria-expanded="expandedCandidate === result.candidateId"
            :aria-controls="`wahlcheck-details-${result.candidateId}`"
            @click="toggleExpand(result.candidateId)"
          >
            <div class="w-full md:w-64 md:flex-shrink-0">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="font-bold text-stats-dark">{{ index + 1 }}.</span>
                <span
                  v-if="!isPartyElection"
                  class="hyphens-auto break-words text-sm font-bold text-black sm:text-base"
                  >{{ getCandidateName(result.candidateId) }}</span
                >
                <CandidatePartyLabel
                  v-if="getCandidateParty(result.candidateId)"
                  :party="getCandidateParty(result.candidateId)"
                  :state="null"
                  data-testid="wahlcheck-progress-party-badge"
                  class="max-w-full !px-3 !py-1.5 !text-sm !font-semibold !leading-tight sm:!px-4 sm:!py-2 sm:!text-base"
                />
              </div>
            </div>
            <div class="flex w-full min-w-0 flex-1 items-center gap-2">
              <div class="min-w-0 flex-1">
                <ProgressBar :score-total="result.percentage" layout="default" :show-scale-maximum="false" />
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 flex-shrink-0 text-stats-dark transition-transform duration-300 sm:h-6 sm:w-6"
                :class="{ 'rotate-180': expandedCandidate === result.candidateId }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <span class="sr-only">{{ $t("elections.wahlcheck.results.details") }}</span>
          </button>

          <!-- Expanded Details -->
          <div
            v-if="expandedCandidate === result.candidateId"
            :id="`wahlcheck-details-${result.candidateId}`"
            data-testid="wahlcheck-match-details"
            class="mt-3 overflow-hidden border-t border-solid-gray-10 pt-4 transition-all duration-300 sm:mt-4 sm:pt-6"
          >
            <h5 class="mb-4 hyphens-auto break-words font-bold text-stats-dark">
              {{ $t("elections.wahlcheck.results.details") }}
            </h5>

            <!-- Score Breakdown -->
            <div v-if="hasSectorAgreement(result.candidateId)" class="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:gap-6">
              <div
                class="min-w-0 rounded-xl bg-solid-rating-4-10 p-2 text-center shadow-lg transition-shadow hover:shadow-xl sm:rounded-2xl sm:p-6"
              >
                <div class="mb-1 flex items-center justify-center sm:mb-4">
                  <img
                    v-if="getSectorIcon(getSectorAgreement(result.candidateId, 'highest')?.sectorRaw)"
                    :src="getSectorIcon(getSectorAgreement(result.candidateId, 'highest')?.sectorRaw)"
                    class="slk-sector-icon h-6 w-6 opacity-90 sm:h-12 sm:w-12"
                    :alt="getSectorAgreement(result.candidateId, 'highest')?.sector"
                  />
                </div>
                <div class="text-xl font-bold text-rating-4 sm:text-4xl">
                  {{ getSectorAgreement(result.candidateId, "highest")?.percentage }}%
                </div>
                <div
                  class="mt-0.5 hyphens-auto break-words text-xs font-bold leading-tight text-solid-rating-4-90 sm:mt-2 sm:text-lg"
                >
                  {{ getSectorAgreement(result.candidateId, "highest")?.sector }}
                </div>
                <div
                  class="mt-0.5 text-[9px] uppercase leading-tight tracking-wider text-solid-rating-4-60 sm:mt-1 sm:text-sm"
                >
                  {{ $t("elections.wahlcheck.results.best_match") }}
                </div>
              </div>
              <div
                class="min-w-0 rounded-xl bg-solid-stats-light-50 p-2 text-center shadow-lg transition-shadow hover:shadow-xl sm:rounded-2xl sm:p-6"
              >
                <div class="mb-1 flex items-center justify-center sm:mb-4">
                  <img
                    v-if="getSectorIcon(getSectorAgreement(result.candidateId, 'lowest')?.sectorRaw)"
                    :src="getSectorIcon(getSectorAgreement(result.candidateId, 'lowest')?.sectorRaw)"
                    class="slk-sector-icon h-6 w-6 opacity-90 sm:h-12 sm:w-12"
                    :alt="getSectorAgreement(result.candidateId, 'lowest')?.sector"
                  />
                </div>
                <div class="text-xl font-bold text-stats-dark sm:text-4xl">
                  {{ getSectorAgreement(result.candidateId, "lowest")?.percentage }}%
                </div>
                <div
                  class="mt-0.5 hyphens-auto break-words text-xs font-bold leading-tight text-solid-stats-dark-80 sm:mt-2 sm:text-lg"
                >
                  {{ getSectorAgreement(result.candidateId, "lowest")?.sector }}
                </div>
                <div
                  class="mt-0.5 text-[9px] uppercase leading-tight tracking-wider text-solid-stats-dark-60 sm:mt-1 sm:text-sm"
                >
                  {{ $t("elections.wahlcheck.results.lowest_match") }}
                </div>
              </div>
            </div>

            <!-- Sort Toggle Button -->
            <div class="mb-4">
              <button
                class="btn btn-sm flex items-center gap-2 rounded-full border border-solid-gray-20 bg-white px-4 py-1.5 text-sm font-medium transition-all hover:border-solid-ff-green-30 hover:bg-solid-ff-green-05"
                @click="toggleSort"
              >
                <span>{{ sortLabel }}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-stats-dark"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <!-- Mobile Question-by-Question Comparison Table (Requirement 5) -->
            <div class="space-y-1 sm:hidden">
              <!-- Mobile Header -->
              <div
                class="grid grid-cols-[1fr_48px_68px] items-center gap-1 rounded-t-lg border-b border-solid-gray-20 bg-solid-gray-10 px-2.5 py-2 text-xs font-semibold text-solid-gray-60"
              >
                <div>{{ $t("elections.thesis") }}</div>
                <div class="text-center">{{ $t("elections.wahlcheck.results.my_rating_short") }}</div>
                <div class="text-center">
                  {{
                    $t(
                      isPartyElection
                        ? "elections.wahlcheck.results.party_rating_short"
                        : "elections.wahlcheck.results.candidate_rating_short",
                    )
                  }}
                </div>
              </div>

              <!-- Mobile Rows -->
              <div
                v-for="question in sortedExpandedQuestions"
                :key="'mobile-' + question.id"
                class="grid grid-cols-[1fr_48px_68px] items-center gap-1 rounded-lg border-b border-solid-gray-10 bg-white px-2.5 py-2.5 last:border-0 hover:bg-mild-white"
              >
                <!-- Thesis Title -->
                <div class="min-w-0 pr-1 text-xs text-black">
                  <span class="hyphens-auto break-words font-medium leading-snug">{{ question.title }}</span>
                  <span
                    v-if="doubleWeightedQuestions.has(question.id)"
                    class="py-0.2 ml-1 inline-block rounded-full bg-orange px-1.5 text-[10px] font-bold text-white"
                    :title="$t('elections.wahlcheck.results.double_weighted')"
                    >2×</span
                  >
                </div>

                <!-- User Answer -->
                <div class="flex justify-center">
                  <div
                    v-if="userAnswers[question.id] !== undefined"
                    class="h-6 w-6 rounded-full shadow-sm"
                    :class="getRatingColor(userAnswers[question.id])"
                    :title="
                      $t('elections.wahlcheck.results.my_rating_title', {
                        ':rating': getRatingLabel(userAnswers[question.id]),
                      })
                    "
                  ></div>
                  <div v-else class="h-6 w-6 rounded-full bg-solid-gray-20"></div>
                </div>

                <!-- Candidate Answer -->
                <div class="flex items-center justify-center gap-1">
                  <div
                    v-if="getCandidateAnswer(result.candidateId, question.id)"
                    class="h-6 w-6 flex-shrink-0 rounded-full shadow-sm"
                    :class="getRatingColor(getCandidateAnswer(result.candidateId, question.id)?.response)"
                    :title="
                      $t(
                        isPartyElection
                          ? 'elections.wahlcheck.results.party_rating_title'
                          : 'elections.wahlcheck.results.candidate_rating_title',
                        { ':rating': getRatingLabel(getCandidateAnswer(result.candidateId, question.id)?.response) },
                      )
                    "
                  ></div>
                  <div v-else class="h-6 w-6 flex-shrink-0 rounded-full bg-solid-gray-20"></div>

                  <button
                    v-if="getCandidateAnswer(result.candidateId, question.id)"
                    type="button"
                    class="btn btn-circle btn-ghost btn-xs h-6 min-h-6 w-6 flex-shrink-0 border p-0"
                    :class="
                      getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                        ? 'border-stats-dark/15 text-stats-dark hover:bg-stats-light'
                        : 'border-red/40 text-red hover:border-red hover:bg-red/10'
                    "
                    :aria-label="
                      getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                        ? $t('elections.wahlcheck.results.show_reasoning')
                        : $t('elections.wahlcheck.results.no_reasoning')
                    "
                    :title="
                      getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                        ? $t('elections.wahlcheck.results.show_reasoning')
                        : $t('elections.wahlcheck.results.no_reasoning')
                    "
                    @click="openReasoning(result.candidateId, question)"
                  >
                    <span aria-hidden="true" class="text-xs font-bold leading-none">i</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Desktop Question-by-Question Comparison Table -->
            <div class="hidden overflow-x-auto pb-2 sm:block">
              <div class="min-w-[560px] sm:min-w-[640px]">
                <!-- Table Header -->
                <div
                  class="grid gap-2 rounded-t-lg border-b border-solid-gray-20 bg-solid-gray-10 px-3 py-2 text-xs font-semibold text-solid-gray-60 sm:text-sm"
                  :class="
                    hasQuestionSectors
                      ? 'grid-cols-[36px_1fr_60px_100px_100px] sm:grid-cols-[40px_1fr_80px_120px_120px]'
                      : 'grid-cols-[36px_1fr_100px_100px] sm:grid-cols-[40px_1fr_120px_120px]'
                  "
                >
                  <div class="text-center">#</div>
                  <div>{{ $t("elections.thesis") }}</div>
                  <div v-if="hasQuestionSectors" class="text-center">{{ $t("stats.chart.sector") }}</div>
                  <div class="text-center">{{ $t("elections.wahlcheck.results.my_rating_short") }}</div>
                  <div class="text-center">
                    {{
                      $t(
                        isPartyElection
                          ? "elections.wahlcheck.results.party_rating_short"
                          : "elections.wahlcheck.results.candidate_rating_short",
                      )
                    }}
                  </div>
                </div>

                <!-- Table Rows -->
                <div
                  v-for="question in sortedExpandedQuestions"
                  :key="question.id"
                  class="grid items-center gap-2 rounded-lg border-b border-solid-gray-10 bg-white px-3 py-2.5 transition-all last:border-0 hover:bg-mild-white"
                  :class="
                    hasQuestionSectors
                      ? 'grid-cols-[36px_1fr_60px_100px_100px] sm:grid-cols-[40px_1fr_80px_120px_120px]'
                      : 'grid-cols-[36px_1fr_100px_100px] sm:grid-cols-[40px_1fr_120px_120px]'
                  "
                >
                  <div class="text-center text-xs text-solid-gray-50 sm:text-sm">{{ question.originalIndex + 1 }}.</div>
                  <div class="flex flex-wrap items-center gap-2 text-xs text-black sm:text-sm">
                    <span class="hyphens-auto break-words">{{ question.title }}</span>
                    <span
                      v-if="doubleWeightedQuestions.has(question.id)"
                      class="rounded-full bg-orange px-1.5 py-0.5 text-[10px] font-bold text-white sm:text-xs"
                      :title="$t('elections.wahlcheck.results.double_weighted')"
                      >2×</span
                    >
                  </div>

                  <!-- Sector -->
                  <div v-if="hasQuestionSectors" class="flex justify-center">
                    <div v-if="question.sector" class="flex items-center gap-1">
                      <img
                        :src="getSectorIcon(question.sector)"
                        class="h-6 w-6 opacity-60 sm:h-8 sm:w-8"
                        :alt="sectorLabel(question.sector)"
                      />
                    </div>
                    <div v-else class="w-6 sm:w-8"></div>
                  </div>

                  <!-- User Answer -->
                  <div class="flex justify-center">
                    <div
                      v-if="userAnswers[question.id] !== undefined"
                      class="h-7 w-7 rounded-full shadow-sm sm:h-8 sm:w-8"
                      :class="getRatingColor(userAnswers[question.id])"
                      :title="
                        $t('elections.wahlcheck.results.my_rating_title', {
                          ':rating': getRatingLabel(userAnswers[question.id]),
                        })
                      "
                    ></div>
                    <div v-else class="h-7 w-7 rounded-full bg-solid-gray-20 sm:h-8 sm:w-8"></div>
                  </div>

                  <!-- Candidate Answer -->
                  <div class="flex items-center justify-center gap-1.5 sm:gap-2">
                    <div
                      v-if="getCandidateAnswer(result.candidateId, question.id)"
                      class="h-7 w-7 rounded-full shadow-sm sm:h-8 sm:w-8"
                      :class="getRatingColor(getCandidateAnswer(result.candidateId, question.id)?.response)"
                      :title="
                        $t(
                          isPartyElection
                            ? 'elections.wahlcheck.results.party_rating_title'
                            : 'elections.wahlcheck.results.candidate_rating_title',
                          { ':rating': getRatingLabel(getCandidateAnswer(result.candidateId, question.id)?.response) },
                        )
                      "
                    ></div>
                    <div v-else class="h-7 w-7 rounded-full bg-solid-gray-20 sm:h-8 sm:w-8"></div>
                    <button
                      v-if="getCandidateAnswer(result.candidateId, question.id)"
                      type="button"
                      class="btn btn-circle btn-ghost btn-xs h-7 min-h-7 w-7 border sm:h-8 sm:min-h-8 sm:w-8"
                      :class="
                        getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                          ? 'border-stats-dark/15 text-stats-dark hover:bg-stats-light'
                          : 'border-red/40 text-red hover:border-red hover:bg-red/10'
                      "
                      :aria-label="
                        getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                          ? $t('elections.wahlcheck.results.show_reasoning')
                          : $t('elections.wahlcheck.results.no_reasoning')
                      "
                      :title="
                        getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                          ? $t('elections.wahlcheck.results.show_reasoning')
                          : $t('elections.wahlcheck.results.no_reasoning')
                      "
                      @click="openReasoning(result.candidateId, question)"
                    >
                      <span class="sr-only">
                        {{
                          getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                            ? $t("elections.wahlcheck.results.show_reasoning")
                            : $t("elections.wahlcheck.results.no_reasoning")
                        }}
                      </span>
                      <span aria-hidden="true" class="text-xs font-bold leading-none sm:text-sm">i</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Results / All Skipped -->
    <div v-else class="text-orange-700 rounded-xl border border-orange bg-solid-orange-10 p-8 text-center">
      <div class="mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="mx-auto h-20 w-20 text-orange"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 class="mb-4 text-xl font-bold">{{ $t("elections.wahlcheck.results.no_matches.title") }}</h3>
      <p class="text-mid-gray">
        {{
          $t(
            isPartyElection
              ? "elections.wahlcheck.results.no_matches.description_parties"
              : "elections.wahlcheck.results.no_matches.description",
          )
        }}
      </p>
      <button class="btn btn-primary mt-6 rounded-full px-8 py-3 font-semibold text-white" @click="$emit('restart')">
        {{ $t("generic.try_again") }}
      </button>
    </div>

    <dialog ref="reasoningDialog" class="modal" @close="activeReasoning = null">
      <div
        class="modal-box max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] overflow-y-auto overscroll-contain p-0"
        :class="activeReasoning?.explanation ? 'max-w-2xl' : 'max-w-lg'"
      >
        <div v-if="activeReasoning && !activeReasoning.explanation" class="relative p-5">
          <p
            class="w-full rounded-lg border border-red/20 bg-red/5 p-4 pr-12 text-base font-medium leading-relaxed text-red"
          >
            {{ $t("elections.wahlcheck.results.no_reasoning") }}
          </p>
          <form method="dialog" class="absolute right-7 top-7">
            <button
              type="submit"
              class="btn btn-circle btn-ghost btn-sm flex-shrink-0"
              :aria-label="$t('generic.close')"
            >
              <span aria-hidden="true">×</span>
            </button>
          </form>
        </div>

        <div v-else class="flex items-start justify-between gap-4 border-b border-gray/10 p-5">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold uppercase tracking-wider text-ff-green">
              {{ $t("elections.wahlcheck.results.reasoning") }}
            </p>
            <div class="mt-1 flex min-w-0 items-start justify-between gap-3">
              <CandidatePartyLabel
                v-if="activeReasoning && isPartyElection"
                :party="getCandidateParty(activeReasoning.candidateId)"
                :state="null"
                class="flex-shrink-0 text-sm"
              />
              <h3 v-else class="min-w-0 break-words text-xl font-bold leading-tight text-black">
                {{ activeReasoning ? getCandidateName(activeReasoning.candidateId) : "" }}
              </h3>
              <div v-if="activeReasoning" class="flex max-w-[8rem] flex-shrink-0 items-center gap-1.5 text-right">
                <span class="text-[10px] font-semibold leading-tight text-mid-gray">
                  {{
                    $t(
                      isPartyElection
                        ? "elections.wahlcheck.results.party_rating"
                        : "elections.wahlcheck.results.candidate_rating",
                    )
                  }}
                </span>
                <span
                  class="h-6 w-6 flex-shrink-0 rounded-full shadow-sm"
                  :class="getRatingColor(activeReasoning.answer.response)"
                  aria-hidden="true"
                ></span>
              </div>
            </div>
          </div>
          <form method="dialog">
            <button type="submit" class="btn btn-circle btn-ghost btn-sm" :aria-label="$t('generic.close')">
              <span aria-hidden="true">×</span>
            </button>
          </form>
        </div>

        <div v-if="activeReasoning?.explanation" class="space-y-5 p-5">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-mid-gray">
              {{ $t("elections.thesis") }}
            </p>
            <p class="mt-1 text-base font-semibold text-black">
              {{ getQuestionTitle(activeReasoning.question) }}
            </p>
            <p v-if="showQuestionThesis(activeReasoning.question)" class="mt-2 text-sm leading-relaxed text-gray">
              {{ activeReasoning.question.thesis }}
            </p>
          </div>

          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-mid-gray">
              {{ $t("elections.wahlcheck.results.reasoning") }}
            </p>
            <p
              class="mt-2 whitespace-pre-line rounded-lg border border-gray/10 bg-white p-4 text-base leading-relaxed text-black"
            >
              {{ activeReasoning.explanation }}
            </p>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>{{ $t("generic.close") }}</button>
      </form>
    </dialog>

    <!-- Share Section -->
    <ElectionsWahlCheckShare
      v-if="results.length > 0"
      :election="election"
      :sorted-results="sortedResults"
      :candidates="candidates"
      :user-answers="userAnswers"
      :double-weighted-questions="doubleWeightedQuestions"
    />

    <!-- Navigation Buttons (Requirement 1) -->
    <div
      class="mt-8 flex flex-col gap-4 border-t border-solid-gray-10 pt-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="text-center text-xs text-mid-gray sm:text-left sm:text-sm">
        {{
          $t(
            isPartyElection
              ? "elections.wahlcheck.results.compared_parties"
              : "elections.wahlcheck.results.compared_count",
            { ":count": results.length },
          )
        }}
      </div>
      <div class="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
        <button
          type="button"
          class="btn btn-outline btn-secondary flex-1 rounded-full px-4 py-2 font-semibold sm:flex-initial sm:px-6"
          @click="$emit('prev')"
        >
          {{ $t("generic.back") }}
        </button>
        <button
          type="button"
          class="btn btn-outline flex-1 whitespace-nowrap rounded-full border-ff-green px-4 py-2 font-semibold text-ff-green hover:bg-solid-ff-green-10 sm:flex-initial sm:px-6"
          @click="$emit('restart')"
        >
          {{ $t("generic.restart") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type {
  Election,
  ElectionCandidate,
  ElectionQuestion,
  UserAnswers,
  CandidateAnswer,
  WahlcheckResult,
} from "~/types/components/elections";

import { ref, computed, onMounted } from "vue";
import ProgressBar from "~/components/ProgressBar.vue";
import CandidatePartyLabel from "~/components/CandidatePartyLabel.vue";
import { getCandidateDisplayName } from "~/shared/candidateParties";
import sectorImages from "~/shared/sectorImages";
import {
  calculateWahlcheckQuestionScore,
  getWahlcheckAnswerLabel,
  getWahlcheckRatingColor,
} from "~/shared/wahlcheckAnswerOptions";

const { $t, $translateDynamic } = useNuxtApp();

const props = defineProps({
  election: {
    type: Object as PropType<Election>,
    required: true,
  },
  candidates: {
    type: Array as PropType<ElectionCandidate[]>,
    required: true,
  },
  questions: {
    type: Array as PropType<ElectionQuestion[]>,
    required: true,
  },
  userAnswers: {
    type: Object as PropType<UserAnswers>,
    required: true,
  },
  doubleWeightedQuestions: {
    type: Set as PropType<Set<string>>,
    required: true,
  },
  candidateAnswers: {
    type: Array as PropType<CandidateAnswer[]>,
    required: true,
  },
});

const _emit = defineEmits<{ restart: []; prev: [] }>();

// State
const expandedCandidate = ref<string | null>(null);
const showConfetti = ref(false);
const sortBy = ref("default"); // 'default', 'agreement', 'disagreement'
const reasoningDialog = ref<HTMLDialogElement | null>(null);
const activeReasoning = ref<{
  candidateId: string;
  question: ElectionQuestion;
  answer: CandidateAnswer;
  explanation: string | null;
} | null>(null);

const nonRespondingCandidates = computed(() => {
  return props.candidates.filter((candidate) => candidate.has_answered !== true);
});

const isPartyElection = computed(() => props.election?.is_party_election === true);

// Toggle through sort modes
function toggleSort() {
  const modes = ["default", "agreement", "disagreement"];
  const currentIndex = modes.indexOf(sortBy.value);
  sortBy.value = modes[(currentIndex + 1) % modes.length] ?? "default";
}

// Sort label text
const sortLabel = computed(() => {
  switch (sortBy.value) {
    case "default":
      return $t("elections.wahlcheck.results.sort.default");
    case "agreement":
      return $t("elections.wahlcheck.results.sort.agreement");
    case "disagreement":
      return $t("elections.wahlcheck.results.sort.disagreement");
    default:
      return $t("elections.wahlcheck.results.sort.order");
  }
});

// Sorting functions
const sortedExpandedQuestions = computed(() => {
  if (!expandedCandidate.value) return [];

  const candidateId = expandedCandidate.value;
  const candidateAnswersByQuestion: Record<string, CandidateAnswer["response"]> = {};
  props.candidateAnswers.forEach((ans) => {
    const cId = typeof ans.candidate === "object" ? ans.candidate.id : ans.candidate;
    const qId = typeof ans.question === "object" ? ans.question.id : ans.question;
    if (cId === candidateId) {
      candidateAnswersByQuestion[qId] = ans.response;
    }
  });

  const originalIndices = new Map(props.questions.map((q, i) => [q.id, i]));

  return [...props.questions]
    .map((q) => {
      const userAnswer = props.userAnswers[q.id];
      const candidateAnswer = candidateAnswersByQuestion[q.id];
      const score = calculateWahlcheckQuestionScore(userAnswer, candidateAnswer);
      return {
        ...q,
        difference: score?.distance ?? null,
        originalIndex: originalIndices.get(q.id) ?? 0,
      };
    })
    .filter((q) => {
      // Show every thesis the user answered. A missing candidate answer is
      // represented by the neutral placeholder in the comparison table.
      return props.userAnswers[q.id] !== undefined && props.userAnswers[q.id] !== null;
    })
    .sort((a, b) => {
      if (sortBy.value === "default") {
        return a.originalIndex - b.originalIndex;
      } else if (sortBy.value === "agreement") {
        return (a.difference ?? Infinity) - (b.difference ?? Infinity);
      } else if (sortBy.value === "disagreement") {
        return (b.difference ?? -Infinity) - (a.difference ?? -Infinity);
      }
      return 0;
    });
});

// Trigger confetti animation when component mounts
onMounted(() => {
  showConfetti.value = true;
  setTimeout(() => {
    showConfetti.value = false;
  }, 3000);
});

// Confetti colors using logo colors
const confettiColors = [
  "#AFCA0B", // light-green
  "#1da64a", // ff-green
  "#ffc80c", // localzero-yellow
  "#16bae7", // light-blue
  "#f27c00", // slk-orange
];

function getConfettiColor(index: number) {
  return confettiColors[index % confettiColors.length];
}

function getRatingColor(value: unknown) {
  return getWahlcheckRatingColor(value);
}

function getRatingLabel(value: unknown) {
  return getWahlcheckAnswerLabel(value, props.election, $t);
}

// Helper functions for candidate data
function getCandidate(candidateId: string) {
  return props.candidates.find((candidate) => String(candidate.id) === String(candidateId));
}

function getCandidateName(candidateId: string) {
  const candidate = getCandidate(candidateId);
  return candidate ? getCandidateDisplayName(candidate) : $t("elections.unknown_candidate");
}

function getCandidateParty(candidateId: string) {
  return getCandidate(candidateId)?.party || null;
}

function getCandidateAnswer(candidateId: string, questionId: string) {
  return props.candidateAnswers.find(
    (ans) =>
      (typeof ans.candidate === "object" ? ans.candidate.id : ans.candidate) === candidateId &&
      (typeof ans.question === "object" ? ans.question.id : ans.question) === questionId,
  );
}

function getCandidateExplanation(answer: CandidateAnswer | undefined) {
  const explanation = String(answer?.explanation ?? "").trim();
  return explanation || null;
}

function getQuestionTitle(question: ElectionQuestion) {
  return question?.title || question?.thesis || $t("elections.thesis");
}

function showQuestionThesis(question: ElectionQuestion) {
  const title = String(question?.title ?? "").trim();
  const thesis = String(question?.thesis ?? "").trim();
  return Boolean(thesis && thesis !== title);
}

function openReasoning(candidateId: string, question: ElectionQuestion) {
  const answer = getCandidateAnswer(candidateId, question.id);
  const explanation = getCandidateExplanation(answer);

  if (!answer) {
    return;
  }

  activeReasoning.value = {
    candidateId,
    question,
    answer,
    explanation,
  };
  reasoningDialog.value?.showModal();
}

function normalizeSector(sector: string | null | undefined) {
  const normalized = String(sector ?? "")
    .toLowerCase()
    .trim();
  return normalized || null;
}

const questionSectors = computed(() => {
  return new Set(props.questions.map((question) => normalizeSector(question.sector)).filter(Boolean));
});

const hasQuestionSectors = computed(() => questionSectors.value.size > 0);
const hasMultipleQuestionSectors = computed(() => questionSectors.value.size > 1);

// Calculate similarity scores
const results = computed(() => {
  const scores: Record<string, number> = {};
  const maxScores: Record<string, number> = {};

  // Group candidate answers by candidate
  const candidateAnswersByCandidate: Record<
    string,
    Record<string, Pick<CandidateAnswer, "response" | "explanation">>
  > = {};
  props.candidateAnswers.forEach((ans) => {
    const candidateId = typeof ans.candidate === "object" ? ans.candidate.id : ans.candidate;
    if (!candidateAnswersByCandidate[candidateId]) {
      candidateAnswersByCandidate[candidateId] = {};
    }
    const questionId = typeof ans.question === "object" ? ans.question.id : ans.question;
    candidateAnswersByCandidate[candidateId]![questionId] = {
      response: ans.response,
      explanation: ans.explanation,
    };
  });

  // Calculate scores for each candidate
  props.questions.forEach((question) => {
    const questionId = question.id;
    const userResponse = props.userAnswers[questionId];

    // Skip if user didn't answer
    if (userResponse === undefined || userResponse === null) return;

    const isDoubleWeighted = props.doubleWeightedQuestions.has(questionId);
    const weight = isDoubleWeighted ? 2 : 1;

    Object.keys(candidateAnswersByCandidate).forEach((candidateId) => {
      const candidateAnswer = candidateAnswersByCandidate[candidateId]![questionId];

      if (candidateAnswer && candidateAnswer.response !== null && candidateAnswer.response !== undefined) {
        const score = calculateWahlcheckQuestionScore(userResponse, candidateAnswer.response, weight);
        if (!score) return;

        scores[candidateId] = (scores[candidateId] || 0) + score.points;
        maxScores[candidateId] = (maxScores[candidateId] || 0) + score.maxPoints;
      }
    });
  });

  // Convert to percentages
  const results: WahlcheckResult[] = [];
  Object.keys(scores).forEach((candidateId) => {
    const percentage =
      (maxScores[candidateId] ?? 0) > 0 ? Math.round(((scores[candidateId] ?? 0) / maxScores[candidateId]!) * 100) : 0;
    results.push({
      candidateId,
      score: scores[candidateId] ?? 0,
      maxScore: maxScores[candidateId] ?? 0,
      percentage,
    });
  });

  return results;
});

function sectorLabel(sector: string | null | undefined) {
  const key = normalizeSector(sector);
  if (!key) return "";
  const translated = $translateDynamic(`measure_sectors.${key}.title`);
  return translated === `measure_sectors.${key}.title` ? key : translated;
}

// Get sector icon from imported images
function getSectorIcon(sectorKey: string | null | undefined) {
  const key = normalizeSector(sectorKey);
  return key ? sectorImages[key as keyof typeof sectorImages] || undefined : undefined;
}

// Calculate sector agreement scores for each candidate
const sectorAgreements = computed(() => {
  const sectorScores: Record<
    string,
    Record<string, { score: number; maxScore: number; percentage: number; sector: string }>
  > = {};

  // Group candidate answers by candidate
  const candidateAnswersByCandidate: Record<
    string,
    Record<string, Pick<CandidateAnswer, "response" | "explanation">>
  > = {};
  props.candidateAnswers.forEach((ans) => {
    const candidateId = typeof ans.candidate === "object" ? ans.candidate.id : ans.candidate;
    if (!candidateAnswersByCandidate[candidateId]) {
      candidateAnswersByCandidate[candidateId] = {};
    }
    const questionId = typeof ans.question === "object" ? ans.question.id : ans.question;
    candidateAnswersByCandidate[candidateId]![questionId] = {
      response: ans.response,
      explanation: ans.explanation,
    };
  });

  // Group questions by sector
  const questionsBySector: Record<string, ElectionQuestion[]> = {};
  props.questions.forEach((q) => {
    const sector = normalizeSector(q.sector);
    if (!sector) return;
    if (!questionsBySector[sector]) {
      questionsBySector[sector] = [];
    }
    questionsBySector[sector]!.push(q);
  });

  // Calculate sector scores for each candidate
  Object.keys(candidateAnswersByCandidate).forEach((candidateId) => {
    sectorScores[candidateId] = {};

    Object.keys(questionsBySector).forEach((sector) => {
      let sectorScore = 0;
      let sectorMaxScore = 0;

      questionsBySector[sector]!.forEach((q) => {
        const questionId = q.id;
        const userResponse = props.userAnswers[questionId];

        // Skip if user didn't answer
        if (userResponse === undefined || userResponse === null) return;

        const isDoubleWeighted = props.doubleWeightedQuestions.has(questionId);
        const weight = isDoubleWeighted ? 2 : 1;

        const candidateAnswer = candidateAnswersByCandidate[candidateId]![questionId];

        if (candidateAnswer && candidateAnswer.response !== null && candidateAnswer.response !== undefined) {
          const score = calculateWahlcheckQuestionScore(userResponse, candidateAnswer.response, weight);
          if (!score) return;

          sectorScore += score.points;
          sectorMaxScore += score.maxPoints;
        }
      });

      const percentage = sectorMaxScore > 0 ? Math.round((sectorScore / sectorMaxScore) * 100) : 0;
      sectorScores[candidateId]![sector] = {
        score: sectorScore,
        maxScore: sectorMaxScore,
        percentage,
        sector: sector, // Store the normalized sector key
      };
    });
  });

  return sectorScores;
});

// Get sector with highest or lowest agreement for a candidate
function getSectorAgreement(candidateId: string, type: "highest" | "lowest" = "highest") {
  const candidateSectors = sectorAgreements.value[candidateId];

  if (!candidateSectors || Object.keys(candidateSectors).length === 0) {
    return null;
  }

  // Filter out sectors with 0 maxScore (no questions answered)
  const validSectors = Object.values(candidateSectors).filter((s) => s.maxScore > 0);

  if (validSectors.length === 0) {
    return null;
  }

  // Sort by percentage
  validSectors.sort((a, b) => {
    // If percentages are equal, use maxScore as tiebreaker (higher relevance)
    if (a.percentage === b.percentage) {
      return type === "highest" ? b.maxScore - a.maxScore : a.maxScore - b.maxScore;
    }
    return type === "highest" ? b.percentage - a.percentage : a.percentage - b.percentage;
  });

  const selected = validSectors[0]!;
  const sectorKey = normalizeSector(selected.sector);
  if (!sectorKey) return null;
  const label = sectorLabel(sectorKey);
  return {
    percentage: selected.percentage,
    sector: label,
    sectorRaw: sectorKey, // Raw sector key for icon lookup
    score: selected.score,
    maxScore: selected.maxScore,
  };
}

function hasSectorAgreement(candidateId: string) {
  return Boolean(
    hasMultipleQuestionSectors.value &&
    getSectorAgreement(candidateId, "highest") &&
    getSectorAgreement(candidateId, "lowest"),
  );
}

// Sorted results by percentage (descending)
const sortedResults = computed(() => {
  return [...results.value].sort((a, b) => b.percentage - a.percentage);
});

// Toggle expand
function toggleExpand(candidateId: string) {
  expandedCandidate.value = expandedCandidate.value === candidateId ? null : candidateId;
}

// Encode answers and double-weighted questions for sharing
function encodeShareableData() {
  try {
    // Convert Set to Array for JSON serialization
    const doubleWeightedArray = Array.from(props.doubleWeightedQuestions);

    const shareData = {
      answers: props.userAnswers,
      doubleWeighted: doubleWeightedArray,
      electionId: props.election.id,
      timestamp: new Date().toISOString(),
    };

    // Convert to JSON and encode as base64
    const jsonString = JSON.stringify(shareData);
    const encoded = btoa(encodeURIComponent(jsonString));

    return encoded;
  } catch (error) {
    console.error("Error encoding shareable data:", error);
    return null;
  }
}

// Generate shareable URL
function generateShareableUrl() {
  const encodedData = encodeShareableData();
  if (!encodedData) return null;

  // Get current URL and add share parameter
  const currentUrl = window.location.href.split("?")[0];
  return `${currentUrl}?share=${encodedData}`;
}

// Copy shareable link to clipboard
function _copyShareableLink() {
  const url = generateShareableUrl();
  if (!url) {
    alert($t("elections.wahlcheck.results.share.create_error"));
    return;
  }

  // Copy to clipboard
  navigator.clipboard
    .writeText(url)
    .then(() => {
      alert($t("elections.wahlcheck.results.share.copied"));
    })
    .catch((err: unknown) => {
      console.error("Error copying share link:", err);
      alert($t("elections.wahlcheck.results.share.copy_error"));
    });
}

// Decode shareable data from URL (for future use)
function _decodeShareableData(encodedString: string) {
  try {
    const decoded = decodeURIComponent(atob(encodedString));
    return JSON.parse(decoded) as unknown;
  } catch (error) {
    console.error("Error decoding shareable data:", error);
    return null;
  }
}
</script>

<style scoped>
/* Confetti Animation */
.confetti {
  position: absolute;
  width: var(--size);
  height: var(--size);
  background-color: var(--color);
  border-radius: 50%;
  left: var(--left);
  top: -10px;
  animation: confetti-fall var(--animation-duration) var(--animation-delay) ease-out forwards;
}

@keyframes confetti-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(360deg);
    opacity: 0;
  }
}

/* Circular progress animation */
svg path {
  transition: stroke-dashoffset 1s ease-out;
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease-out;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}

/* Rotate animation for chevron */
.rotate-180 {
  transform: rotate(180deg);
}
</style>
