const { spawn } = require("child_process");
const path = require("path");

const hostDir = __dirname;
const projectRoot = path.resolve(hostDir, "..");
const scriptPath = path.join(hostDir, "build_video_ffmpeg.ps1");

function readNativeMessage() {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let expectedLength = null;

    function tryReadMessage() {
      if (expectedLength === null && buffer.length >= 4) {
        expectedLength = buffer.readUInt32LE(0);
      }

      if (expectedLength !== null && buffer.length >= expectedLength + 4) {
        const payload = buffer.subarray(4, 4 + expectedLength).toString("utf8");
        cleanup();
        resolve(payload ? JSON.parse(payload) : {});
      }
    }

    function onData(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      tryReadMessage();
    }

    function onEnd() {
      cleanup();
      resolve({});
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function cleanup() {
      process.stdin.off("data", onData);
      process.stdin.off("end", onEnd);
      process.stdin.off("error", onError);
    }

    process.stdin.on("data", onData);
    process.stdin.on("end", onEnd);
    process.stdin.on("error", onError);
  });
}

function sendNativeMessage(message) {
  const json = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(Buffer.concat([header, json]));
}

function runBuild(message) {
  return new Promise((resolve) => {
    const imageDir = message.imageDir || "F:\\download\\谷歌下载\\unspokenvideo\\images";
    const captionFile = message.captionFile || "F:\\download\\谷歌下载\\unspokenvideo\\captions.txt";
    const archiveRoot = message.archiveRoot || projectRoot;

    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-ImageDir",
      imageDir,
      "-CaptionFile",
      captionFile,
      "-ArchiveRoot",
      archiveRoot,
      "-CaptionMarginTop",
      "260"
    ];

    const child = spawn("powershell", args, { cwd: projectRoot, windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ ok: false, error: error.message, stdout, stderr });
    });
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        error: code === 0 ? "" : stderr.trim() || stdout.trim() || `Build exited with code ${code}`
      });
    });
  });
}

(async () => {
  try {
    if (process.argv.includes("--self-test")) {
      const result = await runBuild({ type: "BUILD_VIDEO" });
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    }

    const message = await readNativeMessage();
    if (message.type !== "BUILD_VIDEO") {
      sendNativeMessage({ ok: false, error: `Unknown native message: ${message.type || ""}` });
      return;
    }

    sendNativeMessage(await runBuild(message));
  } catch (error) {
    sendNativeMessage({ ok: false, error: error.message });
  }
})();
