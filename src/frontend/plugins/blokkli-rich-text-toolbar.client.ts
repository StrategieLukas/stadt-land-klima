type RichTextCommand = "bold" | "italic" | "removeFormat" | "unlink";

function selectionRangeInside(editable: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;

  const range = selection.getRangeAt(0);
  return editable.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
}

function restoreSelection(range: Range | null): void {
  if (!range) return;
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function replaceTag(element: HTMLElement, tagName: "strong" | "em"): void {
  const replacement = document.createElement(tagName);
  while (element.firstChild) replacement.append(element.firstChild);
  element.replaceWith(replacement);
}

function normalizeSemanticMarkup(editable: HTMLElement): void {
  editable.querySelectorAll<HTMLElement>("b").forEach((element) => replaceTag(element, "strong"));
  editable.querySelectorAll<HTMLElement>("i").forEach((element) => replaceTag(element, "em"));
}

function dispatchInput(editable: HTMLElement): void {
  normalizeSemanticMarkup(editable);
  editable.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

function runCommand(editable: HTMLElement, savedRange: Range | null, command: RichTextCommand): void {
  editable.focus();
  restoreSelection(savedRange);
  document.execCommand(command, false);
  dispatchInput(editable);
}

function toggleLightText(editable: HTMLElement, savedRange: Range | null): void {
  if (!savedRange) return;

  const startElement =
    savedRange.startContainer instanceof HTMLElement
      ? savedRange.startContainer
      : savedRange.startContainer.parentElement;
  const lightElement = startElement?.closest<HTMLElement>(".slk-text-light");

  if (lightElement && editable.contains(lightElement)) {
    lightElement.replaceWith(...lightElement.childNodes);
    dispatchInput(editable);
    return;
  }

  if (savedRange.collapsed) return;

  const span = document.createElement("span");
  span.className = "slk-text-light";
  span.append(savedRange.extractContents());
  savedRange.insertNode(span);
  savedRange.selectNodeContents(span);
  restoreSelection(savedRange);
  dispatchInput(editable);
}

function normalizeLink(raw: string): string | null {
  const link = raw.trim();
  if (!link) return null;
  if (/^(?:#|\?|\/|\.\/|\.\.\/)/.test(link)) return link;
  if (/^(?:https?:|mailto:|tel:)/i.test(link)) return link;
  if (/^[a-z][a-z\d+.-]*:/i.test(link)) return null;
  return `/${link.replace(/^\/+/, "")}`;
}

export default defineNuxtPlugin((nuxtApp) => {
  const translate = (key: string): string => {
    const value = (nuxtApp.$t as ((translationKey: string) => string) | undefined)?.(key);
    return value || key;
  };

  function addButton(toolbar: HTMLElement, label: string, content: string, onActivate: () => void): void {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slk-rich-text-toolbar__button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = content;
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", (event) => {
      event.preventDefault();
      onActivate();
    });
    toolbar.append(button);
  }

  function enhance(root: HTMLElement): void {
    if (root.dataset.slkToolbarReady === "true") return;
    const editable = root.querySelector<HTMLElement>("[contenteditable]");
    if (!editable) return;

    root.dataset.slkToolbarReady = "true";
    const toolbar = document.createElement("div");
    toolbar.className = "slk-rich-text-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", translate("blokkli.rich_text.toolbar"));

    let savedRange: Range | null = null;
    const rememberSelection = () => {
      savedRange = selectionRangeInside(editable) || savedRange;
    };
    editable.addEventListener("keyup", rememberSelection);
    editable.addEventListener("mouseup", rememberSelection);
    editable.addEventListener("focus", rememberSelection);

    addButton(toolbar, translate("blokkli.rich_text.bold"), "<strong>B</strong>", () =>
      runCommand(editable, savedRange, "bold"),
    );
    addButton(toolbar, translate("blokkli.rich_text.italic"), "<em>I</em>", () =>
      runCommand(editable, savedRange, "italic"),
    );
    addButton(
      toolbar,
      translate("blokkli.rich_text.light"),
      '<span class="slk-rich-text-toolbar__light">L</span>',
      () => toggleLightText(editable, savedRange),
    );
    addButton(toolbar, translate("blokkli.rich_text.link"), "&#128279;", () => {
      restoreSelection(savedRange);
      const raw = window.prompt(translate("blokkli.rich_text.link_prompt"));
      if (raw === null) return;
      const link = normalizeLink(raw);
      if (!link) return;
      editable.focus();
      restoreSelection(savedRange);
      document.execCommand("createLink", false, link);
      dispatchInput(editable);
    });
    addButton(toolbar, translate("blokkli.rich_text.unlink"), '<span aria-hidden="true">&#128279;&#x0338;</span>', () =>
      runCommand(editable, savedRange, "unlink"),
    );
    addButton(toolbar, translate("blokkli.rich_text.remove_format"), '<span aria-hidden="true">Tx</span>', () =>
      runCommand(editable, savedRange, "removeFormat"),
    );

    root.prepend(toolbar);
  }

  function discover(node: ParentNode): void {
    if (node instanceof HTMLElement && node.matches(".bk-editable-field-contenteditable")) {
      enhance(node);
    }
    node.querySelectorAll<HTMLElement>(".bk-editable-field-contenteditable").forEach(enhance);
  }

  discover(document);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) discover(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
});
