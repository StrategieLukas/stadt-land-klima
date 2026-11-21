/** Make synchronous mail flows report transport failure without leaking provider diagnostics. */
export const mailPatches: { file: string; sha256: string; replacements: [string, string][] }[] = [
  {
    file: "dist/operations/mail/index.js",
    sha256: "07c28825efa9fbd74af71a9d86a66887254e697e11f2b99a43aeb2155a17ab5d",
    replacements: [
      [
        '\t\tmailService.send(mailObject).catch((error) => {\n\t\t\tlogger.error(error, "Could not send mail in \\"mail\\" operation");\n\t\t});',
        `\t\ttry {
      // Await transport acceptance; a cancelled mail filter is not a successful send.
      if (await mailService.send(mailObject) == null) throw new Error("Mail send cancelled");
    } catch {
      logger.error({event: "directus.mail.send_failed", userId: accountability?.user ?? null, actorType: accountability?.user ? "user" : "system", severity: "error"}, "Mail transport did not accept the message");
      throw new Error("Mail transport did not accept the message");
    }`,
      ],
    ],
  },
];
