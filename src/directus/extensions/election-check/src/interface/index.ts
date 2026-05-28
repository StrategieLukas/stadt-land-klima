import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './ElectionActionsInterface.vue';

export default defineInterface({
  id: 'interface-election-actions',
  name: 'Election Actions',
  icon: 'rocket_launch',
  description: 'Generate thesis questions and send candidate invitation emails for this election.',
  component: InterfaceComponent,
  // This interface is display-only; it never writes a value to the field.
  types: ['alias'],
  localTypes: ['presentation'],
  group: 'presentation',
  recommendedDisplays: [],
  options: [],
});
