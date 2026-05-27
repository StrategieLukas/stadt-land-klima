export default {
  id: "delete-editor",
  name: "delete Editor",
  icon: "box",
  description: "This deletes the user for the correspond keys from the editor",
  overview: ({ keys }: { keys: string | string[] }) => [
    {
      label: "Keys",
      text: Array.isArray(keys) ? keys.join(', ') : keys,
    },
  ],
  options: [
    {
      field: "keys",
      name: "LokalteamMitglied Keys",
      type: "json",
      meta: {
        width: "full",
        interface: "input",
      },
    },
  ],
};
