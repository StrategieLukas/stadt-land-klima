/** Reserve the viewer during the click, before PDF generation outlives user activation. */
export async function openPdf(generate: () => Promise<Blob>): Promise<void> {
  const viewer = window.open("about:blank", "_blank");
  if (viewer) viewer.opener = null;

  try {
    const pdf = await generate();
    if (viewer?.closed) return;
    const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
    try {
      if (viewer) viewer.location.replace(url);
      else window.location.assign(url);
    } finally {
      // Allow the browser's PDF viewer to consume the blob before releasing it.
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60_000);
    }
  } catch (error) {
    viewer?.close();
    throw error;
  }
}
