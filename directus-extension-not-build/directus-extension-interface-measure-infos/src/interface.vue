<template>
  <div class="measure-preview">
    <div v-if="!measureId">
      <em>No measure selected</em>
    </div>

    <div v-else-if="loading">
      Loading...
    </div>

    <div v-else-if="error">
      <strong>Error:</strong> {{ error }}
    </div>

    <div v-else>
      <div v-for="field in displayFields" :key="field">
        <h4>{{ fieldLabels[field] }}</h4>
        <div v-html="measureData[field]" class="wysiwyg-preview"></div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: { type: [String, Number], default: null }, // value of this field, not used
    item: { type: Object, default: () => ({}) }       // entire current record
  },
  data() {
    return {
      measureId: null,
      measureData: {},
      loading: false,
      error: null,
      displayFields: [
        "description_about",
        "description_evaluation_criteria",
        "description_verification"
      ],
      fieldLabels: {
        description_about: "About the Measure",
        description_evaluation_criteria: "Evaluation Criteria",
        description_verification: "Verification"
      }
    };
  },
  watch: {
    item: {
      immediate: true,
      handler(newItem) {
        console.log("[MeasurePreview] Item changed:", newItem);
        if (newItem && newItem.measure_id) {
          this.measureId = newItem.measure_id;
          this.fetchMeasure(newItem.measure_id);
        } else {
          this.measureId = null;
          this.measureData = {};
        }
      }
    }
  },
  methods: {
    async fetchMeasure(id) {
      this.loading = true;
      this.error = null;

      try {
        console.log("[MeasurePreview] Fetching measure ID:", id);
        console.log(`/items/measures/${id}?fields=${this.displayFields.join(',')}`);
        const res = await fetch(`/items/measures/${id}?fields=${this.displayFields.join(',')}`);
        const data = await res.json();

        if (data && data.data) {
          this.measureData = data.data;
          console.log("[MeasurePreview] Fetched measure data:", this.measureData);
        } else {
          this.measureData = {};
          console.warn("[MeasurePreview] No data returned for measure ID", id);
        }
      } catch (err) {
        console.error("[MeasurePreview] Error fetching measure:", err);
        this.error = err.message || "Unknown error";
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.measure-preview {
  padding: 0.5rem;
}

.wysiwyg-preview {
  border: 1px solid #e2e8f0;
  border-radius: 0.25rem;
  padding: 0.5rem;
  margin-bottom: 1rem;
  background-color: #f9fafb;
}
</style>
