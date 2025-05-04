<template>
  <div class="max-w-screen-xl mx-auto text-center mb-8">
      <p class="mb-4">
        Du kannst uns auch unterstützen, indem du unseren Kanälen folgst und unsere Beiträge teilst:
      </p>
      <div class="flex justify-center items-center gap-6">
        <a href="https://instagram.com" target="_blank" aria-label="Instagram">
          <img src="~/assets/icons/icon_instagram.svg" alt="Instagram" class="h-12 w-12" />
        </a>
        <a href="https://linkedin.com" target="_blank" aria-label="LinkedIn">
          <img src="~/assets/icons/icon_linkedin.svg" alt="LinkedIn" class="h-12 w-12" />
        </a>
      </div>
    </div>

  <footer class="bg-olive-green text-white px-4 pt-0 pb-20">
    <div class="max-w-screen-xl mx-auto grid grid-cols-4 gap-8 border-t border-white/30 pt-8 text-left text-white">
      <!-- Column 1 -->
      <ul class="space-y-5">
        <li><NuxtLink to="/suche-plz">Suche (nach PLZ oder Ort)</NuxtLink></li>
        <li><NuxtLink to="/suche">Suche (allgemein)</NuxtLink></li>
        <li><NuxtLink to="/login">Login</NuxtLink></li>
      </ul>

      <!-- Column 2 -->
      <ul class="space-y-5 border-l border-white/30 pl-4">
        <li><NuxtLink to="/projekt">Projekt | Über uns</NuxtLink></li>
        <li><NuxtLink to="/ranking">Ranking</NuxtLink></li>
        <li><NuxtLink to="/erfolgsprojekte">Erfolgsprojekte</NuxtLink></li>
        <li><NuxtLink to="/mitmachen">Mitmachen</NuxtLink></li>
        <li><NuxtLink to="/kontakt">Kontakt</NuxtLink></li>
      </ul>

      <!-- Column 3 -->
      <ul class="space-y-5 border-l border-white/30 pl-4">
        <li><NuxtLink to="/verein">Verein</NuxtLink></li>
        <li><NuxtLink to="/code-of-conduct">Code of Conduct</NuxtLink></li>
        <li><NuxtLink to="/netzwerk">Netzwerk</NuxtLink></li>
        <li><NuxtLink to="/spenden">Spenden statt schenken</NuxtLink></li>
        <li class="mt-4">
          <DonateButton />
        </li>
      </ul>

      <!-- Column 4 -->
      <ul class="space-y-5 border-l border-white/30 pl-4">
        <li><NuxtLink to="/downloads">Downloads</NuxtLink></li>
        <li><NuxtLink to="/patchnotes">Patchnotes</NuxtLink></li>
        <li><NuxtLink to="/impressum">Impressum</NuxtLink></li>
        <li><NuxtLink to="/datenschutz">Datenschutz</NuxtLink></li>
      </ul>
    </div>
  </footer>
</template>