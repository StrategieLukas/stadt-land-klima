<template>
  <div class="max-w-4xl mx-auto px-4 py-8 pb-16">
    <h1 class="text-h1 font-bold text-center mb-8">Unsere Organisation</h1>

    <!-- Bubble diagram -->
    <div class="flex justify-center items-center">
      <div class="diagram">
        <!-- Steuerkreis (yellow, center) -->
        <button
          class="bubble steuerkreis"
          :class="{ active: activeGroup === 'steuerkreis' }"
          @click="open('steuerkreis')"
          aria-label="Steuerkreis"
        >
          <span class="bubble-label">Steuerkreis</span>

          <!-- Vorstand inside Steuerkreis -->
          <button
            class="bubble vorstand"
            :class="{ active: activeGroup === 'vorstand' }"
            @click.stop="open('vorstand')"
            aria-label="Vereinsvorstand"
          >
            <span class="bubble-label">Vereins-<br>vorstand</span>
          </button>
        </button>

        <!-- Technik & IT (lime green, top-left) -->
        <button
          class="bubble technik"
          :class="{ active: activeGroup === 'technik' }"
          @click="open('technik')"
          aria-label="Technik & IT"
        >
          <span class="bubble-label">Technik &amp; IT</span>
        </button>

        <!-- Lokalteams (dark green, top-right) -->
        <button
          class="bubble lokalteams"
          :class="{ active: activeGroup === 'lokalteams' }"
          @click="open('lokalteams')"
          aria-label="Lokalteams / Netzwerk"
        >
          <span class="bubble-label">Lokalteams/<br>Netzwerk</span>
        </button>

        <!-- Maßnahmen (blue, bottom-left) -->
        <button
          class="bubble massnahmen"
          :class="{ active: activeGroup === 'massnahmen' }"
          @click="open('massnahmen')"
          aria-label="Maßnahmen"
        >
          <span class="bubble-label">Maßnahmen</span>
        </button>

        <!-- Kommunikation (orange, bottom-right) -->
        <button
          class="bubble kommunikation"
          :class="{ active: activeGroup === 'kommunikation' }"
          @click="open('kommunikation')"
          aria-label="Kommunikation"
        >
          <span class="bubble-label">Kommunikation<br>Öffentlichkeits-<br>Pressearbeit</span>
        </button>
      </div>
    </div>

    <!-- DaisyUI modal -->
    <dialog ref="modalRef" class="modal">
      <div class="modal-box max-w-lg">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>

        <h2 class="text-h2 font-bold mb-4 pr-8">{{ currentGroup?.title }}</h2>

        <!-- Portrait icons -->
        <div class="flex flex-wrap gap-4 mb-6">
          <div
            v-for="person in currentGroup?.people"
            :key="person.name"
            class="flex flex-col items-center gap-1"
          >
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white shadow"
              :style="{ background: currentGroup?.color }"
            >
              {{ initials(person.name) }}
            </div>
            <span class="text-xs text-center text-gray max-w-[60px]">{{ person.name }}</span>
          </div>
        </div>

        <!-- Content sections -->
        <div class="space-y-3">
          <template v-for="section in currentGroup?.sections" :key="section.heading">
            <h3 v-if="section.heading" class="font-bold text-base mt-4">{{ section.heading }}</h3>
            <p class="text-sm leading-relaxed text-gray">{{ section.text }}</p>
          </template>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup>
useHead({ title: 'Organisation' })

const activeGroup = ref(null)
const modalRef = ref(null)

