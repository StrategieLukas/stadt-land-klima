export default {
  id: 'operation-generate-questions',
  name: 'Generate Questions',
  icon: 'auto_awesome',
  description: 'Generates the top 10 theses for an election based on measure ratings and weightings.',
  overview: ({ election_id }) => [
    { label: 'Election ID', text: election_id || '(resolved from trigger)' },
  ],
  options: [
    {
      field: 'election_id',
      name: 'Election ID',
      type: 'string',
      meta: {
        width: 'full',
        interface: 'input',
        note: 'Leave blank to resolve from the flow trigger.',
      },
    },
  ],
};
