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
  options: [
    {
      field: 'generateFlowId',
      name: 'Generate Questions — Flow ID',
      type: 'string',
      meta: {
        width: 'full',
        interface: 'input',
        note: 'ID of the manual Directus flow that runs the "Generate Questions" operation. Find it in Settings → Flows → your flow → copy the ID from the URL.',
      },
    },
    {
      field: 'mailFlowId',
      name: 'Send Emails — Flow ID',
      type: 'string',
      meta: {
        width: 'full',
        interface: 'input',
        note: 'ID of the manual Directus flow that runs the "Send Candidate Emails" operation.',
      },
    },
  ],
});
