export default {
  id: "operation-add-editor",
  name: "Add Editor",
  icon: "box",
  description: "This adds an Editor",
  overview: ({ email, localteam_id }) => [
    {
      label: "Email",
      text: email,
    },
    {
      label: "Localteam ID",
      text: localteam_id,
    },
  ],
  options: [
    {
      field: "email",
      name: "Email",
      type: "string",
      meta: {
        width: "halft",
        interface: "input",
      },
    },
    {
      field: "localteam_id",
      name: "Localteam ID",
      type: "string",
      meta: {
        width: "half",
      },
    },
  ],
};
