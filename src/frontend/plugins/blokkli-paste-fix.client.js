/**
 * Blökkli paste fix
 *
 * The blökkli Clipboard feature registers a document-level paste listener
 * (bubble phase) that calls e.preventDefault() for all targets except
 * HTMLInputElement and HTMLTextAreaElement. This breaks paste inside
 * contenteditable elements (used by the text/markup block editor).
 *
 * Fix: register a capture-phase listener that stops propagation when the
 * paste target is contenteditable. The browser then handles the paste
 * normally; the Clipboard bubble-phase listener never fires.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  function onPasteCapture(e) {
    const target = e.target
    if (target instanceof HTMLElement && target.isContentEditable) {
      // Stop the event from reaching the blökkli Clipboard document listener.
      // Do NOT call preventDefault() — the browser must still paste the content.
      e.stopPropagation()
    }
  }

  document.addEventListener('paste', onPasteCapture, true)
})
