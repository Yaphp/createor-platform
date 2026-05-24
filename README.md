# Unspoken Video Pipeline

Browser extension MVP for connecting:

1. Reddit `r/unsentstext` collection
2. ChatGPT/OpenAI web automation for copy selection, rewrite, storyboard, and image prompts
3. TikTok upload-page assistance

## Load The Extension

1. Open Chrome or Edge.
2. Go to `chrome://extensions`.
3. Enable Developer mode.
4. Choose `Load unpacked`.
5. Select this folder: `E:\projects\images\20260430`.

## MVP Flow

1. Open `https://www.reddit.com/r/unsentstext/`.
2. Open the extension side panel.
3. Click `Read Reddit`.
4. Open `https://chatgpt.com/` in another tab and make sure you are logged in.
5. Click `Send To ChatGPT`.
6. When ChatGPT finishes, click `Read ChatGPT`.
7. Click `Generate Images` to ask ChatGPT to create 1-5 illustrations from the storyboard.
8. When images are visible in ChatGPT, click `Download Images`.
9. Build a simple slideshow video:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\native\build_video_ffmpeg.ps1
   ```

   The final video and working package are written under `output\<date>\`.
   That folder contains `images\`, `captions\`, `segments\`, and `unspokenvideo.mp4`.
   When the build completes successfully, the original downloaded source files under the downloads `unspokenvideo` folder are deleted after the archive copy is created.

10. To build from the extension side panel, install the Native Messaging host once.
    Find the unpacked extension id in `chrome://extensions`, then run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\native\install_native_host.ps1 -ExtensionId "your_extension_id"
   ```

   Reload the extension after installing. The side panel `Build Video` button will then call the local FFmpeg builder.

11. Open TikTok upload page and click `Fill TikTok`.

## Current Limits

- This version automates ChatGPT/OpenAI through the web UI, which is useful but fragile when the page changes.
- Image download depends on the current ChatGPT page markup and image URLs. If ChatGPT changes how it renders generated images, this selector may need an update.
- Browser pages cannot safely set a local video file path into TikTok's file input from normal content scripts. The MVP fills title/tags and prepares the publishing package. A later version can add Chrome Debugger Protocol or Native Messaging if you want true file upload automation.
- Keep Reddit posts as inspiration and publish rewritten original copy, not raw copied user posts.
