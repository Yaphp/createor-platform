function setNativeValue(element, value) {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function getCaptionBox() {
  return (
    document.querySelector("[contenteditable='true']") ||
    document.querySelector("textarea") ||
    document.querySelector("[role='textbox']")
  );
}

function fillCaption(caption) {
  const box = getCaptionBox();
  if (!box) return false;
  box.focus();

  if (box.tagName === "TEXTAREA" || box.tagName === "INPUT") {
    setNativeValue(box, caption);
  } else {
    box.textContent = caption;
    box.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: caption }));
  }

  return true;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "TIKTOK_FILL") return;

  const filled = fillCaption(message.caption || "");
  sendResponse({
    filled,
    note: filled
      ? "Caption filled. Choose the video file manually for this MVP."
      : "Could not find TikTok caption field."
  });
});
