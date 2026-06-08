import { buildOpenAiPrompt } from "../lib/prompts.js";

const statusEl = document.querySelector("#status");
const postsEl = document.querySelector("#posts");
const resultEl = document.querySelector("#result");
const styleEl = document.querySelector("#style");

function setStatus(text) {
  statusEl.textContent = text;
}

function send(message) {
  return chrome.runtime.sendMessage(message);
}

function cleanJsonFence(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseOpenAiJson(text) {
  const cleaned = cleanJsonFence(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("ChatGPT result is not valid JSON yet.");
  }
}

function parseResultCaption(text) {
  try {
    const data = parseOpenAiJson(text);
    const tags = Array.isArray(data.tiktok?.hashtags) ? data.tiktok.hashtags.join(" ") : "";
    return `${data.tiktok?.caption || ""}\n\n${tags}`.trim();
  } catch {
    return text.slice(0, 2200);
  }
}

function normalizeCaptionLine(line) {
  return String(line || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .trim();
}

function normalizeForComparison(line) {
  return normalizeCaptionLine(line)
    .toLowerCase()
    .replace(/https?:\/\/(www\.)?/g, "")
    .replace(/\bunspokenvideo\.com\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function isCtaLike(line) {
  return /\bunspokenvideo(?:\.com)?\b|message you never sent|write (it|the message)|write .*message|send the message/i.test(line);
}

function sanitizeCtaLine(line) {
  let cta = normalizeCaptionLine(line);
  cta = cta.replace(/(?:https?:\/\/)?(?:www\.)?unspokenvideo\.com/gi, "unspokenvideo.com");

  if (!cta) {
    return "Write the message you never sent at unspokenvideo.com";
  }

  if (!/\bunspokenvideo\.com\b/i.test(cta)) {
    cta = `${cta} at unspokenvideo.com`;
  }

  let domainSeen = false;
  cta = cta.replace(/\bunspokenvideo\.com\b/gi, () => {
    if (domainSeen) return "";
    domainSeen = true;
    return "unspokenvideo.com";
  });

  return normalizeCaptionLine(cta);
}

function uniqueCaptionLines(lines) {
  const seen = new Set();
  const unique = [];
  for (const line of lines.map(normalizeCaptionLine).filter(Boolean)) {
    const key = normalizeForComparison(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
  }
  return unique;
}

function buildCaptionLines(resultText) {
  const data = parseOpenAiJson(resultText);
  const storyboard = Array.isArray(data.storyboard) ? data.storyboard.slice(0, 5) : [];
  const total = Math.max(storyboard.length, 1);
  const lines = uniqueCaptionLines(
    storyboard.map((_panel, index) => pickVoiceoverForPanel(data, index, total))
  );
  const ctaLine = sanitizeCtaLine(data.cta_line);
  const scriptLines = lines.filter((line) => {
    const lineKey = normalizeForComparison(line);
    const ctaKey = normalizeForComparison(ctaLine);
    return lineKey !== ctaKey && !isCtaLike(line);
  });
  if (scriptLines.length) return [...scriptLines, ctaLine];
  if (data.rewritten_script) {
    const fallbackLines = uniqueCaptionLines(data.rewritten_script
      .split(/(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter(Boolean))
      .filter((line) => !isCtaLike(line))
      .slice(0, 5);
    if (fallbackLines.length) return [...fallbackLines, ctaLine];
  }
  throw new Error("No voiceover lines found in ChatGPT result.");
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: false }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function pickVoiceoverForPanel(data, index, total) {
  const lines = Array.isArray(data.voiceover_lines) ? data.voiceover_lines.filter(Boolean) : [];
  if (!lines.length) return "";
  if (lines.length === total) return lines[index] || "";

  const start = Math.floor((index / total) * lines.length);
  const end = Math.max(start + 1, Math.floor(((index + 1) / total) * lines.length));
  return lines.slice(start, end).join(" ");
}

function getCharacterContinuity(data) {
  const script = data.rewritten_script || "";
  return `Keep the same recurring characters implied by this story across panels. Follow any identity or appearance cues from the source, story, and requested visual style; do not force a specific ethnicity. Story context: ${script.slice(0, 700)}`;
}

function summarizePreviousPanels(storyboard, currentIndex) {
  return storyboard
    .slice(0, currentIndex)
    .map((panel, index) => ({
      label: panel.panel || index + 1,
      summary: panel.visual || panel.image_prompt || ""
    }))
    .filter((panel) => panel.summary)
    .map((panel) => `Panel ${panel.label}: ${panel.summary}`)
    .join(" | ");
}

function buildPanelImagePrompts(resultText, style) {
  const data = parseOpenAiJson(resultText);
  const storyboard = Array.isArray(data.storyboard) ? data.storyboard.slice(0, 5) : [];
  if (!storyboard.length) {
    throw new Error("No storyboard panels found in ChatGPT result.");
  }

  return storyboard.map((panel, index) => ({
    panel: panel.panel || index + 1,
    visual: panel.visual || "",
    imagePrompt: panel.image_prompt || "",
    emotionalLine: pickVoiceoverForPanel(data, index, storyboard.length),
    continuity: getCharacterContinuity(data),
    previousPanels: summarizePreviousPanels(storyboard, index),
    total: storyboard.length
  }));
}

function buildSinglePanelImagePrompt(panel, style) {
  return `Generate exactly ONE image only: panel ${panel.panel} of ${panel.total}.

This must be a single finished vertical 9:16 illustration, not a collage, not a grid, not multiple panels, not a storyboard sheet.

Use this exact visual style for every image:
${style}

Scene and emotion:
- Scene: ${panel.visual}
- Emotional sentence to express visually, without drawing any text: "${panel.emotionalLine || "quiet longing and unsaid affection"}"
- Base image prompt: ${panel.imagePrompt}
- Continuity: ${panel.continuity}
- Previous panels to avoid repeating: ${panel.previousPanels || "none yet; make this the strongest hook image"}

Hard rules:
- No visible words, captions, usernames, logos, watermarks, UI, speech bubbles, or text inside the image.
- Keep the same recurring characters across all panels.
- Do not repeat the previous panels' location, main prop, camera angle, body pose, or emotional staging unless the base prompt explicitly requires it.
- Avoid defaulting to rain, window staring, glowing phone close-ups, coffee shops, train stations, bedroom waiting, unread-message screens, sitting alone on a bed, or letters on desks unless the story specifically calls for them.
- Focus on the emotional meaning of the sentence through facial expression, body language, concrete action, props, lighting, composition, and environmental pressure.
- Make this image a clear story beat with cause-and-effect, not a generic portrait of sadness.
- Output only this one image.`;
}

async function loadStored() {
  const stored = await chrome.storage.local.get(["redditDrafts", "latestOpenAiResult", "style", "panelImageQueue"]);
  if (stored.redditDrafts) postsEl.value = JSON.stringify(stored.redditDrafts, null, 2);
  if (stored.latestOpenAiResult) resultEl.value = stored.latestOpenAiResult;
  if (stored.style) styleEl.value = stored.style;
  if (stored.panelImageQueue?.length) {
    setStatus(`${stored.panelImageQueue.length} panel image prompts queued`);
  }
}

document.querySelector("#readReddit").addEventListener("click", async () => {
  setStatus("Reading visible Reddit posts...");
  const response = await send({ type: "READ_REDDIT" });
  if (!response.ok) {
    setStatus(response.error);
    return;
  }
  postsEl.value = JSON.stringify(response.result.posts || [], null, 2);
  setStatus(`Found ${(response.result.posts || []).length} posts`);
});

document.querySelector("#sendOpenAi").addEventListener("click", async () => {
  setStatus("Sending prompt to ChatGPT...");
  try {
    await chrome.storage.local.set({ style: styleEl.value });
    const posts = JSON.parse(postsEl.value || "[]");
    if (!Array.isArray(posts) || posts.length === 0) {
      setStatus("No Reddit candidates found. Click Read Reddit first.");
      return;
    }

    const prompt = `${buildOpenAiPrompt(posts)}

Apply this visual style to every image prompt:
${styleEl.value}`;
    const response = await send({ type: "SEND_TO_OPENAI", prompt });
    setStatus(response.ok ? "Prompt sent" : response.error || response.result?.error || "Send failed");
  } catch (error) {
    setStatus(`Send failed: ${error.message}`);
  }
});

document.querySelector("#readOpenAi").addEventListener("click", async () => {
  setStatus("Reading latest ChatGPT response...");
  const response = await send({ type: "READ_OPENAI" });
  if (!response.ok) {
    setStatus(response.error);
    return;
  }
  resultEl.value = response.result.text || "";
  await chrome.storage.local.set({ panelImageQueue: [] });
  setStatus(response.result.text ? "Result captured" : "No result found yet");
});

document.querySelector("#generateImages").addEventListener("click", async () => {
  setStatus("Preparing next panel image...");
  try {
    const stored = await chrome.storage.local.get(["panelImageQueue"]);
    let queue = Array.isArray(stored.panelImageQueue) ? stored.panelImageQueue : [];

    if (!queue.length) {
      const panels = buildPanelImagePrompts(resultEl.value, styleEl.value);
      queue = panels.map((panel) => buildSinglePanelImagePrompt(panel, styleEl.value));
    }

    const prompt = queue.shift();
    await chrome.storage.local.set({ panelImageQueue: queue });
    const response = await send({ type: "SEND_TO_OPENAI", prompt });
    setStatus(response.ok
      ? `Panel image prompt sent. ${queue.length} remaining`
      : response.error || response.result?.error || "Image send failed");
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#downloadImages").addEventListener("click", async () => {
  setStatus("Looking for generated images...");
  const response = await send({ type: "DOWNLOAD_OPENAI_IMAGES" });
  if (!response.ok) {
    setStatus(response.error || "Download failed");
    return;
  }
  setStatus(`Queued ${response.count || 0} image downloads`);
});

document.querySelector("#downloadCaptions").addEventListener("click", async () => {
  setStatus("Preparing captions.txt...");
  try {
    const lines = buildCaptionLines(resultEl.value);
    downloadTextFile("unspokenvideo/captions.txt", lines.join("\n"));
    setStatus(`Downloaded captions.txt with ${lines.length} lines`);
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#buildVideo").addEventListener("click", async () => {
  setStatus("Building video with local FFmpeg...");
  const response = await send({ type: "BUILD_VIDEO" });
  if (!response.ok) {
    setStatus(`Build failed: ${response.error || "unknown error"}`);
    return;
  }

  const outputLine = (response.stdout || "")
    .split(/\r?\n/)
    .reverse()
    .find((line) => /Archived package in|Created/.test(line));
  setStatus(outputLine || "Build complete. Check the output folder.");
});

document.querySelector("#copyCaption").addEventListener("click", async () => {
  setStatus("Copying TikTok caption...");
  try {
    const caption = parseResultCaption(resultEl.value);
    if (!caption) {
      setStatus("No TikTok caption found.");
      return;
    }

    await navigator.clipboard.writeText(caption);
    setStatus("TikTok caption copied. Paste it with Ctrl+V.");
  } catch (error) {
    setStatus(`Copy failed: ${error.message}`);
  }
});

document.querySelector("#fillTikTok").addEventListener("click", async () => {
  setStatus("Filling TikTok caption...");
  const caption = parseResultCaption(resultEl.value);
  const response = await send({ type: "FILL_TIKTOK", caption });
  setStatus(response.ok ? "TikTok filled" : response.error);
});

loadStored();
