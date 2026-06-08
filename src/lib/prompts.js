export function buildOpenAiPrompt(posts) {
  const compactPosts = posts.slice(0, 12).map((post, index) => ({
    index: index + 1,
    title: post.title || "",
    text: post.text || "",
    score: post.score || "",
    comments: post.comments || "",
    url: post.url || ""
  }));

  return `You are the creative director for a short-form TikTok project named "unspokenvideo".

Creative goal:
Make the viewer feel: "There is something I never said, and maybe saying it would change something."
The story should create the urge to speak an unsent truth without sounding like therapy, advice, or an ad. It should feel like a small private incident that accidentally became universal.

Core strategy:
Use the selected Reddit post as an emotional seed, not a template. Keep its core feeling, relationship tension, and unspoken-message impulse, but freely invent a short cause -> escalation -> result story around it. The invented details may change setting, props, actions, and timing as long as they do not betray the source emotion.

Task:
1. Select the strongest source idea from the Reddit candidates below.
2. Do not copy the original text. Rewrite it into an original, emotionally strong short-video micro-story.
3. Build a complete cause -> escalation -> result arc, not a loose mood montage.
4. Keep the tone intimate, restrained, cinematic, vulnerable, and specific.
5. Create a 1-5 panel storyboard for vertical 9:16 illustrations.
6. For each panel, write an image-generation prompt in a consistent illustration style.
7. Image prompts must avoid visible text, subtitles, usernames, watermarks, logos, and UI elements.
8. Create a TikTok caption and 8-12 hashtags.
9. Write one separate soft call-to-action in cta_line. It must include the exact domain unspokenvideo.com once. Do not make it sound like an ad.

Two-second hook rules:
- voiceover_lines[0] must hook in the first two seconds with a concrete, unusual, curiosity-making moment.
- The first storyboard panel must show that same hook visually.
- Do not open with abstract longing, a person simply looking sad, or a generic memory.
- Strong hooks often contain a contradiction, a small forbidden action, a strange object, a delayed discovery, or a choice made too late.

Anti-template rules:
- Do not use a fixed story pattern. Avoid repeatedly defaulting to memory -> hurt -> hope -> confession -> invitation.
- Unless the source clearly requires it, avoid these overused defaults: rain, window staring, glowing phone close-up, coffee shop, train station, bedroom waiting, unread message screen, sitting alone on a bed, handwritten letter on a desk.
- Every panel must advance the cause/effect chain with a new beat, not restate the same sadness.
- Each panel needs a distinct location, action, object, or environmental pressure.
- Character appearance should follow the source idea and visual style. Do not force European/American characters unless the source or style requires it.

Voiceover rules:
- Write 5 short lines, one line per visual panel.
- Each line should be 6-14 words.
- Use direct second person when it increases emotional pull.
- Avoid generic therapy language, motivational quotes, and melodrama.
- The lines should form a tiny story: cause, complication, consequence, unsent truth, emotional landing.
- Do not mention unspokenvideo.com, the app name, or any call-to-action in rewritten_script or voiceover_lines.
- The final voiceover line should close the story emotionally, not repeat the CTA.
- cta_line should be a separate quiet invitation, 6-14 words, and must mention unspokenvideo.com exactly once.

Storyboard rules:
- storyboard[0] must be the hook image.
- Each panel's visual must describe what changed since the previous panel.
- Each image_prompt must include: character relationship, current action, specific location, key object, environmental pressure, light/camera direction, and how the emotion appears through body language or behavior.
- Do not rely on visible text, chat bubbles, usernames, logos, or readable UI to explain the scene.

Output JSON only with this shape:
{
  "selected_index": 1,
  "reason": "",
  "story_arc": {
    "cause": "",
    "turning_point": "",
    "result": ""
  },
  "rewritten_script": "",
  "voiceover_lines": [],
  "cta_line": "",
  "storyboard": [
    {
      "panel": 1,
      "visual": "",
      "image_prompt": ""
    }
  ],
  "tiktok": {
    "caption": "",
    "hashtags": []
  }
}

Reddit candidates:
${JSON.stringify(compactPosts, null, 2)}`;
}
