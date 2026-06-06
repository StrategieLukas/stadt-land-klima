export default {
  id: 'operation-send-candidate-mails',
  name: 'Send Candidate Emails',
  icon: 'mail',
  description: 'Sends personalised email invitations to candidates with a secure, stable access link.',
  overview: ({ election_id }: { election_id?: string | number }) => [
    { label: 'Election ID', text: String(election_id ?? '(resolved from trigger)') },
  ],
  options: [
    {
      field: 'election_id',
      name: 'Election ID',
      type: 'string',
      meta: {
        width: 'full',
        interface: 'input',
        note: 'Leave blank to resolve from the flow trigger. Caller must be an administrator.',
      },
    },
  ],
};
