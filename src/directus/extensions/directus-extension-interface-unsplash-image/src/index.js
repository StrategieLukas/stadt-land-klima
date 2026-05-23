import InterfaceComponent from './interface.vue';

export default {
  id: 'unsplash-image',
  name: 'Unsplash Image',
  icon: 'image_search',
  description: 'Image field with Unsplash search and local file upload',
  component: InterfaceComponent,
  types: ['uuid'],
  group: 'relational',
  options: [
    {
      field: 'folder',
      name: 'Upload Folder',
      type: 'string',
      meta: {
        interface: 'system-folder',
        width: 'half',
        note: 'Target folder for newly imported/uploaded files',
      },
    },
    {
      field: 'letterbox',
      name: 'Letterbox',
      type: 'boolean',
      meta: {
        interface: 'boolean',
        width: 'half',
      },
      schema: {
        default_value: false,
      },
    },
    {
      field: 'creditsField',
      name: 'Credits Field',
      type: 'string',
      meta: {
        interface: 'input',
        width: 'half',
        note: 'Sibling field to write Unsplash photo credits to (e.g. image_credits)',
      },
      schema: {
        default_value: 'image_credits',
      },
    },
  ],
};
