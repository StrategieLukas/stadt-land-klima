import {defineHook} from '@directus/extensions-sdk';

export default defineHook(({ action }, { services }) => {
  municipalityUpdateHook(action, services);
});

export function municipalityUpdateHook(action, services) {
  action('municipalities.items.update', async (context, {schema, database}) => {
    const {population} = context.payload;
    if (!population) return;

    let municipalityType = determineType(population);
    console.log('Setting municipality type to ' + municipalityType + ' for ' + context.keys[0] + '...');

    const {ItemsService} = services;
    const itemsService = new ItemsService('municipalities', {schema, knex: database});


    await itemsService.updateOne(context.keys[0], {
      municipality_type: municipalityType
    });
  });
}

function determineType(population) {
  let municipalityType = 'Kleinstadt';
  if (population >= 100000) {
    municipalityType = 'Großstadt';
  } else if (population >= 20000) {
    municipalityType = 'Mittelstadt';
  }
  return municipalityType;
}
