
export default {
	id: 'operation-calculateScores',
	handler: async({ keys },  { env, logger, accountability, services, getSchema }) => {
		const { ItemsService } = services;
		console.log("keys") 
		console.log("accOunt",accountability) 
		console.log("services",services) 
		console.log("ItemsService",ItemsService) 
		return{
			
			/* text: slugify(text, {
				replacement: '-',  // replace spaces with replacement character, defaults to `-`
				remove: undefined, // remove characters that match regex, defaults to `undefined`
				lower: true,      // convert to lower case, defaults to `false`
				strict: true,     // strip special characters except replacement, defaults to `false`
				locale: 'de',      // language code of the locale to use
				trim: true         // trim leading and trailing replacement chars, defaults to `true`
			  }) */
		}
	},
};
