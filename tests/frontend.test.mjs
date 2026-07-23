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
        <textarea id="base64Text"></textarea>
        <h2 id="plainTitle"></h2>
        <textarea id="plainText"></textarea>
        <button id="convertBtn" type="button"><span id="convertLabel"></span></button>
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

  it("コピーアイコン押下で平文がクリップボードへ書き込まれる", async () => {
    const plain = document.getElementById("plainText");
    const copyPlainBtn = document.getElementById("copyPlainBtn");
    const status = document.getElementById("statusMessage");
    let copied = null;
    globalThis.navigator.clipboard.writeText = async (value) => {
      copied = value;
    };

    plain.value = "コピー対象";
    copyPlainBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(copied).to.equal("コピー対象");
    expect(status.textContent).to.equal("平文をコピーしました。");
  });

  it("入力が空の状態でコピー押下時は未入力エラーになる", async () => {
    const copyPlainBtn = document.getElementById("copyPlainBtn");
    const status = document.getElementById("statusMessage");

    copyPlainBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(status.textContent).to.equal("Base64 か平文のどちらかを入力してください。");
  });

  it("クリアボタンで両方の入力欄が空になる", () => {
    const plain = document.getElementById("plainText");
    const base64 = document.getElementById("base64Text");
    const clearBtn = document.getElementById("clearBtn");
    const status = document.getElementById("statusMessage");

    plain.value = "テキスト";
    base64.value = "eA==";
    clearBtn.click();

    expect(plain.value).to.equal("");
    expect(base64.value).to.equal("");
    expect(status.textContent).to.equal("入力と出力をクリアしました。");
  });

  it("Base64も平文も未入力で変換押下時はエラー表示になる", () => {
    const convertBtn = document.getElementById("convertBtn");
    const status = document.getElementById("statusMessage");

    convertBtn.click();

    expect(status.textContent).to.equal("Base64 か平文のどちらかを入力してください。");
  });

  it("入力上限を超えた状態で変換押下時はエラー表示になる", () => {
    const plain = document.getElementById("plainText");
    const convertBtn = document.getElementById("convertBtn");
    const status = document.getElementById("statusMessage");

    plain.value = "a".repeat(10001);
    plain.dispatchEvent(new Event("input", { bubbles: true }));
    convertBtn.click();

    expect(status.textContent).to.equal("入力上限（10,000 文字）に達しています。");
  });

  it("同一の平文を連続変換してもログ送信は1回だけ", async () => {
    const plain = document.getElementById("plainText");
    const convertBtn = document.getElementById("convertBtn");

    plain.value = "重複テスト";
    plain.dispatchEvent(new Event("input", { bubbles: true }));

    convertBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    convertBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchCalls.length).to.equal(1);
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

  it("ページのlang宣言がブラウザ言語より優先される（URL分離用）", async () => {
    // 日本語ブラウザでも、英語ページ(lang=en)なら英語表示になる
    createTestDom("ja-JP");
    document.documentElement.lang = "en";
    fetchCalls = [];
    globalThis.fetch = async () => ({ ok: true });

    await import(`${appFileUrl}?test=${Date.now()}-langattr`);

    const title = document.getElementById("appTitle");
    const convertBtn = document.getElementById("convertBtn");
    expect(title.textContent).to.equal("Base64 Converter");
    expect(convertBtn.textContent).to.equal("Convert");
  });

  it("WebMCP対応環境ではツールが登録され実行できる", async () => {
    createTestDom("ja-JP");
    fetchCalls = [];
    globalThis.fetch = async () => ({ ok: true });

    const registered = [];
    globalThis.navigator.modelContext = {
      registerTool: (tool) => registered.push(tool),
    };

    await import(`${appFileUrl}?test=${Date.now()}-mcp`);

    const names = registered.map((tool) => tool.name);
    expect(names).to.include.members([
      "encode_to_base64",
      "decode_from_base64",
      "clear_all",
    ]);

    const encodeTool = registered.find((tool) => tool.name === "encode_to_base64");
    expect(encodeTool.inputSchema.type).to.equal("object");
    expect(encodeTool.inputSchema.required).to.deep.equal(["text"]);

    const result = await encodeTool.execute({ text: "A" });
    expect(result.content[0].text).to.equal("QQ==");
  });
});
