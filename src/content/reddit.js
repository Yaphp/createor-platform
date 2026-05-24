function textOf(root, selector) {
  return root.querySelector(selector)?.textContent?.trim() || "";
}

function getPostUrl(root) {
  const anchor = root.querySelector('a[href*="/comments/"]');
  if (!anchor) return location.href;
  return new URL(anchor.getAttribute("href"), location.origin).href;
}

function readShredditPosts() {
  return Array.from(document.querySelectorAll("shreddit-post")).map((post) => ({
    title: post.getAttribute("post-title") || textOf(post, "h3"),
    text: post.innerText.slice(0, 1600),
    score: post.getAttribute("score") || textOf(post, '[id*="vote"]'),
    comments: post.getAttribute("comment-count") || "",
    url: getPostUrl(post)
  }));
}

function readFallbackPosts() {
  const candidates = Array.from(document.querySelectorAll("article, [data-testid='post-container']"));
  return candidates.map((post) => ({
    title: textOf(post, "h1, h2, h3"),
    text: post.innerText.slice(0, 1600),
    score: "",
    comments: "",
    url: getPostUrl(post)
  }));
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "REDDIT_READ_VISIBLE") return;

  const posts = [...readShredditPosts(), ...readFallbackPosts()]
    .filter((post) => post.title || post.text)
    .filter((post, index, all) => all.findIndex((other) => other.url === post.url) === index)
    .slice(0, 20);

  sendResponse({ posts, url: location.href });
});
