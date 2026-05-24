chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function findTabByHost(hosts) {
  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => {
    try {
      const url = new URL(tab.url || "");
      return hosts.includes(url.host);
    } catch {
      return false;
    }
  });
}

async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    if (!/Receiving end does not exist/i.test(error.message)) {
      throw error;
    }

    await injectContentScript(tabId, message.type);
    return chrome.tabs.sendMessage(tabId, message);
  }
}

function sendNativeMessage(hostName, message) {
  return new Promise((resolve) => {
    chrome.runtime.sendNativeMessage(hostName, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      resolve(response || { ok: false, error: "Native host returned no response." });
    });
  });
}

async function injectContentScript(tabId, messageType) {
  const fileByMessage = {
    REDDIT_READ_VISIBLE: "src/content/reddit.js",
    OPENAI_SEND_PROMPT: "src/content/openai.js",
    OPENAI_READ_LAST: "src/content/openai.js",
    OPENAI_READ_IMAGES: "src/content/openai.js",
    TIKTOK_FILL: "src/content/tiktok.js"
  };
  const file = fileByMessage[messageType];
  if (!file) return;
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [file]
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "GET_ACTIVE_TAB") {
      sendResponse({ ok: true, tab: await getActiveTab() });
      return;
    }

    if (message.type === "READ_REDDIT") {
      const tab = await getActiveTab();
      const result = await sendToTab(tab.id, { type: "REDDIT_READ_VISIBLE" });
      await chrome.storage.local.set({ redditDrafts: result.posts || [] });
      sendResponse({ ok: true, result });
      return;
    }

    if (message.type === "SEND_TO_OPENAI") {
      const tab = await findTabByHost(["chatgpt.com", "chat.openai.com"]);
      if (!tab) {
        sendResponse({ ok: false, error: "Open chatgpt.com first and log in." });
        return;
      }
      const result = await sendToTab(tab.id, {
        type: "OPENAI_SEND_PROMPT",
        prompt: message.prompt
      });
      sendResponse(result?.ok === false ? result : { ok: true, result });
      return;
    }

    if (message.type === "READ_OPENAI") {
      const tab = await findTabByHost(["chatgpt.com", "chat.openai.com"]);
      if (!tab) {
        sendResponse({ ok: false, error: "Open chatgpt.com first and log in." });
        return;
      }
      const result = await sendToTab(tab.id, { type: "OPENAI_READ_LAST" });
      if (result.text) {
        await chrome.storage.local.set({ latestOpenAiResult: result.text });
      }
      sendResponse(result?.ok === false ? result : { ok: true, result });
      return;
    }

    if (message.type === "DOWNLOAD_OPENAI_IMAGES") {
      const tab = await findTabByHost(["chatgpt.com", "chat.openai.com"]);
      if (!tab) {
        sendResponse({ ok: false, error: "Open chatgpt.com first and log in." });
        return;
      }

      const result = await sendToTab(tab.id, { type: "OPENAI_READ_IMAGES" });
      if (result?.ok === false) {
        sendResponse(result);
        return;
      }

      const images = (result.images || []).slice(-5);
      for (const [index, image] of images.entries()) {
        await chrome.downloads.download({
          url: image.src,
          filename: `unspokenvideo/images/panel-${String(index + 1).padStart(2, "0")}.png`,
          saveAs: false
        });
      }

      await chrome.storage.local.set({ latestImageDownloads: images });
      sendResponse({ ok: true, count: images.length, images });
      return;
    }

    if (message.type === "BUILD_VIDEO") {
      const result = await sendNativeMessage("com.unspokenvideo.pipeline", {
        type: "BUILD_VIDEO",
        imageDir: message.imageDir,
        captionFile: message.captionFile,
        archiveRoot: message.archiveRoot
      });
      sendResponse(result);
      return;
    }

    if (message.type === "FILL_TIKTOK") {
      const tab = await findTabByHost(["www.tiktok.com"]);
      if (!tab) {
        sendResponse({ ok: false, error: "Open the TikTok upload page first." });
        return;
      }
      const result = await sendToTab(tab.id, {
        type: "TIKTOK_FILL",
        caption: message.caption
      });
      sendResponse({ ok: true, result });
      return;
    }

    sendResponse({ ok: false, error: `Unknown message: ${message.type}` });
  })().catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