const groups = {
  steuerkreis: {
    title: 'Steuerkreis',
    color: '#ffc80c',
    people: [
      { name: 'Anna Müller' },
      { name: 'Ben Schmidt' },
      { name: 'Clara Weber' },
    ],
    sections: [
      {
        heading: 'Was wir tun',
        text: 'Der Steuerkreis koordiniert die strategische Ausrichtung von Stadt-Land-Klima. Er bringt alle Arbeitsgruppen zusammen, setzt Prioritäten und sorgt für eine kohärente Gesamtstrategie.',
      },
      {
        heading: 'Wie du mitmachen kannst',
        text: 'Interessierte können an offenen Steuerkreis-Treffen teilnehmen. Schreib uns eine Nachricht über das Kontaktformular, um mehr zu erfahren.',
      },
    ],
  },
  vorstand: {
    title: 'Vereinsvorstand',
    color: '#9D9D9C',
    people: [
      { name: 'Dieter Braun' },
      { name: 'Eva Hoffmann' },
    ],
    sections: [
      {
        heading: 'Was wir tun',
        text: 'Der Vereinsvorstand trägt die rechtliche und finanzielle Verantwortung für den Verein. Er vertritt Stadt-Land-Klima nach außen und stellt sicher, dass alle Aktivitäten im Einklang mit der Satzung stehen.',
      },
      {
        heading: 'Wie du mitmachen kannst',
        text: 'Vorstandsmitglieder werden auf der jährlichen Mitgliederversammlung gewählt. Wenn du Interesse hast, melde dich gerne bei uns.',
      },
    ],
  },
  technik: {
    title: 'Technik & IT',
    color: '#AFCA0B',
    people: [
      { name: 'Felix Kern' },
      { name: 'Greta Lenz' },
    ],
    sections: [
      {
        heading: 'Was wir tun',
        text: 'Die Technik & IT-Gruppe entwickelt und betreibt die digitale Infrastruktur von Stadt-Land-Klima – von der Website über Datenbanken bis hin zu internen Tools.',
      },
      {
        heading: 'Wie du mitmachen kannst',
        text: 'Wenn du Erfahrung in Webentwicklung, DevOps oder Datenbankadministration hast, freuen wir uns über deine Unterstützung. Melde dich über unser Kontaktformular.',
      },
    ],
  },
  lokalteams: {
    title: 'Lokalteams / Netzwerk',
    color: '#339737',
    people: [
      { name: 'Hanna Vogel' },
      { name: 'Ingo Bauer' },
      { name: 'Jana Koch' },
    ],
    sections: [
      {
        heading: 'Was wir tun',
        text: 'Die Lokalteams sind das Herzstück von Stadt-Land-Klima. Sie arbeiten vor Ort in Kommunen, vernetzen lokale Akteure und setzen Klimaschutzmaßnahmen direkt um.',
      },
      {
        heading: 'Wie du mitmachen kannst',
        text: 'Schau auf der Karte nach, ob es ein Lokalteam in deiner Nähe gibt, oder gründe selbst eines. Wir unterstützen dich mit Materialien und Vernetzung.',
      },
    ],
  },
  massnahmen: {
    title: 'Maßnahmen',
    color: '#16bae7',
    people: [
      { name: 'Karl Fischer' },
      { name: 'Lisa Neumann' },
    ],
    sections: [
      {
        heading: 'Was wir tun',
        text: 'Die Maßnahmen-Gruppe entwickelt und pflegt den Katalog konkreter Klimaschutzmaßnahmen für Kommunen. Sie bewertet Wirksamkeit, Umsetzbarkeit und Kosten.',
      },
      {
        heading: 'Wie du mitmachen kannst',
        text: 'Hast du Expertise in Klimaschutz, Stadtplanung oder Energiewende? Dann bring dein Wissen ein und hilf uns, den Maßnahmenkatalog weiterzuentwickeln.',
      },
    ],
  },
  kommunikation: {
    title: 'Kommunikation & Öffentlichkeitsarbeit',
    color: '#f39200',
    people: [
      { name: 'Max Richter' },
      { name: 'Nina Schulz' },
    ],
    sections: [
      {
        heading: 'Was wir tun',
        text: 'Die Kommunikationsgruppe verantwortet die Außendarstellung von Stadt-Land-Klima: Social Media, Pressemitteilungen, Newsletter und Öffentlichkeitskampagnen.',
      },
      {
        heading: 'Wie du mitmachen kannst',
        text: 'Wenn du Erfahrung in Kommunikation, Journalismus oder Social Media hast, freuen wir uns über deine Mitarbeit. Melde dich über unser Kontaktformular.',
      },
    ],
  },
}

const currentGroup = computed(() => activeGroup.value ? groups[activeGroup.value] : null)

function open(key) {
  activeGroup.value = key
  nextTick(() => {
    modalRef.value?.showModal()
  })
}

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase()
}
</script>

<style scoped>
/* ── Diagram ── */
.diagram {
  position: relative;
  width: 480px;
  height: 420px;
}

/* Base bubble styles */
.bubble {
  position: absolute;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1.25;
  padding: 0;
  transition: filter 0.15s ease, transform 0.15s ease;
  color: #1a1a1a;
}

.bubble:hover {
  filter: brightness(1.08);
  transform: scale(1.04);
}

.bubble.active {
  filter: brightness(0.92);
}

.bubble-label {
  pointer-events: none;
  padding: 0.5rem;
}

/* Steuerkreis — yellow, center */
.steuerkreis {
  width: 200px;
  height: 200px;
  background: #ffc80c;
  top: 110px;
  left: 140px;
  z-index: 2;
  align-items: flex-start;
  padding-top: 1rem;
}

/* Vorstand — grey, small, inside Steuerkreis */
.vorstand {
  position: absolute;
  width: 80px;
  height: 80px;
  background: #D0D0D0;
  top: 110px;
  left: 110px;
  z-index: 10;
  font-size: 0.65rem;
  transform: none;
}

.vorstand:hover {
  filter: brightness(1.08);
  transform: scale(1.06);
}

/* Technik & IT — lime green, top-left */
.technik {
  width: 175px;
  height: 175px;
  background: #AFCA0B;
  top: 40px;
  left: 40px;
  z-index: 1;
}

/* Lokalteams — dark green, top-right */
.lokalteams {
  width: 155px;
  height: 155px;
  background: #339737;
  top: 10px;
  left: 270px;
  z-index: 1;
  color: #fff;
}

/* Maßnahmen — light blue, bottom-left */
.massnahmen {
  width: 175px;
  height: 175px;
  background: #16bae7;
  top: 230px;
  left: 20px;
  z-index: 1;
}

/* Kommunikation — orange, bottom-right */
.kommunikation {
  width: 165px;
  height: 165px;
  background: #f39200;
  top: 240px;
  left: 270px;
  z-index: 1;
  font-size: 0.8rem;
}

/* ── Responsive ── */
@media (max-width: 540px) {
  .diagram {
    width: 320px;
    height: 290px;
  }

  .steuerkreis {
    width: 135px;
    height: 135px;
    top: 75px;
    left: 93px;
  }

  .vorstand {
    width: 55px;
    height: 55px;
    top: 74px;
    left: 74px;
    font-size: 0.55rem;
  }

  .technik {
    width: 118px;
    height: 118px;
    top: 27px;
    left: 27px;
  }

  .lokalteams {
    width: 104px;
    height: 104px;
    top: 7px;
    left: 181px;
  }

  .massnahmen {
    width: 118px;
    height: 118px;
    top: 155px;
    left: 13px;
  }

  .kommunikation {
    width: 110px;
    height: 110px;
    top: 161px;
    left: 181px;
    font-size: 0.6rem;
  }

  .bubble {
    font-size: 0.72rem;
  }
}
</style>
