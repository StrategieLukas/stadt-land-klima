export default {
  id: 'measure-preview',
  name: 'Measure Preview',
  icon: 'info',
  description: 'Displays selected measure fields inline in ratings_measures',
  types: ['string'], // The field type this interface can be attached to
  options: [
    {
      field: 'fields_to_display',
      type: 'json',
      name: 'Fields to Display',
      meta: {
        width: 'full',
        note: 'Comma-separated list of fields from the measure to display',
      },
      schema: {
        default_value: ['description_about', 'description_evaluation_criteria', 'description_verification'], // <- adjust to your real field names
      },
    },
    {
      field: 'measure_field',
      type: 'string',
      name: 'Measure Reference Field',
      meta: {
        width: 'full',
        note: 'The field in this collection that relates to measures (usually measure_id)',
      },
      schema: {
        default_value: 'measure_id',
      },
    },
  ],
};
