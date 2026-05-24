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
Make the viewer feel: "Maybe they still love me. Maybe I should finally send the message I never said."
The script should carry ache, hope, and unfinished love. It should feel specific enough to be real, but universal enough for someone to project their own relationship onto it.

Task:
1. Select the strongest source idea from the Reddit candidates below.
2. Do not copy the original text. Rewrite it into an original, emotionally strong short-video script.
3. Keep the tone intimate, unsent, restrained, cinematic, and emotionally vulnerable.
4. Create a 1-5 panel storyboard for vertical 9:16 illustrations.
5. For each panel, write an image-generation prompt in a consistent illustration style.
6. Characters should look European/American unless the source idea clearly requires otherwise.
7. Image prompts must avoid visible text, subtitles, usernames, watermarks, logos, and UI elements.
8. Create a TikTok caption and 8-12 hashtags.
9. Include a soft call-to-action that fits the story, such as inviting viewers to write the message they never sent with unspokenvideo.com. Do not make it sound like an ad.

Voiceover rules:
- Write 5 short lines, one line per visual panel.
- Each line should be 6-14 words.
- Use direct second person when it increases emotional pull.
- Avoid generic therapy language, motivational quotes, and melodrama.
- Strong pattern: concrete memory -> hidden hurt -> lingering hope -> unsent confession -> quiet invitation.
- The final line may gently suggest the product feeling, but must stay poetic, not salesy.

Output JSON only with this shape:
{
  "selected_index": 1,
  "reason": "",
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
