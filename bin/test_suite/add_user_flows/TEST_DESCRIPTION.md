# Initialise
1. Create a user with the role LokalteamAdmin and the associated Lokalteam AutomatedTest (if not already existing)
2. Ensure the user has the localteam set in its list of localteams, and that the localteam has the relevant user set as its admin

# Invite
1. Try to invite a user automatedTest2@stadt-land-klima.de to the user's localteam. Ensure they can only select the Lokalteam AutomatedTest.
2. Verify that a new user is created automatically in directus with that email and associated with the correct localteam
3. Verify that a new element is added in the `editors` collection with the correct email and associated localteam

# Ask User to verify
1. That an email arrived at automatedTest2@stadt-land-klima.de with a welcome message, and the exact URL of the signup link that we would expect
