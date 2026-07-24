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
        <input id="scAmount" value="10000" />
        <input id="scFee" value="30" />
        <input id="scTarget" value="" />
        <span id="scNet"></span>
        <span id="scFeeAmount"></span>
        <span id="scNetRate"></span>
        <span id="scGross"></span>
        <button type="button" data-fee="45"></button>
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
  globalThis.navigator.clipboard = { writeText: async () => {} };
  return dom;
}

function fire(el, type = "input") {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

describe("スパチャ手取り計算機", () => {
  beforeEach(async () => {
    setupDom();
    globalThis.fetch = async () => ({ ok: true });
    await import(`${toolsFileUrl}?test=${Date.now()}`);
  });

  it("初期表示で手取り・手数料・手取り率が計算される（1万円・30%）", () => {
    expect(document.getElementById("scNet").textContent).to.equal("7,000");
    expect(document.getElementById("scFeeAmount").textContent).to.equal("3,000");
    expect(document.getElementById("scNetRate").textContent).to.equal("70.0");
  });

  it("手数料率を変更すると手取りが再計算される", () => {
    const fee = document.getElementById("scFee");
    fee.value = "50";
    fire(fee);
    expect(document.getElementById("scNet").textContent).to.equal("5,000");
    expect(document.getElementById("scFeeAmount").textContent).to.equal("5,000");
    expect(document.getElementById("scNetRate").textContent).to.equal("50.0");
  });

  it("プリセットボタンで手数料率が入力され再計算される", () => {
    document.querySelector("[data-fee='45']").click();
    expect(document.getElementById("scFee").value).to.equal("45");
    expect(document.getElementById("scNet").textContent).to.equal("5,500");
  });

  it("目標手取りから必要な投げ銭額を逆算する（手取り7000・30%→10000）", () => {
    const target = document.getElementById("scTarget");
    target.value = "7000";
    fire(target);
    expect(document.getElementById("scGross").textContent).to.equal("10,000");
  });

  it("手数料率100%では逆算できず — と表示する", () => {
    const fee = document.getElementById("scFee");
    fee.value = "100";
    fire(fee);
    const target = document.getElementById("scTarget");
    target.value = "1000";
    fire(target);
    expect(document.getElementById("scGross").textContent).to.equal("—");
  });

  it("金額が不正でも手取り率は表示される", () => {
    const amount = document.getElementById("scAmount");
    amount.value = "";
    fire(amount);
    expect(document.getElementById("scNet").textContent).to.equal("—");
    expect(document.getElementById("scNetRate").textContent).to.equal("70.0");
  });
});
