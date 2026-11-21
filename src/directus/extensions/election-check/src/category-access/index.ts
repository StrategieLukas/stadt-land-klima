import { defineHook } from "@directus/extensions-sdk";
import { ForbiddenError } from "@directus/errors";
import type { EventContext, Query } from "@directus/types";

export default defineHook(({ filter }, { services, getSchema }) => {
  // Permission validation sees the submitted FK, not the related election.
  // Check the relation with the caller's authority before any nested writes.
  const checkElection = async (
    payload: Record<string, unknown>,
    meta: Record<string, unknown>,
    context: EventContext,
    creating: boolean,
  ) => {
    if (meta.collection !== "candidate" && meta.collection !== "questions") return payload;
    const { accountability, database, schema } = context;
    if (!accountability || accountability.admin) return payload;
    if (!creating && !("election" in payload)) return payload;
    if (!accountability.user || (typeof payload.election !== "string" && typeof payload.election !== "number")) {
      throw new ForbiddenError();
    }
    const elections = new services.ItemsService("elections", {
      accountability,
      knex: database,
      schema: schema ?? (await getSchema()),
    });
    await elections.readOne(payload.election, { fields: ["id"] });
    return payload;
  };

  filter<Record<string, unknown>>("items.create", (payload, meta, context) =>
    checkElection(payload, meta, context, true),
  );
  filter<Record<string, unknown>>("items.update", (payload, meta, context) =>
    checkElection(payload, meta, context, false),
  );

  // Comments store a generic collection/item pair, without a question FK that
  // YAML permission filters could follow. Keep their text in the same scope.
  filter<Query>("comments.query", async (query, _meta, { accountability, database, schema }) => {
    if (!accountability?.user || accountability.admin) return query;
    const roles = accountability.roles ?? (accountability.role ? [accountability.role] : []);
    const wahlcheckRole = await database("directus_roles")
      .whereIn("id", roles)
      .where({ name: "WahlcheckAdmin" })
      .first("id");
    if (!wahlcheckRole) return query;

    const questions = new services.ItemsService("questions", {
      accountability,
      knex: database,
      schema: schema ?? (await getSchema()),
    });
    const visible = await questions.readByQuery({ fields: ["id"], limit: -1 });
    return {
      ...query,
      filter: {
        _and: [
          ...(query.filter ? [query.filter] : []),
          { collection: { _eq: "questions" } },
          { item: { _in: visible.map((question) => String(question.id)) } },
        ],
      },
    };
  });
});
