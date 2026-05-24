# Task: Add newsletter subscription field to users collection

## Description
Add a new boolean field `newsletter_subscribed` to the users collection in Directus to track which users have opted in to receive newsletters.

## Requirements
1. Create the field in `src/directus/schema/fields/users.newsletter_subscribed.yaml`
2. Field type: boolean
3. Default value: false
4. Add appropriate meta information (interface, display, etc.)
5. Add read permissions for both frontend and public roles

## Acceptance Criteria
- Field appears in Directus admin panel
- Field can be toggled via the API
- Existing users are not affected (default to false)
- Frontend can read the field value

## Notes
- Remember to run import-all.sh after creating the YAML file
- Follow the existing format of other field YAML files exactly
- The field should be sortable and filterable

## Technical Details
- Use the existing `boolean` interface
- Display should be "Switch"
- Width should be "half"
- Add to the users collection, not a new collection
