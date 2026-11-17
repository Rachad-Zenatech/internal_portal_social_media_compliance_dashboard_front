import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

function harness({ failFirst = false, duration = 10, react = {} } = {}) {
  const videos = [];
  class Video extends EventTarget {
    constructor() {
      super();
      this.duration = duration;
      this.videoWidth = 1080;
      this.videoHeight = 1920;
      this.time = 0;
      this.released = false;
    }
    set src(value) {
      this.url = value;
      // A cached response can arrive before the assignment returns.
      this.dispatchEvent(new Event(failFirst && videos.length === 1 ? "error" : "loadeddata"));
    }
    get currentTime() { return this.time; }
    set currentTime(value) { this.time = value; this.dispatchEvent(new Event("seeked")); }
    load() {}
    removeAttribute(name) { if (name === "src") this.released = true; }
  }
  const document = {
    createElement(kind) {
      if (kind === "video") { const video = new Video(); videos.push(video); return video; }
      let frame;
      return {
        getContext: () => ({
          drawImage(video) {
            assert.equal(video.crossOrigin, "anonymous", "CORS must be set before loading a drawable frame");
            frame = video;
          },
          getImageData: () => ({ data: new Uint8ClampedArray([20, 30, 40, 255, 180, 190, 200, 255]) }),
        }),
        toDataURL: () => `data:image/jpeg;base64,frame-${frame.currentTime}`,
      };
    },
  };
  const service = loadService("videoThumbnail", { react }, "lib", {
    document, window: { setTimeout, clearTimeout },
  });
  return { ...service, videos };
}

test("captures an uploaded video frame when load and seek events arrive immediately", async () => {
  const h = harness();
  const result = await h.getVideoThumbnail("https://api.example/video.mp4?token=media");
  assert.match(result.dataUrl, /^data:image\/jpeg/);
  assert.equal(result.duration, 10);
  assert.equal(h.videos[0].crossOrigin, "anonymous");
  assert.equal(h.videos[0].released, true);
});

test("cards share an extraction and reuse a successful thumbnail", async () => {
  const h = harness();
  const first = h.getVideoThumbnail("video.mp4");
  assert.equal(h.getVideoThumbnail("video.mp4"), first);
  await first;
  await h.getVideoThumbnail("video.mp4");
  assert.equal(h.videos.length, 1);
});

test("a temporary media authorization failure does not permanently cache a blank thumbnail", async () => {
  const h = harness({ failFirst: true });
  const failed = await h.getVideoThumbnail("video.mp4");
  assert.equal(failed.dataUrl, null);
  const retried = await h.getVideoThumbnail("video.mp4");
  assert.match(retried.dataUrl, /^data:image\/jpeg/);
  assert.equal(h.videos.length, 2);
  assert.ok(h.videos.every((video) => video.released));
});

test("a clip without a finite duration still uses its loaded frame", async () => {
  const h = harness({ duration: NaN });
  const result = await h.getVideoThumbnail("stream.mp4");
  assert.match(result.dataUrl, /^data:image\/jpeg/);
  assert.equal(result.duration, null);
});


test("the hook starts empty and never shows the previous video's frame for a new upload", async () => {
  let state = null;
  let effect;
  const h = harness({ react: {
    useState: () => [state, (next) => { state = next; }],
    useEffect: (run) => { effect = run; },
  } });
  assert.equal(h.useVideoThumbnail().dataUrl, null);
  effect();
  assert.equal(h.useVideoThumbnail("first.mp4").dataUrl, null);
  const stop = effect();
  await h.getVideoThumbnail("first.mp4");
  assert.match(h.useVideoThumbnail("first.mp4").dataUrl, /^data:image\/jpeg/);
  stop();
  assert.equal(h.useVideoThumbnail("replacement.mp4").dataUrl, null);
  assert.equal(h.useVideoThumbnail(null).dataUrl, null);
});
