import { expect } from "chai";
import fetchPackage from "node-fetch";
import path from "path";
import { pathToFileURL } from "url";

const { Request, Response, Headers } = fetchPackage;

globalThis.Request = Request;
globalThis.Response = Response;
globalThis.Headers = Headers;

const moduleUrl = pathToFileURL(path.resolve("functions/_middleware.js")).href;
const { onRequest } = await import(`${moduleUrl}?test=${Date.now()}`);

// next() は静的アセット配信の代わりに、200 の JA ページを返すスタブ。
function createNext() {
  return async () =>
    new Response("<html lang=\"ja\">…</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
}

function buildRequest(pathname, headers = {}) {
  return new Request(`https://example.com${pathname}`, { headers });
}

async function run(pathname, headers = {}) {
  const request = buildRequest(pathname, headers);
  return onRequest({ request, next: createNext() });
}

describe("_middleware 言語振り分け", () => {
  it("日本語以外の訪問者はトップから /en/ へ302リダイレクトする", async () => {
    const response = await run("/", { "Accept-Language": "en-US,en;q=0.9" });

    expect(response.status).to.equal(302);
    expect(response.headers.get("Location")).to.equal("https://example.com/en/");
    expect(response.headers.get("Set-Cookie")).to.contain("lang=en");
    expect(response.headers.get("Vary")).to.contain("Accept-Language");
  });

  it("配下のコンテンツページも対応する英語版へ振り分ける", async () => {
    const response = await run("/faq.html", { "Accept-Language": "fr-FR,fr;q=0.9" });

    expect(response.status).to.equal(302);
    expect(response.headers.get("Location")).to.equal("https://example.com/en/faq.html");
  });

  it("日本語を希望する訪問者はリダイレクトせず日本語ページを返す", async () => {
    const response = await run("/", { "Accept-Language": "ja,en-US;q=0.9,en;q=0.8" });

    expect(response.status).to.equal(200);
    expect(response.headers.get("Vary")).to.contain("Accept-Language");
  });

  it("lang クッキーがあれば（振り分け済み/手動選択）リダイレクトしない", async () => {
    const response = await run("/", {
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: "lang=en",
    });

    expect(response.status).to.equal(200);
  });

  it("?lang=ja が付いていれば日本語を返し lang=ja クッキーを付与する", async () => {
    const response = await run("/?lang=ja", { "Accept-Language": "en-US,en;q=0.9" });

    expect(response.status).to.equal(200);
    expect(response.headers.get("Set-Cookie")).to.contain("lang=ja");
  });

  it("検索エンジンのクローラーはリダイレクトしない", async () => {
    const response = await run("/", {
      "Accept-Language": "en-US",
      "User-Agent":
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    });

    expect(response.status).to.equal(200);
  });

  it("マッピング外のパス（/en/ やアセット）は素通しする", async () => {
    const response = await run("/en/", { "Accept-Language": "en-US" });

    expect(response.status).to.equal(200);
    // 素通しなので Vary は付与しない。
    expect(response.headers.get("Vary")).to.equal(null);
  });

  it("Accept-Language が無い訪問者は英語へ振り分ける", async () => {
    const response = await run("/", {});

    expect(response.status).to.equal(302);
    expect(response.headers.get("Location")).to.equal("https://example.com/en/");
  });
});
