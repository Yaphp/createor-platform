function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getComposer() {
  return (
    document.querySelector("#prompt-textarea") ||
    document.querySelector("div[contenteditable='true']#prompt-textarea") ||
    document.querySelector("div[contenteditable='true'][data-placeholder]") ||
    document.querySelector("div[contenteditable='true']") ||
    document.querySelector("textarea")
  );
}

function setTextareaValue(element, text) {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
  descriptor?.set?.call(element, text);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function selectElementContents(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

async function setComposerText(element, text) {
  element.focus();
  if (element.tagName === "TEXTAREA") {
    setTextareaValue(element, text);
    return;
  }

  selectElementContents(element);
  document.execCommand("delete");
  await sleep(50);
  const inserted = document.execCommand("insertText", false, text);

  if (!inserted || !element.innerText.includes(text.slice(0, 40))) {
    element.innerHTML = "";
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    element.append(paragraph);
  }

  element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: text }));
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
}

function getSendButton() {
  const buttons = Array.from(document.querySelectorAll("button"));
  return (
    document.querySelector('button[data-testid="send-button"]') ||
    document.querySelector('button[aria-label*="Send" i]') ||
    buttons.find((button) => /send|submit/i.test(button.getAttribute("aria-label") || ""))
  );
}

async function waitForEnabledSendButton(timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const button = getSendButton();
    if (button && !button.disabled && button.getAttribute("aria-disabled") !== "true") {
      return button;
    }
    await sleep(150);
  }
  return getSendButton();
}

function submitComposer(composer, button) {
  if (button && !button.disabled && button.getAttribute("aria-disabled") !== "true") {
    button.click();
    return true;
  }

  const form = composer.closest("form");
  if (form?.requestSubmit) {
    form.requestSubmit();
    return true;
  }

  composer.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true
  }));
  return true;
}

function readLastAssistantText() {
  const assistantNodes = Array.from(
    document.querySelectorAll('[data-message-author-role="assistant"], article, .markdown')
  );
  const texts = assistantNodes
    .map((node) => node.innerText?.trim() || "")
    .filter((text) => text.length > 80);
  return texts.at(-1) || "";
}

function readGeneratedImages() {
  const imageNodes = Array.from(document.querySelectorAll("img"));
  return imageNodes
    .map((img) => ({
      src: img.currentSrc || img.src,
      alt: img.alt || "",
      width: img.naturalWidth || img.width || 0,
      height: img.naturalHeight || img.height || 0
    }))
    .filter((image) => image.src && !image.src.startsWith("data:image/svg"))
    .filter((image) => {
      const src = image.src.toLowerCase();
      const alt = image.alt.toLowerCase();
      return (
        image.width >= 256 ||
        image.height >= 256 ||
        src.includes("oaidalleapiprodscus") ||
        src.includes("dalle") ||
        alt.includes("generated")
      );
    })
    .filter((image, index, all) => all.findIndex((other) => other.src === image.src) === index);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "OPENAI_SEND_PROMPT") {
      const composer = getComposer();
      if (!composer) {
        sendResponse({ ok: false, error: "Could not find ChatGPT composer." });
        return;
      }

      await setComposerText(composer, message.prompt);
      const button = await waitForEnabledSendButton();
      if (!button && !composer.closest("form")) {
        sendResponse({ ok: false, error: "Could not find enabled send button." });
        return;
      }

      submitComposer(composer, button);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "OPENAI_READ_LAST") {
      sendResponse({ text: readLastAssistantText() });
      return;
    }

    if (message.type === "OPENAI_READ_IMAGES") {
      const images = readGeneratedImages();
      sendResponse({ ok: true, images });
    }
  })();

  return true;
});
