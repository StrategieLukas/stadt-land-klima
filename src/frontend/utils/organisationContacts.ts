import { OrganisationContactSchema, type OrganisationContact } from "~/shared/contracts/content";

export function organisationContacts(email: string, contacts: OrganisationContact[]): OrganisationContact[] {
  const legacy = OrganisationContactSchema.safeParse({ type: "email", value: email, label: null });
  const combined = legacy.success ? [legacy.data, ...contacts] : contacts;
  const seen = new Set<string>();
  return combined.filter((contact) => {
    const href = organisationContactHref(contact);
    if (seen.has(href)) return false;
    seen.add(href);
    return true;
  });
}

export function organisationContactHref(contact: OrganisationContact): string {
  return contact.type === "email" ? `mailto:${contact.value}` : `tel:${contact.value.replace(/[^+\d]/g, "")}`;
}
