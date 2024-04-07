<template>
  <v-notice v-if="!choices" type="warning">No choices configured</v-notice>
  <div
    v-else
    class="radio-icon-buttons"
    :style="{
      '--v-radio-color': color,
    }"
  >
    <input
      :value="value"
      :field="field"
      :collection="collection"
      type="hidden"
      @input="handleChange($event.target.value, field)"
    />
    <button
      v-for="item in choices"
      :key="item.value"
      class="v-icon-radio block"
      type="button"
      :aria-pressed="isChecked(value, item.value) ? 'true' : 'false'"
      :disabled="disabled"
      :class="{ checked: isChecked(value, item.value), block }"
      @click="selectOption(item.value, field)"
    >
      <span class="label type-text">
        <span
          v--if="item.svg_icon"
          class="v-icon"
          v-html="item.svg_icon"
        ></span>
        <slot name="label">{{ item.text }}</slot>
      </span>
    </button>
  </div>
</template>

<script>
import useDirectusToken from "./use-directus-token";
import { nextTick } from "vue";
export default {
  inject: ["api"],
  props: {
    field: String,
    collection: String,
    value: String,
    disabled: {
      type: Boolean,
      default: false,
    },
    choices: {
      type: Array,
      default: null,
    },
    width: {
      type: String,
      default: null,
    },
  },
  emits: ["input"],
  mounted() {
    console.log(`BatchMode: ${this.batchMode}`);
    console.log(`Choices:`);
    console.log(this.choices);
  },
  methods: {
    selectOption(value, field) {
      if (field == this.field) {
        this.$emit("input", value);
        nextTick().then((result) => {
          this.$emit("setFieldValue", { field: "status", value: "published" });
        });
        //Vue.nextTick(() => this.$emit('setFieldValue', { field: 'status', value: 'published' })); //Known bug direcuts so this workaround
      }
    },
    isChecked(input, value) {
      return input == value;
    },
    renderImage(file_id, modified_on = new Date().toISOString()) {
      if (file_id === null) return;
      const { addTokenToURL } = useDirectusToken(this.api);
      return addTokenToURL(
        `/assets/${file_id}?width=42&height=42&fit=cover&cache-buster=${modified_on}`,
      );
    },
    handleChange(value, field) {
      //This is a fallback if anything outside of this interface changes the value.
      if (field == this.field) {
        console.log(`handleChange:`);
        this.$emit("input", value);
      }
    },
  },
};
</script>
<style lang="scss" scoped>
.radio-icon-buttons {
  --columns: 5;
  display: grid;
  grid-gap: 12px 32px;
  grid-template-columns: repeat(var(--columns), 1fr);

  @media (max-width: 600px) {
    --columns: 3;
  }
}

.v-icon-radio {
  display: flex;
  font-size: 0;
  text-align: center;
  background-color: transparent;
  border: none;
  border-radius: 0;
  appearance: none;
  & .v-icon {
    --v-icon-color: var(--theme--foreground-subdued);
    svg {
      width: 100%;
      height: 100%;
      fill: var(--theme--foreground-subdued);
    }
  }
  & > .v-icon {
    position: absolute;
    display: none;
  }
  & .label {
    display: block;
    width: 100%;
    & .v-icon {
      display: block;
      margin: 0 auto 3px;
      width: 42px;
      height: 42px;
      border: 2px solid transparent;
      border-radius: 50%;
      padding: 7px;
    }
  }
  &:not(.checked) {
    & .label {
      & .v-icon {
        border-color: transparent;
      }
    }
  }
  &:disabled {
    cursor: not-allowed;
    .label {
      color: var(--theme--foreground-subdued);
    }
    .v-icon {
      --v-icon-color: var(--theme--foreground-subdued);
    }
  }
  &.block {
    position: relative;
    width: 100%;
    height: auto;
    padding: 10px;
    border: 2px solid var(--border-normal);
    border-radius: var(--theme--border-radius);
    &:hover {
      border-color: var(--border-normal-alt);
    }
    &::before {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: var(--background-subdued);
      border-radius: var(--theme--border-radius);
      content: "";
    }
    .label {
      z-index: 1;
    }
  }
  &:not(:disabled):hover {
    .v-icon {
      --v-icon-color: var(--theme--foreground-subdued);
    }
  }
  &:not(:disabled).checked {
    .v-icon {
      --v-icon-color: var(--theme--primary);
      svg {
        fill: var(--theme--primary);
      }
    }
    &.block {
      border-color: var(--theme--primary);
      .label {
        color: var(--theme--primary);
      }
      &::before {
        background-color: var(--theme--primary);
        opacity: 0.1;
      }
    }
  }
}
</style>
