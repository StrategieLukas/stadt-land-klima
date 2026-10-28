import { defineModule } from "@directus/extensions-sdk";
import RoleInvitations from "./role-invitations.vue";

export default defineModule({
  id: "role-invitations",
  name: "Personen einladen",
  icon: "person_add",
  preRegisterCheck: (user) => user.admin_access === true,
  routes: [{ path: "", component: RoleInvitations }],
});
