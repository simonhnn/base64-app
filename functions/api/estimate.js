// チャンネル URL から公開統計を取得して返す API（予想収益の"元データ"を渡すだけ）。
//
// 方針:
//   - 取得は各プラットフォームの「公式 API」のみ。HTML スクレイピングはしない。
//   - API キー/シークレットは Cloudflare の環境変数に置く（クライアントに出さない）。
//       YOUTUBE_API_KEY
//       TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET
//       TWITCASTING_CLIENT_ID / TWITCASTING_CLIENT_SECRET
//   - キー未設定・取得失敗時は { available:false } を返し、フロント側は手動入力に切り替える。
//   - 収益額そのものはここでは計算しない（フロントで係数を掛けて概算する）。

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const PRUNE_THRESHOLD = 5000;
const requestCounters = new Map();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() },
  });
}

function clientIp(request) {
  const v =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown";
  return v.split(",")[0].trim();
}

function rateLimited(ip) {
  const now = Date.now();
  if (requestCounters.size >= PRUNE_THRESHOLD) {
    for (const [k, r] of requestCounters) {
      if (now - r.windowStart >= WINDOW_MS) requestCounters.delete(k);
    }
  }
  const rec = requestCounters.get(ip);
  if (!rec || now - rec.windowStart >= WINDOW_MS) {
    requestCounters.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (rec.count >= MAX_REQUESTS_PER_WINDOW) return true;
  rec.count += 1;
  return false;
}

// URL から { platform, kind, value } を判定する。
export function parseChannelUrl(input) {
  let url;
  try {
    url = new URL(String(input).trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const segs = url.pathname.split("/").filter(Boolean);

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    if (segs[0] && segs[0].startsWith("@")) return { platform: "youtube", kind: "handle", value: segs[0] };
    if (segs[0] === "channel" && segs[1]) return { platform: "youtube", kind: "id", value: segs[1] };
    if (segs[0] === "user" && segs[1]) return { platform: "youtube", kind: "username", value: segs[1] };
    if (segs[0] === "c" && segs[1]) return { platform: "youtube", kind: "handle", value: "@" + segs[1] };
    if (segs[0]) return { platform: "youtube", kind: "handle", value: "@" + segs[0].replace(/^@/, "") };
    return null;
  }
  if (host === "twitch.tv") {
    if (segs[0]) return { platform: "twitch", kind: "login", value: segs[0].toLowerCase() };
    return null;
  }
  if (host === "twitcasting.tv") {
    if (segs[0]) return { platform: "twitcasting", kind: "user", value: decodeURIComponent(segs[0]) };
    return null;
  }
  return null;
}

async function fetchYouTube(target, env) {
  const key = env.YOUTUBE_API_KEY;
  if (!key) return { available: false, reason: "not_configured" };

  const base = "https://www.googleapis.com/youtube/v3";
  const params = new URLSearchParams({ part: "statistics,snippet,contentDetails", key });
  if (target.kind === "id") params.set("id", target.value);
  else if (target.kind === "username") params.set("forUsername", target.value);
  else params.set("forHandle", target.value); // handle

  const res = await fetch(`${base}/channels?${params}`);
  if (!res.ok) return { available: false, reason: "api_error" };
  const data = await res.json();
  const ch = data.items && data.items[0];
  if (!ch) return { available: false, reason: "not_found" };

  const stats = ch.statistics || {};
  const result = {
    available: true,
    platform: "youtube",
    name: ch.snippet?.title || null,
    subscribers: stats.hiddenSubscriberCount ? null : Number(stats.subscriberCount ?? 0),
    totalViews: Number(stats.viewCount ?? 0),
    videoCount: Number(stats.videoCount ?? 0),
    views30d: null,
  };

  // 直近30日に公開された動画の再生数合計を「月間再生数」の目安として取得する。
  try {
    const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
    if (uploads) {
      const pl = new URLSearchParams({ part: "contentDetails", playlistId: uploads, maxResults: "50", key });
      const plRes = await fetch(`${base}/playlistItems?${pl}`);
      if (plRes.ok) {
        const plData = await plRes.json();
        const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const recentIds = (plData.items || [])
          .filter((it) => Date.parse(it.contentDetails?.videoPublishedAt || 0) >= since)
          .map((it) => it.contentDetails?.videoId)
          .filter(Boolean)
          .slice(0, 50);
        if (recentIds.length) {
          const vp = new URLSearchParams({ part: "statistics", id: recentIds.join(","), key });
          const vRes = await fetch(`${base}/videos?${vp}`);
          if (vRes.ok) {
            const vData = await vRes.json();
            result.views30d = (vData.items || []).reduce(
              (sum, v) => sum + Number(v.statistics?.viewCount ?? 0),
              0
            );
          }
        } else {
          result.views30d = 0;
        }
      }
    }
  } catch {
    /* 月間再生数の取得失敗はフロントの手動入力で補える */
  }

  return result;
}

async function fetchTwitch(target, env) {
  const id = env.TWITCH_CLIENT_ID;
  const secret = env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return { available: false, reason: "not_configured", platform: "twitch" };

  try {
    const tokRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
      { method: "POST" }
    );
    if (!tokRes.ok) return { available: false, reason: "api_error", platform: "twitch" };
    const tok = await tokRes.json();
    const headers = { "Client-Id": id, Authorization: `Bearer ${tok.access_token}` };

    const uRes = await fetch(
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(target.value)}`,
      { headers }
    );
    if (!uRes.ok) return { available: false, reason: "api_error", platform: "twitch" };
    const uData = await uRes.json();
    const user = uData.data && uData.data[0];
    if (!user) return { available: false, reason: "not_found", platform: "twitch" };

    // フォロワー総数（アプリトークンで total のみ取得できる場合がある）。
    let followers = null;
    try {
      const fRes = await fetch(
        `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${user.id}`,
        { headers }
      );
      if (fRes.ok) followers = Number((await fRes.json()).total ?? 0) || null;
    } catch {
      /* 取得できなければ手動入力 */
    }

    return {
      available: true,
      platform: "twitch",
      name: user.display_name || user.login || null,
      followers,
      subscribers: null,
      views30d: null,
    };
  } catch {
    return { available: false, reason: "api_error", platform: "twitch" };
  }
}

async function fetchTwitcasting(target, env) {
  const id = env.TWITCASTING_CLIENT_ID;
  const secret = env.TWITCASTING_CLIENT_SECRET;
  if (!id || !secret) return { available: false, reason: "not_configured", platform: "twitcasting" };

  try {
    const basic = btoa(`${id}:${secret}`);
    const res = await fetch(
      `https://apiv2.twitcasting.tv/users/${encodeURIComponent(target.value)}`,
      {
        headers: {
          Authorization: `Basic ${basic}`,
          "X-Api-Version": "2.0",
          Accept: "application/json",
        },
      }
    );
    if (!res.ok) return { available: false, reason: "api_error", platform: "twitcasting" };
    const data = await res.json();
    const user = data.user;
    if (!user) return { available: false, reason: "not_found", platform: "twitcasting" };
    return {
      available: true,
      platform: "twitcasting",
      name: user.name || user.screen_id || null,
      supporterCount: Number(user.supporter_count ?? 0) || null,
      followers: null,
      views30d: null,
    };
  } catch {
    return { available: false, reason: "api_error", platform: "twitcasting" };
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (rateLimited(clientIp(request))) {
    return json({ error: "Too many requests" }, 429);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const target = parseChannelUrl(payload?.url);
  if (!target) {
    return json({ error: "unsupported_url" }, 400);
  }

  try {
    let result;
    if (target.platform === "youtube") result = await fetchYouTube(target, env);
    else if (target.platform === "twitch") result = await fetchTwitch(target, env);
    else result = await fetchTwitcasting(target, env);

    return json({ platform: target.platform, ...result });
  } catch {
    return json({ available: false, platform: target.platform, reason: "api_error" });
  }
}
