<template>
  <section class="w-full text-left">
    <div class="grid grid-cols-1 gap-x-10 gap-y-6 xs:grid-cols-2 sm:grid-cols-3">
      <div>
        <h2 class="mb-2 text-sm font-bold text-white">{{ $t("footer.legal.address_heading") }}</h2>
        <address class="text-sm leading-relaxed whitespace-pre-line text-rating-4-very-light not-italic">
          {{ $t("footer.legal.address") }}
        </address>
      </div>

      <div>
        <h3 class="mb-2 text-sm font-bold text-white">{{ $t("footer.legal.represented_by_heading") }}</h3>
        <p class="text-sm leading-relaxed whitespace-pre-line text-rating-4-very-light">
          {{ $t("footer.legal.represented_by") }}
        </p>
      </div>

      <div>
        <h3 class="mb-2 text-sm font-bold text-white">{{ $t("footer.legal.bank_heading") }}</h3>
        <p class="text-sm leading-relaxed wrap-break-word whitespace-pre-line text-rating-4-very-light">
          {{ $t("footer.legal.bank_details") }}
        </p>
      </div>
    </div>
  </section>
</template>
