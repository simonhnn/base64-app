// 日本語以外のブラウザ設定で日本語ページ（サイトのルート側）へアクセスした
// 訪問者を、対応する英語ページ（/en/ 以下）へ振り分ける。
//
// 方針:
//   - 判定は Accept-Language ヘッダー（サーバー側）で行う。
//   - 302（一時リダイレクト）にして、検索エンジンには日英どちらも
//     正規URLとしてインデックスさせ続ける（hreflang と併用）。
//   - 一度振り分けた／手動で言語を選んだ訪問者には lang クッキーを付与し、
//     以降は自動リダイレクトしない（手動リンクでの言語切替を尊重する）。
//   - 検索エンジンのクローラーは振り分け対象から除外し、日本語ルートが
//     そのままインデックスされるようにする。

// 日本語ルートページ → 英語版のマッピング。ここに載っているパスだけが対象。
// Cloudflare Pages は /foo.html を /foo へ 308 正規化するため、実際に配信される
// クリーン URL（拡張子なし）をキー/値にする。旧 .html リンクは 308 で /foo に
// なってからこの middleware が振り分ける。
const JA_TO_EN = {
  "/": "/en/",
  "/how-to-use": "/en/how-to-use",
  "/faq": "/en/faq",
  "/privacy": "/en/privacy",
  "/tools": "/en/tools",
  "/url-encode": "/en/url-encode",
  "/json-format": "/en/json-format",
  "/hash": "/en/hash",
};

// 主要な検索エンジン/SNS のクローラーを判定する（振り分け対象外にする）。
const BOT_UA = /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|quora|pinterest|slackbot|telegrambot|whatsapp|discordbot|bingpreview|yandex|baiduspider|duckduckbot/i;

function prefersJapanese(acceptLanguage) {
  // "ja,en-US;q=0.9,en;q=0.8" のような値から ja 系が含まれるかを見る。
  return acceptLanguage
    .toLowerCase()
    .split(",")
    .some((part) => part.trim().startsWith("ja"));
}

function hasLangCookie(cookieHeader) {
  return /(?:^|;\s*)lang=/.test(cookieHeader);
}

// リダイレクトしないレスポンスにも Vary を付け、キャッシュが言語の異なる
// 訪問者へ誤った内容（リダイレクト有無）を返さないようにする。
function withVary(response) {
  const res = new Response(response.body, response);
  const existing = res.headers.get("Vary");
  res.headers.set(
    "Vary",
    existing ? `${existing}, Accept-Language, Cookie` : "Accept-Language, Cookie"
  );
  return res;
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const target = JA_TO_EN[url.pathname];

  // 対象の日本語ルートページ以外は素通し（CSS/JS/画像・/en/・/api なども含む）。
  if (!target) {
    return next();
  }

  // 言語切替リンク（例: /?lang=ja）で明示的に日本語が選ばれた場合は、
  // その意思を最優先し、cookie に記録したうえで日本語ページを返す。
  if (url.searchParams.get("lang") === "ja") {
    const response = withVary(await next());
    response.headers.append(
      "Set-Cookie",
      "lang=ja; Path=/; Max-Age=31536000; SameSite=Lax"
    );
    return response;
  }

  const cookieHeader = request.headers.get("Cookie") || "";
  const userAgent = request.headers.get("User-Agent") || "";
  const acceptLanguage = request.headers.get("Accept-Language") || "";

  // 既に言語が決まっている（過去に振り分け済み or 手動選択）／クローラー／
  // 日本語を希望する訪問者は、そのまま日本語ページを返す。
  if (
    hasLangCookie(cookieHeader) ||
    BOT_UA.test(userAgent) ||
    prefersJapanese(acceptLanguage)
  ) {
    return withVary(await next());
  }

  // 日本語以外の訪問者 → 英語版へ 302 リダイレクトし、以降は自動振り分け
  // しないよう lang クッキーを付与する。
  url.pathname = target;
  const redirect = new Response(null, { status: 302 });
  redirect.headers.set("Location", url.toString());
  redirect.headers.set("Vary", "Accept-Language, Cookie");
  redirect.headers.set(
    "Set-Cookie",
    "lang=en; Path=/; Max-Age=31536000; SameSite=Lax"
  );
  return redirect;
}
