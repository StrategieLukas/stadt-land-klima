export default {
  id: "delete-editor",
  name: "Delete Editor",
  // "person_remove" is a clearer icon for this destructive action.
  icon: "person_remove",
  description: "Deletes the Directus user accounts linked to the given editor record keys.",
  overview: ({ keys }: { keys: string | string[] }) => {
    const keyList = Array.isArray(keys) ? keys : keys ? [keys] : [];
    return [
      {
        label: "Editor Keys",
        text: keyList.length > 0 ? keyList.join(", ") : "—",
      },
      {
        label: "Count",
        text: String(keyList.length),
      },
    ];
  },
  options: [
    {
      field: "keys",
      name: "Editor Keys",
      type: "json",
      meta: {
        width: "full",
        interface: "input",
        note: "Provide a JSON array of editor record IDs to delete, e.g. [\"uuid-1\", \"uuid-2\"]",
        required: true,
      },
    },
  ],
};
