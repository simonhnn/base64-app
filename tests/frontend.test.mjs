import { expect } from "chai";
import { JSDOM } from "jsdom";
import { TextEncoder, TextDecoder } from "util";
import path from "path";
import { pathToFileURL } from "url";

const appFileUrl = pathToFileURL(path.resolve("public/app.js")).href;

function createTestDom(language = "ja-JP") {
  const dom = new JSDOM(
    `<!doctype html>
    <html>
      <head>
        <meta name="description" content="" />
      </head>
      <body>
        <h1 id="appTitle"></h1>
        <p id="appDescription"></p>
        <h2 id="base64Title"></h2>
        <p id="base64Count"></p>
        <textarea id="base64Text"></textarea>
        <h2 id="plainTitle"></h2>
        <p id="plainCount"></p>
        <textarea id="plainText"></textarea>
        <button id="convertBtn" type="button"></button>
        <button id="copyBase64Btn" type="button"></button>
        <button id="copyPlainBtn" type="button"></button>
        <button id="clearBtn" type="button"></button>
        <a id="howToLink" href="/how-to-use.html"></a>
        <a id="privacyLink" href="/privacy.html"></a>
        <p id="statusMessage"></p>
      </body>
    </html>`,
    { url: "https://example.test" }
  );

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  globalThis.Event = dom.window.Event;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.btoa = dom.window.btoa.bind(dom.window);
  globalThis.atob = dom.window.atob.bind(dom.window);
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;

  Object.defineProperty(globalThis.navigator, "language", {
    value: language,
    configurable: true,
  });
  Object.defineProperty(globalThis.navigator, "languages", {
    value: [language],
    configurable: true,
  });

  const clipboard = {
    writeText: async () => {},
    readText: async () => "",
  };
  globalThis.navigator.clipboard = clipboard;

  return dom;
}

describe("フロント変換処理", () => {
  let fetchCalls;

  beforeEach(async () => {
    createTestDom("ja-JP");
    fetchCalls = [];
    globalThis.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return { ok: true };
    };

    await import(`${appFileUrl}?test=${Date.now()}`);
  });

  it("平文入力で変換ボタン押下時にBase64と平文が表示される", () => {
    const plain = document.getElementById("plainText");
    const base64 = document.getElementById("base64Text");
    const convertBtn = document.getElementById("convertBtn");

    plain.value = "こんにちは";
    plain.dispatchEvent(new Event("input", { bubbles: true }));
    convertBtn.click();

    expect(base64.value).to.equal("44GT44KT44Gr44Gh44Gv");
    expect(plain.value).to.equal("こんにちは");
  });

  it("Base64入力で変換ボタン押下時に平文とBase64が表示される", () => {
    const plain = document.getElementById("plainText");
    const base64 = document.getElementById("base64Text");
    const convertBtn = document.getElementById("convertBtn");

    base64.value = "44GT44KT44Gr44Gh44Gv";
    base64.dispatchEvent(new Event("input", { bubbles: true }));
    convertBtn.click();

    expect(plain.value).to.equal("こんにちは");
    expect(base64.value).to.equal("44GT44KT44Gr44Gh44Gv");
  });

  it("不正なBase64入力時はエラー表示になる", () => {
    const base64 = document.getElementById("base64Text");
    const status = document.getElementById("statusMessage");
    const convertBtn = document.getElementById("convertBtn");

    base64.value = "###invalid###";
    base64.dispatchEvent(new Event("input", { bubbles: true }));
    convertBtn.click();

    expect(status.textContent).to.equal("Base64 の形式が正しくありません。");
  });

  it("変換ボタン押下時に平文側がDB送信用としてPOSTされる", async () => {
    const plain = document.getElementById("plainText");
    const convertBtn = document.getElementById("convertBtn");
    const uniquePlaintext = `plain-${Date.now()}`;

    plain.value = uniquePlaintext;
    plain.dispatchEvent(new Event("input", { bubbles: true }));
    convertBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchCalls.length).to.equal(1);
    expect(fetchCalls[0].url).to.equal("/api/log");

    const payload = JSON.parse(fetchCalls[0].options.body);
    expect(payload.direction).to.equal("encode");
    expect(payload.plaintext).to.equal(uniquePlaintext);
  });

  it("ブラウザが日本語以外なら英語表示になる", async () => {
    createTestDom("en-US");
    fetchCalls = [];
    globalThis.fetch = async () => ({ ok: true });

    await import(`${appFileUrl}?test=${Date.now()}-en`);

    const title = document.getElementById("appTitle");
    const convertBtn = document.getElementById("convertBtn");

    expect(title.textContent).to.equal("Base64 Converter");
    expect(convertBtn.textContent).to.equal("Convert");
  });
});
