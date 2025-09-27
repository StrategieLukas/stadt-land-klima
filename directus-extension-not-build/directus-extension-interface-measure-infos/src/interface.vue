<template>
  <div class="measure-preview">
    <!-- Link to Frontend -->
    <div v-if="measureData.slug && measureData.sector" class="measure-link">
      <a
        :href="`https://stadt-land-klima.de/measures/sectors/${measureData.sector}#measure-${measureData.slug}`"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ $t('directus.fields.view_measure_on_frontend') }}
      </a>
    </div>

    <div v-if="!measureId" class="v-notice info">
      <v-icon name="info" />
      <div class="content">
        <div class="title">{{ $t('directus.interfaces.no_measure_found_error') }}</div>
      </div>
    </div>

    <div v-else-if="loading" class="loading-container">
      <v-progress-circular indeterminate />
      <span class="loading-text">{{ $t('generic.loading') }}</span>
    </div>

    <div v-else-if="error" class="v-notice danger">
      <v-icon name="error" />
      <div class="content">
        <div class="title">{{ $t('error') }}</div>
        <div class="text">{{ error }}</div>
      </div>
    </div>

    <div v-else-if="hasMeasureData" class="measure-content">
      <div v-for="fieldKey in fieldsToDisplay" :key="fieldKey" class="field-preview">
        <div class="field-header">
          <v-icon name="info" small />
          <span class="field-label">{{ getFieldLabel(fieldKey) }}</span>
        </div>
        <div v-if="measureData[fieldKey]" class="field-content" v-html="measureData[fieldKey]"></div>
        <div v-else class="field-content empty">{{ $t('no_content_available') }}</div>
      </div>
    </div>

    <div v-else class="v-notice warning">
      <v-icon name="warning" />
      <div class="content">
        <div class="title">{{ $t('no_measure_data_available') }}</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MeasurePreview',
  inject: ['api', '$trans'],
  props: {
    value: { default: null },
    field: { type: String, required: true },
    collection: { type: String, required: true },
    primaryKey: { type: [String, Number], default: null },
    measure_field: { type: String, default: 'measure_id' },
    fields_to_display: {
      type: Array,
      default: () => ['description_about', 'description_evaluation_criteria', 'description_verification'],
    },
  },
  data() {
    return {
      measureId: null,
      measureData: {},
      loading: false,
      error: null,
      fieldsToDisplay: [],
    };
  },
  computed: {
    measureField() {
      return this.measure_field || 'measure_id';
    },
    hasMeasureData() {
      return this.measureData && Object.keys(this.measureData).length > 0;
    },
  },
  watch: {
    primaryKey: { immediate: true, handler() { this.ensureMeasureLoaded(); } },
    value() { this.ensureMeasureLoaded(); },
    options: { deep: true, handler() { this.ensureMeasureLoaded(); } },
  },
  mounted() {
    this.fieldsToDisplay = this.fields_to_display;
    this.ensureMeasureLoaded();
  },
  methods: {
    async ensureMeasureLoaded() {
      const measureField = (this.options && this.options.measure_field) || this.measure_field || 'measure_id';
      const pk = this.primaryKey ?? null;
      const boundValue = this.value ?? null;

      if (pk && pk !== '+') {
        if (this.field === measureField) {
          const measureId = boundValue || this.value || null;
          if (measureId) await this.fetchMeasure(measureId);
          else { this.measureData = {}; this.measureId = null; }
        } else {
          try {
            const resp = await this.api.get(`/items/${this.collection}/${pk}`);
            const item = resp?.data?.data || {};
            const measureId = item[measureField] ?? null;
            if (measureId) { this.measureId = measureId; await this.fetchMeasure(measureId); }
            else { this.measureData = {}; this.measureId = null; }
          } catch (err) {
            console.error('[MeasurePreview] Error fetching parent item:', err);
            this.measureData = {}; this.measureId = null;
          }
        }
        return;
      }

      if (this.field === measureField) {
        const measureId = boundValue || null;
        if (measureId) { this.measureId = measureId; await this.fetchMeasure(measureId); }
        else { this.measureData = {}; this.measureId = null; }
        return;
      }

      this.measureData = {}; this.measureId = null;
    },

    async fetchMeasure(id) {
      if (!id || !this.api) return;
      this.loading = true; this.error = null;
      try {
        const response = await this.api.get(`/items/measures/${id}`, {
          params: { fields: [...this.fieldsToDisplay, 'sector', 'slug'].join(',') },
        });
        this.measureData = response?.data?.data || {};
      } catch (err) {
        console.error('[MeasurePreview] Error fetching measure:', err);
        this.error = err?.message || 'Failed to fetch measure';
        this.measureData = {};
      } finally { this.loading = false; }
    },

    getFieldLabel(fieldKey) {
    // Fetch special translations that I entered to mirror the field name translations
    const translation = this.$t(`ratings_measures.fields.${fieldKey}`);
    if (translation && translation !== `ratings_measures.fields.${fieldKey}`) {
      return translation;
    }

    // Fallback: just print the prettified field key
    return fieldKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  },
  },
};
</script>

<style scoped>
.measure-preview { --v-notice-padding: 12px 16px; }
.measure-content { display:flex; flex-direction:column; gap:16px; }
.field-preview { background-color:var(--theme--background-subdued); border:1px solid var(--theme--border-color-subdued); border-radius:var(--theme--border-radius); padding:12px 16px; transition:border-color var(--fast) var(--transition); }
.field-preview:hover { border-color:var(--theme--border-color); }
.field-header { display:flex; align-items:center; gap:8px; margin-bottom:8px; color:var(--theme--foreground-subdued); }
.field-header .v-icon { --v-icon-color:var(--theme--primary); }
.field-label { font-weight:600; font-size:16px; color:var(--theme--foreground); }
.field-content { color:var(--theme--foreground); font-size:15px; line-height:1.6; }
.field-content.empty { color:var(--theme--foreground-subdued); font-style:italic; }
.field-content :deep(p) { margin:0 0 8px 0; }
.field-content :deep(p:last-child) { margin-bottom:0; }
.field-content :deep(ul), .field-content :deep(ol) { margin:8px 0; padding-left:20px; }
.field-content :deep(li) { margin-bottom:4px; }
.loading-container { display:flex; align-items:center; gap:12px; padding:16px; color:var(--theme--foreground-subdued); }
.loading-text { font-size:14px; }
.v-notice { --v-notice-margin:0; }
.measure-link { margin-top:16px; margin-bottom:8px; }
.measure-link a { color:var(--theme--primary); text-decoration:underline; font-weight:500; }
</style>
