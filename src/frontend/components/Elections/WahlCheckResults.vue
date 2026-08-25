<template>
  <div class="space-y-8 relative">
    <!-- Confetti Animation -->
    <div v-if="showConfetti" class="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <div v-for="i in 100" :key="i" class="confetti" :style="{
        '--left': `${Math.random() * 100}%`,
        '--animation-duration': `${2 + Math.random() * 2}s`,
        '--animation-delay': `${Math.random() * 2}s`,
        '--color': getConfettiColor(i),
        '--size': `${5 + Math.random() * 10}px`
      }"></div>
    </div>

    <!-- Header -->
    <div class="bg-white p-4 sm:p-8 rounded-xl shadow-list border border-solid-gray-10 text-center">
      <div class="mb-6">
        <ElectionsWahlCheckLogo
          :logo="election?.custom_logo"
          fallback="wahlcheck"
          :alt="$t('elections.wahlcheck.header_title')"
          logo-class="mx-auto h-auto max-h-48 w-auto max-w-full object-contain"
          fallback-class="mx-auto h-auto w-full max-w-lg object-contain"
        />
      </div>
      <h2 class="text-xl sm:text-2xl font-bold text-stats-dark mb-4">
        {{ $t(hasPartyCandidate ? 'elections.wahlcheck.results.title_parties' : 'elections.wahlcheck.results.title') }}
      </h2>
      <p class="text-mid-gray max-w-2xl mx-auto text-sm sm:text-base">
        {{ $t('elections.wahlcheck.results.description') }}
      </p>
      <p v-if="election" class="text-sm text-mid-gray mt-4">
        <strong>{{ $t('elections.election') }}:</strong> {{ election.descriptor }}
      </p>
    </div>

    <div
      v-if="nonRespondingCandidates.length > 0"
      class="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-lg border border-solid-gray-20 bg-solid-gray-05 px-4 py-3 text-sm leading-relaxed text-mid-gray"
    >
      <span class="font-semibold text-gray">{{ $t('elections.wahlcheck.results.no_response') }}:</span>
      <template v-for="(candidate, index) in nonRespondingCandidates" :key="candidate.id">
        <span v-if="index > 0" aria-hidden="true">,</span>
        <span v-if="!candidateNameMatchesParty(candidate)">{{ getCandidateDisplayName(candidate) }}</span>
        <CandidatePartyLabel v-if="candidate.party" :party="candidate.party" :state="null" class="text-xs" />
      </template>
    </div>

    <!-- Bar Chart Overview (Requirement 7) -->
    <div v-if="results.length > 0" class="bg-white p-4 sm:p-6 rounded-xl shadow-list border border-solid-gray-10">
      <h3 class="text-lg sm:text-xl font-bold text-center text-stats-dark mb-6">
        {{ $t(hasPartyCandidate ? 'elections.wahlcheck.results.all_parties' : 'elections.wahlcheck.results.all_candidates') }}
      </h3>
      <div class="space-y-4">
        <div 
          v-for="result in sortedResults" 
          :key="result.candidateId" 
          class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 pb-3 md:pb-0 border-b border-solid-gray-10 md:border-0 last:border-0"
        >
          <div class="w-full md:w-64 md:flex-shrink-0">
            <div class="flex items-center flex-wrap gap-x-2 gap-y-1">
              <span class="font-bold text-stats-dark">{{ sortedResults.indexOf(result) + 1 }}.</span>
              <span v-if="!isPartyCandidate(result.candidateId)" class="text-sm font-bold text-black break-words hyphens-auto">{{ getCandidateName(result.candidateId) }}</span>
              <CandidatePartyLabel
                v-if="getCandidateParty(result.candidateId)"
                :party="getCandidateParty(result.candidateId)"
                :state="null"
                class="text-xs"
              />
            </div>
          </div>
          <div class="w-full flex-1 min-w-0">
            <ProgressBar :scoreTotal="result.percentage" layout="default" />
          </div>
        </div>
      </div>
    </div>

    <!-- Results Summary -->
    <div v-if="results.length > 0" class="bg-gradient-to-r from-solid-ff-green-10 to-solid-stats-light-50 p-4 sm:p-8 rounded-xl border border-solid-ff-green-30">
      <h3 class="text-lg sm:text-xl font-bold text-center text-stats-dark mb-6">
        {{ $t('elections.wahlcheck.results.top_matches') }}
      </h3>

      <!-- Animated Results List (Requirement 8) -->
      <div class="space-y-4">
        <div
          v-for="(result, index) in sortedResults"
          :key="result.candidateId"
          class="bg-white rounded-xl p-4 sm:p-6 shadow-list border border-solid-gray-10 transition-all duration-500"
          :style="{ animationDelay: `${index * 100}ms` }"
          :class="`fade-in-up animation-delay-${index}`"
          @mouseenter="hoveredCandidate = result.candidateId"
          @mouseleave="hoveredCandidate = null"
        >
          <div class="flex items-center justify-between gap-2.5 sm:gap-4">
            <!-- Rank -->
            <div class="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-stats-dark text-white flex items-center justify-center font-bold text-base sm:text-xl shadow-md">
              {{ index + 1 }}
            </div>

            <!-- Candidate Info (Party Tag below name on mobile/desktop per Requirement 8) -->
            <div class="flex-1 min-w-0">
              <h4 v-if="!isPartyCandidate(result.candidateId)" class="text-base sm:text-lg font-bold text-black break-words hyphens-auto leading-snug">
                {{ getCandidateName(result.candidateId) }}
              </h4>
              <div v-if="getCandidateParty(result.candidateId)" :class="{ 'mt-1': !isPartyCandidate(result.candidateId) }">
                <CandidatePartyLabel
                  :party="getCandidateParty(result.candidateId)"
                  :state="null"
                  class="text-xs inline-block"
                />
              </div>
            </div>

            <!-- Ranking Indicator -->
            <div class="flex-shrink-0 w-14 sm:w-20 flex flex-col items-center justify-center">
              <div class="relative w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-md">
                <!-- Medal background -->
                <div
                  class="absolute inset-0 rounded-full opacity-20"
                  :class="getRankingBgColor(sortedResults.indexOf(result) + 1)"
                ></div>
                <!-- Rank number -->
                <span class="relative text-2xl sm:text-3xl font-bold" :class="getRankingColor(sortedResults.indexOf(result) + 1)">
                  {{ sortedResults.indexOf(result) + 1 }}
                </span>
              </div>
              <span class="text-[9px] sm:text-[10px] text-mid-gray uppercase tracking-wider mt-0.5 sm:mt-1">{{ $t('elections.wahlcheck.results.match') }}</span>
            </div>

            <!-- Expand Button -->
            <button
              @click="toggleExpand(result.candidateId)"
              class="btn btn-circle btn-ghost btn-sm hover:bg-solid-ff-green-10 transition-all flex-shrink-0"
              :class="{ 'rotate-180': expandedCandidate === result.candidateId }"
              :aria-label="$t('elections.wahlcheck.results.details')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 sm:h-6 sm:w-6 text-stats-dark transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <!-- Expanded Details -->
          <div
            v-if="expandedCandidate === result.candidateId"
            class="mt-6 pt-6 border-t border-solid-gray-10 overflow-hidden transition-all duration-300"
          >
            <h5 class="font-bold text-stats-dark mb-4 break-words hyphens-auto">{{ $t('elections.wahlcheck.results.details') }}</h5>

            <!-- Score Breakdown -->
            <div
              v-if="hasSectorAgreement(result.candidateId)"
              class="grid grid-cols-2 gap-2 sm:gap-6 mb-4 sm:mb-6"
            >
              <div class="bg-solid-rating-4-10 min-w-0 rounded-xl p-2 text-center shadow-lg transition-shadow hover:shadow-xl sm:rounded-2xl sm:p-6">
                <div class="mb-1 flex items-center justify-center sm:mb-4">
                  <img
                    v-if="getSectorIcon(getSectorAgreement(result.candidateId, 'highest').sectorRaw)"
                    :src="getSectorIcon(getSectorAgreement(result.candidateId, 'highest').sectorRaw)"
                    class="slk-sector-icon h-6 w-6 opacity-90 sm:h-12 sm:w-12"
                    :alt="getSectorAgreement(result.candidateId, 'highest').sector"
                  />
                </div>
                <div class="text-xl font-bold text-rating-4 sm:text-4xl">{{ getSectorAgreement(result.candidateId, 'highest').percentage }}%</div>
                <div class="mt-0.5 break-words text-xs font-bold leading-tight text-solid-rating-4-90 hyphens-auto sm:mt-2 sm:text-lg">{{ getSectorAgreement(result.candidateId, 'highest').sector }}</div>
                <div class="mt-0.5 text-[9px] uppercase leading-tight tracking-wider text-solid-rating-4-60 sm:mt-1 sm:text-sm">{{ $t("elections.wahlcheck.results.best_match") }}</div>
              </div>
              <div class="bg-solid-stats-light-50 min-w-0 rounded-xl p-2 text-center shadow-lg transition-shadow hover:shadow-xl sm:rounded-2xl sm:p-6">
                <div class="mb-1 flex items-center justify-center sm:mb-4">
                  <img
                    v-if="getSectorIcon(getSectorAgreement(result.candidateId, 'lowest').sectorRaw)"
                    :src="getSectorIcon(getSectorAgreement(result.candidateId, 'lowest').sectorRaw)"
                    class="slk-sector-icon h-6 w-6 opacity-90 sm:h-12 sm:w-12"
                    :alt="getSectorAgreement(result.candidateId, 'lowest').sector"
                  />
                </div>
                <div class="text-xl font-bold text-stats-dark sm:text-4xl">{{ getSectorAgreement(result.candidateId, 'lowest').percentage }}%</div>
                <div class="mt-0.5 break-words text-xs font-bold leading-tight text-solid-stats-dark-80 hyphens-auto sm:mt-2 sm:text-lg">{{ getSectorAgreement(result.candidateId, 'lowest').sector }}</div>
                <div class="mt-0.5 text-[9px] uppercase leading-tight tracking-wider text-solid-stats-dark-60 sm:mt-1 sm:text-sm">{{ $t("elections.wahlcheck.results.lowest_match") }}</div>
              </div>
            </div>

            <!-- Sort Toggle Button -->
            <div class="mb-4">
              <button
                @click="toggleSort"
                class="btn btn-sm px-4 py-1.5 rounded-full text-sm font-medium border border-solid-gray-20 hover:border-solid-ff-green-30 hover:bg-solid-ff-green-05 bg-white transition-all flex items-center gap-2"
              >
                <span>{{ sortLabel }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-stats-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <!-- Mobile Question-by-Question Comparison Table (Requirement 5) -->
            <div class="sm:hidden space-y-1">
              <!-- Mobile Header -->
              <div class="grid grid-cols-[1fr_48px_68px] gap-1 px-2.5 py-2 bg-solid-gray-10 rounded-t-lg font-semibold text-xs text-solid-gray-60 border-b border-solid-gray-20 items-center">
                <div>{{ $t("elections.thesis") }}</div>
                <div class="text-center">{{ $t("elections.wahlcheck.results.my_rating_short") }}</div>
                <div class="text-center">{{ $t("elections.wahlcheck.results.candidate_rating_short") }}</div>
              </div>

              <!-- Mobile Rows -->
              <div
                v-for="(question, qIndex) in sortedExpandedQuestions"
                :key="'mobile-' + question.id"
                class="grid grid-cols-[1fr_48px_68px] gap-1 px-2.5 py-2.5 bg-white rounded-lg border-b border-solid-gray-10 last:border-0 hover:bg-mild-white items-center"
              >
                <!-- Thesis Title -->
                <div class="text-xs text-black pr-1 min-w-0">
                  <span class="break-words hyphens-auto font-medium leading-snug">{{ question.title }}</span>
                  <span
                    v-if="doubleWeightedQuestions.has(question.id)"
                    class="ml-1 text-[10px] bg-orange text-white px-1.5 py-0.2 rounded-full font-bold inline-block"
                    :title="$t('elections.wahlcheck.results.double_weighted')"
                  >2×</span>
                </div>

                <!-- User Answer -->
                <div class="flex justify-center">
                  <div
                    v-if="userAnswers[question.id] !== undefined"
                    class="w-6 h-6 rounded-full shadow-sm"
                    :class="getRatingColor(userAnswers[question.id])"
                    :title="$t('elections.wahlcheck.results.my_rating_title', { ':rating': getRatingLabel(userAnswers[question.id]) })"
                  ></div>
                  <div v-else class="w-6 h-6 rounded-full bg-solid-gray-20"></div>
                </div>

                <!-- Candidate Answer -->
                <div class="flex items-center justify-center gap-1">
                  <div
                    v-if="getCandidateAnswer(result.candidateId, question.id)"
                    class="w-6 h-6 rounded-full shadow-sm flex-shrink-0"
                    :class="getRatingColor(getCandidateAnswer(result.candidateId, question.id).response)"
                    :title="$t('elections.wahlcheck.results.candidate_rating_title', { ':rating': getRatingLabel(getCandidateAnswer(result.candidateId, question.id).response) })"
                  ></div>
                  <div v-else class="w-6 h-6 rounded-full bg-solid-gray-20 flex-shrink-0"></div>
                  
                  <button
                    v-if="getCandidateAnswer(result.candidateId, question.id)"
                    type="button"
                    class="btn btn-circle btn-ghost btn-xs h-6 min-h-6 w-6 p-0 border flex-shrink-0"
                    :class="getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                      ? 'border-stats-dark/15 text-stats-dark hover:bg-stats-light'
                      : 'border-red/40 text-red hover:border-red hover:bg-red/10'"
                    :aria-label="getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                      ? $t('elections.wahlcheck.results.show_reasoning')
                      : $t('elections.wahlcheck.results.no_reasoning')"
                    :title="getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                      ? $t('elections.wahlcheck.results.show_reasoning')
                      : $t('elections.wahlcheck.results.no_reasoning')"
                    @click="openReasoning(result.candidateId, question)"
                  >
                    <span aria-hidden="true" class="text-xs font-bold leading-none">i</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Desktop Question-by-Question Comparison Table -->
            <div class="hidden sm:block overflow-x-auto pb-2">
              <div class="min-w-[560px] sm:min-w-[640px]">
                <!-- Table Header -->
                <div
                  class="grid gap-2 px-3 py-2 bg-solid-gray-10 rounded-t-lg font-semibold text-xs sm:text-sm text-solid-gray-60 border-b border-solid-gray-20"
                  :class="hasQuestionSectors ? 'grid-cols-[36px_1fr_60px_100px_100px] sm:grid-cols-[40px_1fr_80px_120px_120px]' : 'grid-cols-[36px_1fr_100px_100px] sm:grid-cols-[40px_1fr_120px_120px]'"
                >
                  <div class="text-center">#</div>
                  <div>{{ $t("elections.thesis") }}</div>
                  <div v-if="hasQuestionSectors" class="text-center">{{ $t("stats.chart.sector") }}</div>
                  <div class="text-center">{{ $t("elections.wahlcheck.results.my_rating_short") }}</div>
                  <div class="text-center">{{ $t("elections.wahlcheck.results.candidate_rating_short") }}</div>
                </div>

                <!-- Table Rows -->
                <div
                  v-for="(question, qIndex) in sortedExpandedQuestions"
                  :key="question.id"
                  class="grid gap-2 px-3 py-2.5 bg-white rounded-lg border-b border-solid-gray-10 last:border-0 hover:bg-mild-white transition-all items-center"
                  :class="hasQuestionSectors ? 'grid-cols-[36px_1fr_60px_100px_100px] sm:grid-cols-[40px_1fr_80px_120px_120px]' : 'grid-cols-[36px_1fr_100px_100px] sm:grid-cols-[40px_1fr_120px_120px]'"
                >
                  <div class="text-xs sm:text-sm text-solid-gray-50 text-center">{{ question.originalIndex + 1 }}.</div>
                  <div class="text-xs sm:text-sm text-black flex items-center gap-2 flex-wrap">
                    <span class="break-words hyphens-auto">{{ question.title }}</span>
                    <span
                      v-if="doubleWeightedQuestions.has(question.id)"
                      class="text-[10px] sm:text-xs bg-orange text-white px-1.5 py-0.5 rounded-full font-bold"
                      :title="$t('elections.wahlcheck.results.double_weighted')"
                    >2×</span>
                  </div>

                  <!-- Sector -->
                  <div v-if="hasQuestionSectors" class="flex justify-center">
                    <div v-if="question.sector" class="flex items-center gap-1">
                      <img
                        :src="getSectorIcon(question.sector)"
                        class="h-6 w-6 sm:h-8 sm:w-8 opacity-60"
                        :alt="sectorLabel(question.sector)"
                      >
                    </div>
                    <div v-else class="w-6 sm:w-8"></div>
                  </div>

                  <!-- User Answer -->
                  <div class="flex justify-center">
                    <div
                      v-if="userAnswers[question.id] !== undefined"
                      class="w-7 h-7 sm:w-8 sm:h-8 rounded-full shadow-sm"
                      :class="getRatingColor(userAnswers[question.id])"
                      :title="$t('elections.wahlcheck.results.my_rating_title', { ':rating': getRatingLabel(userAnswers[question.id]) })"
                    ></div>
                    <div v-else class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-solid-gray-20">
                    </div>
                  </div>

                  <!-- Candidate Answer -->
                  <div class="flex items-center justify-center gap-1.5 sm:gap-2">
                    <div
                      v-if="getCandidateAnswer(result.candidateId, question.id)"
                      class="w-7 h-7 sm:w-8 sm:h-8 rounded-full shadow-sm"
                      :class="getRatingColor(getCandidateAnswer(result.candidateId, question.id).response)"
                      :title="$t('elections.wahlcheck.results.candidate_rating_title', { ':rating': getRatingLabel(getCandidateAnswer(result.candidateId, question.id).response) })"
                    ></div>
                    <div v-else class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-solid-gray-20">
                    </div>
                    <button
                      v-if="getCandidateAnswer(result.candidateId, question.id)"
                      type="button"
                      class="btn btn-circle btn-ghost btn-xs h-7 min-h-7 w-7 sm:h-8 sm:min-h-8 sm:w-8 border"
                      :class="getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                        ? 'border-stats-dark/15 text-stats-dark hover:bg-stats-light'
                        : 'border-red/40 text-red hover:border-red hover:bg-red/10'"
                      :aria-label="getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                        ? $t('elections.wahlcheck.results.show_reasoning')
                        : $t('elections.wahlcheck.results.no_reasoning')"
                      :title="getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                        ? $t('elections.wahlcheck.results.show_reasoning')
                        : $t('elections.wahlcheck.results.no_reasoning')"
                      @click="openReasoning(result.candidateId, question)"
                    >
                      <span class="sr-only">
                        {{ getCandidateExplanation(getCandidateAnswer(result.candidateId, question.id))
                          ? $t('elections.wahlcheck.results.show_reasoning')
                          : $t('elections.wahlcheck.results.no_reasoning') }}
                      </span>
                      <span aria-hidden="true" class="text-xs sm:text-sm font-bold leading-none">i</span>
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
    <div v-else class="bg-solid-orange-10 border border-orange text-orange-700 p-8 rounded-xl text-center">
      <div class="mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 mx-auto text-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
	      <h3 class="text-xl font-bold mb-4">{{ $t("elections.wahlcheck.results.no_matches.title") }}</h3>
	      <p class="text-mid-gray">
	        {{ $t("elections.wahlcheck.results.no_matches.description") }}
      </p>
      <button
        @click="$emit('restart')"
        class="btn btn-primary px-8 py-3 rounded-full font-semibold text-white mt-6"
      >
        {{ $t("generic.try_again") }}
      </button>
    </div>

    <dialog
      ref="reasoningDialog"
      class="modal"
      @close="activeReasoning = null"
    >
      <div
        class="modal-box max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] overflow-y-auto overscroll-contain p-0"
        :class="activeReasoning?.explanation ? 'max-w-2xl' : 'max-w-lg'"
      >
        <div
          v-if="activeReasoning && !activeReasoning.explanation"
          class="relative p-5"
        >
          <p class="w-full rounded-lg border border-red/20 bg-red/5 p-4 pr-12 text-base font-medium leading-relaxed text-red">
            {{ $t('elections.wahlcheck.results.no_reasoning') }}
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
              {{ $t('elections.wahlcheck.results.reasoning') }}
            </p>
            <div class="mt-1 flex min-w-0 items-start justify-between gap-3">
              <CandidatePartyLabel
                v-if="activeReasoning && isPartyCandidate(activeReasoning.candidateId)"
                :party="getCandidateParty(activeReasoning.candidateId)"
                :state="null"
                class="flex-shrink-0 text-sm"
              />
              <h3 v-else class="min-w-0 break-words text-xl font-bold leading-tight text-black">
                {{ activeReasoning ? getCandidateName(activeReasoning.candidateId) : '' }}
              </h3>
              <div
                v-if="activeReasoning"
                class="flex max-w-[8rem] flex-shrink-0 items-center gap-1.5 text-right"
              >
                <span class="text-[10px] font-semibold leading-tight text-mid-gray">
                  {{ $t('elections.wahlcheck.results.candidate_rating') }}
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
            <button
              type="submit"
              class="btn btn-circle btn-ghost btn-sm"
              :aria-label="$t('generic.close')"
            >
              <span aria-hidden="true">×</span>
            </button>
          </form>
        </div>

        <div v-if="activeReasoning?.explanation" class="space-y-5 p-5">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-mid-gray">
              {{ $t('elections.thesis') }}
            </p>
            <p class="mt-1 text-base font-semibold text-black">
              {{ getQuestionTitle(activeReasoning.question) }}
            </p>
            <p
              v-if="showQuestionThesis(activeReasoning.question)"
              class="mt-2 text-sm leading-relaxed text-gray"
            >
              {{ activeReasoning.question.thesis }}
            </p>
          </div>

          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-mid-gray">
              {{ $t('elections.wahlcheck.results.reasoning') }}
            </p>
            <p class="mt-2 whitespace-pre-line rounded-lg border border-gray/10 bg-white p-4 text-base leading-relaxed text-black">
              {{ activeReasoning.explanation }}
            </p>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>{{ $t('generic.close') }}</button>
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
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-8 pt-6 border-t border-solid-gray-10 gap-4">
      <div class="text-xs sm:text-sm text-mid-gray text-center sm:text-left">
        {{ $t(hasPartyCandidate ? "elections.wahlcheck.results.compared_parties" : "elections.wahlcheck.results.compared_count", { ":count": results.length }) }}
      </div>
      <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        <button
          type="button"
          @click="$emit('prev')"
          class="flex-1 sm:flex-initial btn btn-outline btn-secondary px-4 sm:px-6 py-2 rounded-full font-semibold"
        >
          {{ $t("generic.back") }}
        </button>
        <button
          type="button"
          @click="$emit('restart')"
          class="flex-1 sm:flex-initial btn btn-outline px-4 sm:px-6 py-2 rounded-full font-semibold border-ff-green text-ff-green hover:bg-solid-ff-green-10 whitespace-nowrap"
        >
          {{ $t("generic.restart") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ProgressBar from '~/components/ProgressBar.vue'
import CandidatePartyLabel from '~/components/CandidatePartyLabel.vue'
import {
  candidateNameMatchesParty,
  getCandidateDisplayName,
} from '~/shared/candidateParties.js'
import sectorImages from '~/shared/sectorImages.js'
import {
  calculateWahlcheckQuestionScore,
  getWahlcheckAnswerLabel,
  getWahlcheckRatingColor,
} from '~/shared/wahlcheckAnswerOptions.js'

const { $t } = useNuxtApp()

const props = defineProps({
  election: {
    type: Object,
    required: true
  },
  candidates: {
    type: Array,
    required: true
  },
  questions: {
    type: Array,
    required: true
  },
  userAnswers: {
    type: Object,
    required: true
  },
  doubleWeightedQuestions: {
    type: Set,
    required: true
  },
  candidateAnswers: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['restart', 'prev'])

// State
const expandedCandidate = ref(null)
const hoveredCandidate = ref(null)
const showConfetti = ref(false)
const sortBy = ref('default') // 'default', 'agreement', 'disagreement'
const reasoningDialog = ref(null)
const activeReasoning = ref(null)

const nonRespondingCandidates = computed(() => {
  return props.candidates.filter((candidate) => candidate.has_answered !== true)
})

const hasPartyCandidate = computed(() => {
  return props.candidates.some(
    (candidate) => candidate.has_answered === true && candidateNameMatchesParty(candidate)
  )
})

// Toggle through sort modes
function toggleSort() {
  const modes = ['default', 'agreement', 'disagreement']
  const currentIndex = modes.indexOf(sortBy.value)
  sortBy.value = modes[(currentIndex + 1) % modes.length]
}

// Sort label text
const sortLabel = computed(() => {
  switch (sortBy.value) {
    case 'default': return $t('elections.wahlcheck.results.sort.default')
    case 'agreement': return $t('elections.wahlcheck.results.sort.agreement')
    case 'disagreement': return $t('elections.wahlcheck.results.sort.disagreement')
    default: return $t('elections.wahlcheck.results.sort.order')
  }
})

// Sorting functions
const sortedExpandedQuestions = computed(() => {
  if (!expandedCandidate.value) return []

  const candidateId = expandedCandidate.value
  const candidateAnswersByQuestion = {}
  props.candidateAnswers.forEach(ans => {
    const cId = typeof ans.candidate === 'object' ? ans.candidate.id : ans.candidate
    const qId = typeof ans.question === 'object' ? ans.question.id : ans.question
    if (cId === candidateId) {
      candidateAnswersByQuestion[qId] = ans.response
    }
  })

  const originalIndices = new Map(props.questions.map((q, i) => [q.id, i]))

  return [...props.questions].map(q => {
    const userAnswer = props.userAnswers[q.id]
    const candidateAnswer = candidateAnswersByQuestion[q.id]
    const score = calculateWahlcheckQuestionScore(userAnswer, candidateAnswer)
    return {
      ...q,
      difference: score?.distance ?? null,
      originalIndex: originalIndices.get(q.id) ?? 0
    }
  }).filter(q => {
    // Show every thesis the user answered. A missing candidate answer is
    // represented by the neutral placeholder in the comparison table.
    return props.userAnswers[q.id] !== undefined &&
      props.userAnswers[q.id] !== null
  }).sort((a, b) => {
    if (sortBy.value === 'default') {
      return a.originalIndex - b.originalIndex
    } else if (sortBy.value === 'agreement') {
      return (a.difference ?? Infinity) - (b.difference ?? Infinity)
    } else if (sortBy.value === 'disagreement') {
      return (b.difference ?? -Infinity) - (a.difference ?? -Infinity)
    }
    return 0
  })
})

// Trigger confetti animation when component mounts
onMounted(() => {
  showConfetti.value = true
  setTimeout(() => {
    showConfetti.value = false
  }, 3000)
})

// Confetti colors using logo colors
const confettiColors = [
  '#AFCA0B', // light-green
  '#1da64a', // ff-green
  '#ffc80c', // localzero-yellow
  '#16bae7', // light-blue
  '#f27c00', // slk-orange
]

function getConfettiColor(index) {
  return confettiColors[index % confettiColors.length]
}

const progressColors = {
  0: '#e30613',
  1: '#f39200',
  2: '#ffd400',
  3: '#afca0b',
  4: '#1da64a'
}

function getRatingColor(value) {
  return getWahlcheckRatingColor(value)
}

function getRatingLabel(value) {
  return getWahlcheckAnswerLabel(value, props.election, $t)
}

function getProgressColor(percentage) {
  if (percentage >= 80) return progressColors[4]
  if (percentage >= 60) return progressColors[3]
  if (percentage >= 40) return progressColors[2]
  if (percentage >= 20) return progressColors[1]
  return progressColors[0]
}

// Ranking colors - gold, silver, bronze
const rankingColors = {
  1: 'text-yellow-500',  // Gold
  2: 'text-gray-700',   // Silver
  3: 'text-amber-700'   // Bronze
}

function getRankingColor(rank) {
  return rankingColors[rank] || 'text-stats-dark'
}

// Ranking background colors (subtle medal colors)
const rankingBgColors = {
  1: 'bg-yellow-400',
  2: 'bg-black',
  3: 'bg-amber-800'
}

function getRankingBgColor(rank) {
  return rankingBgColors[rank] || 'bg-solid-ff-green-20'
}

// Helper functions for candidate data
function getCandidate(candidateId) {
  return props.candidates.find(candidate => String(candidate.id) === String(candidateId))
}

function getCandidateName(candidateId) {
  const candidate = getCandidate(candidateId)
  return candidate ? getCandidateDisplayName(candidate) : $t('elections.unknown_candidate')
}

function getCandidateParty(candidateId) {
  return getCandidate(candidateId)?.party || null
}

function isPartyCandidate(candidateId) {
  return candidateNameMatchesParty(getCandidate(candidateId))
}

function getCandidateAnswer(candidateId, questionId) {
  return props.candidateAnswers.find(ans =>
    (typeof ans.candidate === 'object' ? ans.candidate.id : ans.candidate) === candidateId &&
    (typeof ans.question === 'object' ? ans.question.id : ans.question) === questionId
  )
}

function getCandidateExplanation(answer) {
  const explanation = String(answer?.explanation ?? '').trim()
  return explanation || null
}

function getQuestionTitle(question) {
  return question?.title || question?.thesis || $t('elections.thesis')
}

function showQuestionThesis(question) {
  const title = String(question?.title ?? '').trim()
  const thesis = String(question?.thesis ?? '').trim()
  return Boolean(thesis && thesis !== title)
}

function openReasoning(candidateId, question) {
  const answer = getCandidateAnswer(candidateId, question.id)
  const explanation = getCandidateExplanation(answer)

  if (!answer) {
    return
  }

  activeReasoning.value = {
    candidateId,
    question,
    answer,
    explanation
  }
  reasoningDialog.value?.showModal()
}

function normalizeSector(sector) {
  const normalized = String(sector ?? '').toLowerCase().trim()
  return normalized || null
}

const questionSectors = computed(() => {
  return new Set(props.questions.map((question) => normalizeSector(question.sector)).filter(Boolean))
})

const hasQuestionSectors = computed(() => questionSectors.value.size > 0)
const hasMultipleQuestionSectors = computed(() => questionSectors.value.size > 1)

// Calculate similarity scores
const results = computed(() => {
  const scores = {}
  const maxScores = {}

  // Group candidate answers by candidate
  const candidateAnswersByCandidate = {}
  props.candidateAnswers.forEach(ans => {
    const candidateId = typeof ans.candidate === 'object' ? ans.candidate.id : ans.candidate
    if (!candidateAnswersByCandidate[candidateId]) {
      candidateAnswersByCandidate[candidateId] = {}
    }
    const questionId = typeof ans.question === 'object' ? ans.question.id : ans.question
    candidateAnswersByCandidate[candidateId][questionId] = {
      response: ans.response,
      explanation: ans.explanation
    }
  })

  // Calculate scores for each candidate
  props.questions.forEach(question => {
    const questionId = question.id
    const userResponse = props.userAnswers[questionId]

    // Skip if user didn't answer
    if (userResponse === undefined || userResponse === null) return

    const isDoubleWeighted = props.doubleWeightedQuestions.has(questionId)
    const weight = isDoubleWeighted ? 2 : 1

    Object.keys(candidateAnswersByCandidate).forEach(candidateId => {
      const candidateAnswer = candidateAnswersByCandidate[candidateId][questionId]

      if (candidateAnswer && candidateAnswer.response !== null && candidateAnswer.response !== undefined) {
        const score = calculateWahlcheckQuestionScore(userResponse, candidateAnswer.response, weight)
        if (!score) return

        scores[candidateId] = (scores[candidateId] || 0) + score.points
        maxScores[candidateId] = (maxScores[candidateId] || 0) + score.maxPoints
      }
    })
  })

  // Convert to percentages
  const results = []
  Object.keys(scores).forEach(candidateId => {
    const percentage = maxScores[candidateId] > 0
      ? Math.round((scores[candidateId] / maxScores[candidateId]) * 100)
      : 0
    results.push({
      candidateId,
      score: scores[candidateId],
      maxScore: maxScores[candidateId],
      percentage
    })
  })

  return results
})

function sectorLabel(sector) {
  const key = normalizeSector(sector)
  if (!key) return ''
  const translated = $t(`measure_sectors.${key}.title`)
  return translated === `measure_sectors.${key}.title` ? key : translated
}

// Get sector icon from imported images
function getSectorIcon(sectorKey) {
  const key = normalizeSector(sectorKey)
  return key ? sectorImages[key] || null : null
}

// Calculate sector agreement scores for each candidate
const sectorAgreements = computed(() => {
  const sectorScores = {}

  // Group candidate answers by candidate
  const candidateAnswersByCandidate = {}
  props.candidateAnswers.forEach(ans => {
    const candidateId = typeof ans.candidate === 'object' ? ans.candidate.id : ans.candidate
    if (!candidateAnswersByCandidate[candidateId]) {
      candidateAnswersByCandidate[candidateId] = {}
    }
    const questionId = typeof ans.question === 'object' ? ans.question.id : ans.question
    candidateAnswersByCandidate[candidateId][questionId] = {
      response: ans.response,
      explanation: ans.explanation
    }
  })

  // Group questions by sector
  const questionsBySector = {}
  props.questions.forEach(q => {
    const sector = normalizeSector(q.sector)
    if (!sector) return
    if (!questionsBySector[sector]) {
      questionsBySector[sector] = []
    }
    questionsBySector[sector].push(q)
  })

  // Calculate sector scores for each candidate
  Object.keys(candidateAnswersByCandidate).forEach(candidateId => {
    sectorScores[candidateId] = {}

    Object.keys(questionsBySector).forEach(sector => {
      let sectorScore = 0
      let sectorMaxScore = 0

      questionsBySector[sector].forEach(q => {
        const questionId = q.id
        const userResponse = props.userAnswers[questionId]

        // Skip if user didn't answer
        if (userResponse === undefined || userResponse === null) return

        const isDoubleWeighted = props.doubleWeightedQuestions.has(questionId)
        const weight = isDoubleWeighted ? 2 : 1

        const candidateAnswer = candidateAnswersByCandidate[candidateId][questionId]

        if (candidateAnswer && candidateAnswer.response !== null && candidateAnswer.response !== undefined) {
          const score = calculateWahlcheckQuestionScore(userResponse, candidateAnswer.response, weight)
          if (!score) return

          sectorScore += score.points
          sectorMaxScore += score.maxPoints
        }
      })

      const percentage = sectorMaxScore > 0 ? Math.round((sectorScore / sectorMaxScore) * 100) : 0
      sectorScores[candidateId][sector] = {
        score: sectorScore,
        maxScore: sectorMaxScore,
        percentage,
        sector: sector  // Store the normalized sector key
      }
    })
  })

  return sectorScores
})

// Get sector with highest or lowest agreement for a candidate
function getSectorAgreement(candidateId, type = 'highest') {
  const candidateSectors = sectorAgreements.value[candidateId]

  if (!candidateSectors || Object.keys(candidateSectors).length === 0) {
    return null
  }

  // Filter out sectors with 0 maxScore (no questions answered)
  const validSectors = Object.values(candidateSectors).filter(s => s.maxScore > 0)

  if (validSectors.length === 0) {
    return null
  }

  // Sort by percentage
  validSectors.sort((a, b) => {
    // If percentages are equal, use maxScore as tiebreaker (higher relevance)
    if (a.percentage === b.percentage) {
      return type === 'highest' ? b.maxScore - a.maxScore : a.maxScore - b.maxScore
    }
    return type === 'highest' ? b.percentage - a.percentage : a.percentage - b.percentage
  })

  const selected = validSectors[0]
  const sectorKey = normalizeSector(selected.sector)
  if (!sectorKey) return null
  const label = sectorLabel(sectorKey)
  return {
    percentage: selected.percentage,
    sector: label,
    sectorRaw: sectorKey,  // Raw sector key for icon lookup
    score: selected.score,
    maxScore: selected.maxScore
  }
}

function hasSectorAgreement(candidateId) {
  return Boolean(
    hasMultipleQuestionSectors.value &&
    getSectorAgreement(candidateId, 'highest') &&
    getSectorAgreement(candidateId, 'lowest')
  )
}

// Sorted results by percentage (descending)
const sortedResults = computed(() => {
  return [...results.value].sort((a, b) => b.percentage - a.percentage)
})

// Toggle expand
function toggleExpand(candidateId) {
  expandedCandidate.value = expandedCandidate.value === candidateId ? null : candidateId
}

// Encode answers and double-weighted questions for sharing
function encodeShareableData() {
  try {
    // Convert Set to Array for JSON serialization
    const doubleWeightedArray = Array.from(props.doubleWeightedQuestions)

    const shareData = {
      answers: props.userAnswers,
      doubleWeighted: doubleWeightedArray,
      electionId: props.election.id,
      timestamp: new Date().toISOString()
    }

    // Convert to JSON and encode as base64
    const jsonString = JSON.stringify(shareData)
    const encoded = btoa(encodeURIComponent(jsonString))

    return encoded
  } catch (error) {
    console.error('Error encoding shareable data:', error)
    return null
  }
}

// Generate shareable URL
function generateShareableUrl() {
  const encodedData = encodeShareableData()
  if (!encodedData) return null

  // Get current URL and add share parameter
  const currentUrl = window.location.href.split('?')[0]
  return `${currentUrl}?share=${encodedData}`
}

// Copy shareable link to clipboard
function copyShareableLink() {
  const url = generateShareableUrl()
  if (!url) {
    alert($t('elections.wahlcheck.results.share.create_error'))
    return
  }

  // Copy to clipboard
  navigator.clipboard.writeText(url).then(() => {
    alert($t('elections.wahlcheck.results.share.copied'))
  }).catch(err => {
    console.error('Error copying share link:', err)
    alert($t('elections.wahlcheck.results.share.copy_error'))
  })
}

// Decode shareable data from URL (for future use)
function decodeShareableData(encodedString) {
  try {
    const decoded = decodeURIComponent(atob(encodedString))
    return JSON.parse(decoded)
  } catch (error) {
    console.error('Error decoding shareable data:', error)
    return null
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

/* Animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in-up {
  animation: fadeInUp 0.6s ease-out forwards;
}

.animation-delay-0 { animation-delay: 0ms; }
.animation-delay-1 { animation-delay: 100ms; }
.animation-delay-2 { animation-delay: 200ms; }
.animation-delay-3 { animation-delay: 300ms; }
.animation-delay-4 { animation-delay: 400ms; }
.animation-delay-5 { animation-delay: 500ms; }
.animation-delay-6 { animation-delay: 600ms; }
.animation-delay-7 { animation-delay: 700ms; }
.animation-delay-8 { animation-delay: 800ms; }
.animation-delay-9 { animation-delay: 900ms; }

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
