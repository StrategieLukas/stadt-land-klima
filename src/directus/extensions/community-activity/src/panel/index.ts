import { definePanel } from '@directus/extensions-sdk';
import PanelComponent from './panel.vue';

export default definePanel({
  id: 'community-activity',
  name: 'Community Activity',
  icon: 'monitoring',
  description: 'Shows actionable Lokalteam activity, stalling, outliers, and catalog adoption.',
  component: PanelComponent,
  options: [
    {
      field: 'defaultDays',
      name: 'Default time window',
      type: 'integer',
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: {
          choices: [
            { text: '30 days', value: 30 },
            { text: '90 days', value: 90 },
            { text: '180 days', value: 180 },
            { text: '365 days', value: 365 },
          ],
        },
      },
      schema: {
        default_value: 30,
      },
    },
  ],
  minWidth: 24,
  minHeight: 18,
});
