export default {
  id: "operation-slugify",
  name: "Slugify",
  icon: "box",
  description: "This slugify a string!",
  overview: ({ text }) => [
    {
      label: "Text",
      text: text,
    },
  ],
  options: [
    {
      field: "text",
      name: "Text",
      type: "string",
      meta: {
        width: "full",
        interface: "input",
      },
    },
  ],
};
