import { expect } from "chai";
import fetchPackage from "node-fetch";
import path from "path";
import { pathToFileURL } from "url";

const { Request, Response, Headers } = fetchPackage;

globalThis.Request = Request;
globalThis.Response = Response;
globalThis.Headers = Headers;

const moduleUrl = pathToFileURL(path.resolve("functions/api/log.js")).href;
const { onRequest } = await import(`${moduleUrl}?test=${Date.now()}`);

function createEnv() {
  const inserts = [];

  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(direction, plaintext) {
            return {
              async run() {
                inserts.push({ sql, direction, plaintext });
                return { success: true };
              },
            };
          },
        };
      },
    },
  };

  return { env, inserts };
}

function buildRequest(body, ip = "198.51.100.1") {
  return new Request("https://example.com/api/log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("/api/log", () => {
  it("正常なPOSTでD1へINSERTして201を返す", async () => {
    const { env, inserts } = createEnv();
    const request = buildRequest({ direction: "encode", plaintext: "hello" }, "198.51.100.10");

    const response = await onRequest({ request, env });

    expect(response.status).to.equal(201);
    expect(inserts.length).to.equal(1);
    expect(inserts[0].direction).to.equal("encode");
    expect(inserts[0].plaintext).to.equal("hello");
  });

  it("POST以外は405を返す", async () => {
    const { env } = createEnv();
    const request = new Request("https://example.com/api/log", { method: "GET" });

    const response = await onRequest({ request, env });

    expect(response.status).to.equal(405);
  });

  it("directionが不正な場合は400を返す", async () => {
    const { env } = createEnv();
    const request = buildRequest({ direction: "other", plaintext: "text" }, "198.51.100.11");

    const response = await onRequest({ request, env });

    expect(response.status).to.equal(400);
  });

  it("plaintextが10000文字超過の場合は400を返す", async () => {
    const { env } = createEnv();
    const tooLong = "a".repeat(10001);
    const request = buildRequest({ direction: "encode", plaintext: tooLong }, "198.51.100.12");

    const response = await onRequest({ request, env });

    expect(response.status).to.equal(400);
  });

  it("同一IPの連続アクセスが上限超過時に429を返す", async () => {
    const { env } = createEnv();
    const ip = "198.51.100.13";
    let lastStatus = 0;

    for (let i = 0; i < 31; i += 1) {
      const request = buildRequest({ direction: "encode", plaintext: `t-${i}` }, ip);
      const response = await onRequest({ request, env });
      lastStatus = response.status;
    }

    expect(lastStatus).to.equal(429);
  });
});
