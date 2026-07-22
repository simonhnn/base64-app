const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const requestCounters = new Map();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

function getClientIp(request) {
  const headerValue =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown";
  return headerValue.split(",")[0].trim();
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = requestCounters.get(ip);

  if (!record || now - record.windowStart >= WINDOW_MS) {
    requestCounters.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return jsonResponse({ error: "Too many requests" }, 429);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const direction = payload?.direction;
  const plaintext = payload?.plaintext;

  if (direction !== "encode" && direction !== "decode") {
    return jsonResponse({ error: "Invalid direction" }, 400);
  }

  if (typeof plaintext !== "string" || plaintext.length === 0 || plaintext.length > 10000) {
    return jsonResponse({ error: "Invalid plaintext length" }, 400);
  }

  try {
    await env.DB.prepare(
      "INSERT INTO conversion_logs (direction, plaintext) VALUES (?, ?)"
    )
      .bind(direction, plaintext)
      .run();
  } catch {
    return jsonResponse({ error: "DB insert failed" }, 500);
  }

  return jsonResponse({ ok: true }, 201);
}
