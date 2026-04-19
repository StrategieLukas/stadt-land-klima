import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './ElectionActionsInterface.vue';

export default defineInterface({
  id: 'interface-election-actions',
  name: 'Election Actions',
  icon: 'rocket_launch',
  description: 'Action buttons to generate questions and send candidate emails for this election.',
  component: InterfaceComponent,
  types: ['json'],
  recommendedDisplays: [],
  options: [],
});
