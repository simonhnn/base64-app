import { expect } from "chai";
import { JSDOM } from "jsdom";
import path from "path";
import { pathToFileURL } from "url";
import { parseChannelUrl } from "../functions/api/estimate.js";

const toolsFileUrl = pathToFileURL(path.resolve("public/tools.js")).href;

describe("parseChannelUrl（サーバー側URL判定）", () => {
  it("YouTube ハンドル (@) を判定する", () => {
    const r = parseChannelUrl("https://www.youtube.com/@example");
    expect(r).to.deep.equal({ platform: "youtube", kind: "handle", value: "@example" });
  });
  it("YouTube チャンネルID (UC...) を判定する", () => {
    const r = parseChannelUrl("https://youtube.com/channel/UC1234567890");
    expect(r).to.deep.equal({ platform: "youtube", kind: "id", value: "UC1234567890" });
  });
  it("YouTube /user/ を判定する", () => {
    const r = parseChannelUrl("https://www.youtube.com/user/SomeName");
    expect(r).to.deep.equal({ platform: "youtube", kind: "username", value: "SomeName" });
  });
  it("Twitch のログイン名を判定する", () => {
    const r = parseChannelUrl("https://twitch.tv/SomeStreamer");
    expect(r).to.deep.equal({ platform: "twitch", kind: "login", value: "somestreamer" });
  });
  it("ツイキャスのユーザーを判定する", () => {
    const r = parseChannelUrl("https://twitcasting.tv/someuser");
    expect(r).to.deep.equal({ platform: "twitcasting", kind: "user", value: "someuser" });
  });
  it("対象外/不正URLは null を返す", () => {
    expect(parseChannelUrl("https://example.com/foo")).to.equal(null);
    expect(parseChannelUrl("not a url")).to.equal(null);
  });
});

function setupDom() {
  const dom = new JSDOM(
    `<!doctype html>
    <html lang="ja-JP">
      <body>
        <input id="crUrl" value="" />
        <button id="crFetchBtn" type="button"></button>
        <p id="crStatus"></p>
        <p id="crDetected"></p>
        <p id="crContext"></p>
        <input id="crMonthlyViews" value="100000" />
        <input id="crRpmLow" value="50" />
        <input id="crRpmHigh" value="500" />
        <span id="crMonLow"></span>
        <span id="crMonHigh"></span>
        <span id="crYrLow"></span>
        <span id="crYrHigh"></span>
      </body>
    </html>`,
    { url: "https://example.test" }
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.navigator.clipboard = { writeText: async () => {} };
  return dom;
}

function fire(el, type = "input") {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

describe("配信者 予想収益シミュレーター（クライアント計算）", () => {
  beforeEach(async () => {
    setupDom();
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ available: false }) });
    await import(`${toolsFileUrl}?test=${Date.now()}`);
  });

  it("初期表示で月間・年間の概算レンジが計算される（10万再生・RPM50〜500）", () => {
    expect(document.getElementById("crMonLow").textContent).to.equal("¥5,000");
    expect(document.getElementById("crMonHigh").textContent).to.equal("¥50,000");
    expect(document.getElementById("crYrLow").textContent).to.equal("¥60,000");
    expect(document.getElementById("crYrHigh").textContent).to.equal("¥600,000");
  });

  it("再生数を変えると再計算される", () => {
    const views = document.getElementById("crMonthlyViews");
    views.value = "1000000";
    fire(views);
    expect(document.getElementById("crMonLow").textContent).to.equal("¥50,000");
    expect(document.getElementById("crMonHigh").textContent).to.equal("¥500,000");
  });

  it("数値が空だと — 表示になる", () => {
    const views = document.getElementById("crMonthlyViews");
    views.value = "";
    fire(views);
    expect(document.getElementById("crMonLow").textContent).to.equal("—");
    expect(document.getElementById("crYrHigh").textContent).to.equal("—");
  });
});
