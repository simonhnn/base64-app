import { expect } from "chai";
import { JSDOM } from "jsdom";
import path from "path";
import { pathToFileURL } from "url";

const toolsFileUrl = pathToFileURL(path.resolve("public/tools.js")).href;

function setupDom() {
  const dom = new JSDOM(
    `<!doctype html>
    <html lang="ja-JP">
      <body>
        <input id="mcMembers" value="100" />
        <input id="mcPrice" value="490" />
        <input id="mcFee" value="30" />
        <span id="mcNet"></span>
        <span id="mcFeeAmount"></span>
        <span id="mcYear"></span>
        <button type="button" data-mc-fee="50"></button>
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

describe("メンバーシップ収益 計算機", () => {
  beforeEach(async () => {
    setupDom();
    globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
    await import(`${toolsFileUrl}?test=${Date.now()}`);
  });

  it("初期表示で手取り・手数料・年間が計算される（100人×490円×30%）", () => {
    expect(document.getElementById("mcNet").textContent).to.equal("¥34,300");
    expect(document.getElementById("mcFeeAmount").textContent).to.equal("¥14,700");
    expect(document.getElementById("mcYear").textContent).to.equal("¥411,600");
  });

  it("会員数を変えると再計算される", () => {
    const members = document.getElementById("mcMembers");
    members.value = "200";
    fire(members);
    expect(document.getElementById("mcNet").textContent).to.equal("¥68,600");
  });

  it("プリセットで手数料率が入り再計算される", () => {
    document.querySelector("[data-mc-fee='50']").click();
    expect(document.getElementById("mcFee").value).to.equal("50");
    expect(document.getElementById("mcNet").textContent).to.equal("¥24,500");
  });

  it("入力が空だと — 表示になる", () => {
    const price = document.getElementById("mcPrice");
    price.value = "";
    fire(price);
    expect(document.getElementById("mcNet").textContent).to.equal("—");
  });
});
