export default {
  id: "operation-add-editor",
  name: "Add Editor",
  // Use a more descriptive icon — "person_add" better represents inviting a user.
  icon: "person_add",
  description: "Invites a new editor to a localteam, or validates an existing user's role.",
  overview: ({ email, localteam_id }: { email: string; localteam_id: string }) => [
    {
      label: "Email",
      text: email ?? "—",
    },
    {
      label: "Localteam ID",
      text: localteam_id ?? "—",
    },
  ],
  options: [
    {
      field: "email",
      name: "Email",
      type: "string",
      meta: {
        width: "half",
        interface: "input",
        options: {
          placeholder: "editor@example.com",
        },
        required: true,
      },
    },
    {
      field: "localteam_id",
      name: "Localteam ID",
      type: "string",
      meta: {
        width: "half",
        interface: "input",
        options: {
          placeholder: "UUID of the localteam",
        },
        required: true,
      },
    },
  ],
};
