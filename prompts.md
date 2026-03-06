- please revamp the footer section by using the daisy ui footer #fetch https://daisyui.com/components/footer/
	- change the directus pages data model by not setting a footer_column_desktop but replacing this field with a generic page_category with some translation keys as values, e.g. municipality_rating, outreach_and_network, information_and_participate, structures_and_legal
	- the number of grid rows is then dynamically adjusted
	- please add a newsletter form to it, use the listmonk api for that. we then need a listmonk api composable and in the .env a user token and an listmonk endpoint (newsletter.stadt-land-klima.de)
	- in the end add the logo, the donate and login button and CC-BY-SA Copyright (c) 2023-2026 Stadt.Land.Klima! e.V. 
	
	
	
---

please fetch the blökkli docs #fetch https://docs.blokk.li/
please write an blökkli addapter for our setup #fetch https://docs.blokk.li/adapter/overview.html
All pages that are not dynamically created should be editable by the blökkli editor. 


---

please add a success message in the registration modal that we're happy that you're on board and that you we will get in touch with you and that you can book an onboarding
