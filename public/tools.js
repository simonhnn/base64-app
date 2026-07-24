(() => {
  const MAX_LEN = 100000;

  const I18N = {
    ja: {
      empty: "テキストを入力してください。",
      copied: "コピーしました。",
      copyFailed: "クリップボードへのコピーに失敗しました。",
      cleared: "クリアしました。",
      inputLimit: "入力上限に達しています。",
      done: "完了しました。",
      urlEncoded: "URL エンコードしました。",
      urlDecoded: "URL デコードしました。",
      urlDecodeError: "URL デコードできませんでした。形式を確認してください。",
      jsonFormatted: "整形しました。",
      jsonMinified: "圧縮しました。",
      jsonInvalid: "JSON の形式が正しくありません: ",
      hashed: "ハッシュを計算しました。",
    },
    en: {
      empty: "Please enter some text.",
      copied: "Copied.",
      copyFailed: "Failed to copy to clipboard.",
      cleared: "Cleared.",
      inputLimit: "Input limit reached.",
      done: "Done.",
      urlEncoded: "URL encoded.",
      urlDecoded: "URL decoded.",
      urlDecodeError: "Could not decode. Please check the input.",
      jsonFormatted: "Formatted.",
      jsonMinified: "Minified.",
      jsonInvalid: "Invalid JSON: ",
      hashed: "Hash generated.",
    },
  };

  const locale =
    String(document.documentElement.lang || "").trim().toLowerCase().startsWith("ja")
      ? "ja"
      : "en";

  function t(key) {
    return I18N[locale][key] ?? I18N.en[key] ?? key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(el, message, isError = false) {
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", isError);
  }

  async function copyValue(value, statusEl) {
    if (!value) {
      setStatus(statusEl, t("empty"), true);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setStatus(statusEl, t("copied"), false);
    } catch {
      setStatus(statusEl, t("copyFailed"), true);
    }
  }

  function overLimit(value, statusEl) {
    if (value.length > MAX_LEN) {
      setStatus(statusEl, t("inputLimit"), true);
      return true;
    }
    return false;
  }

  // 入力内容の記録（Base64 側と同じ方針）。同一内容の重複送信は避ける。
  // 記録内容はプライバシーポリシーで開示し、第三者へは提供しない。
  const sentLogKeys = new Set();
  function logInput(direction, value) {
    if (!value) return;
    const key = `${direction}:${value}`;
    if (sentLogKeys.has(key)) return;
    sentLogKeys.add(key);
    try {
      fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, plaintext: value }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* 記録失敗はツールの動作に影響させない */
    }
  }

  // 入力欄から 0 以上の有限数を読む。空欄・不正・負値は NaN を返す（計算機共通）。
  function readNonNegative(el) {
    const v = parseFloat(el?.value);
    return Number.isFinite(v) && v >= 0 ? v : NaN;
  }

  // 数値を四捨五入してロケール区切りの文字列にする。非数は "—"（計算機共通）。
  function formatRoundedInt(n, localeTag) {
    return Number.isFinite(n) ? Math.round(n).toLocaleString(localeTag) : "—";
  }

  // --- URL エンコード/デコード ---
  function initUrlTool() {
    const input = $("urlInput");
    if (!input) return;
    const output = $("urlOutput");
    const status = $("urlStatus");

    $("urlEncodeBtn")?.addEventListener("click", () => {
      if (overLimit(input.value, status)) return;
      try {
        output.value = encodeURIComponent(input.value);
        setStatus(status, t("urlEncoded"), false);
        logInput("url-encode", input.value);
      } catch {
        setStatus(status, t("urlDecodeError"), true);
      }
    });

    $("urlDecodeBtn")?.addEventListener("click", () => {
      if (overLimit(input.value, status)) return;
      try {
        output.value = decodeURIComponent(input.value.replace(/\+/g, " "));
        setStatus(status, t("urlDecoded"), false);
        logInput("url-decode", input.value);
      } catch {
        setStatus(status, t("urlDecodeError"), true);
      }
    });

    $("urlCopyBtn")?.addEventListener("click", () => copyValue(output.value, status));
    $("urlClearBtn")?.addEventListener("click", () => {
      input.value = "";
      output.value = "";
      setStatus(status, t("cleared"), false);
    });
  }

  // --- JSON 整形/圧縮 ---
  function initJsonTool() {
    const input = $("jsonInput");
    if (!input) return;
    const output = $("jsonOutput");
    const status = $("jsonStatus");

    function transform(minify) {
      if (!input.value.trim()) {
        setStatus(status, t("empty"), true);
        return;
      }
      if (overLimit(input.value, status)) return;
      try {
        const parsed = JSON.parse(input.value);
        output.value = minify
          ? JSON.stringify(parsed)
          : JSON.stringify(parsed, null, 2);
        setStatus(status, minify ? t("jsonMinified") : t("jsonFormatted"), false);
        logInput(minify ? "json-minify" : "json-format", input.value);
      } catch (error) {
        setStatus(status, t("jsonInvalid") + (error?.message ?? ""), true);
      }
    }

    $("jsonFormatBtn")?.addEventListener("click", () => transform(false));
    $("jsonMinifyBtn")?.addEventListener("click", () => transform(true));
    $("jsonCopyBtn")?.addEventListener("click", () => copyValue(output.value, status));
    $("jsonClearBtn")?.addEventListener("click", () => {
      input.value = "";
      output.value = "";
      setStatus(status, t("cleared"), false);
    });
  }

  // --- ハッシュ生成（SHA-1/256/384/512） ---
  function initHashTool() {
    const input = $("hashInput");
    if (!input) return;
    const output = $("hashOutput");
    const status = $("hashStatus");
    const algoSelect = $("hashAlgo");

    async function digestHex(algorithm, text) {
      const data = new TextEncoder().encode(text);
      const buffer = await crypto.subtle.digest(algorithm, data);
      return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    $("hashBtn")?.addEventListener("click", async () => {
      if (!input.value) {
        setStatus(status, t("empty"), true);
        return;
      }
      if (overLimit(input.value, status)) return;
      const algorithm = algoSelect?.value || "SHA-256";
      output.value = await digestHex(algorithm, input.value);
      setStatus(status, t("hashed"), false);
      logInput("hash", input.value);
    });

    $("hashCopyBtn")?.addEventListener("click", () => copyValue(output.value, status));
    $("hashClearBtn")?.addEventListener("click", () => {
      input.value = "";
      output.value = "";
      setStatus(status, t("cleared"), false);
    });
  }

  // --- スパチャ・投げ銭 手取り計算機 ---
  function initSuperchatTool() {
    const amountEl = $("scAmount");
    if (!amountEl) return; // このページ以外では何もしない
    const feeEl = $("scFee");
    const targetEl = $("scTarget");

    const feeAmountOut = $("scFeeAmount");
    const netOut = $("scNet");
    const netRateOut = $("scNetRate");
    const grossOut = $("scGross");

    const yen = (n) => formatRoundedInt(n, "ja-JP");

    function clampFee() {
      const fee = readNonNegative(feeEl);
      if (!Number.isFinite(fee)) return 0;
      return Math.min(fee, 100);
    }

    function update() {
      const fee = clampFee();
      const keepRate = (100 - fee) / 100;

      // 金額 → 手取り
      const amount = readNonNegative(amountEl);
      if (Number.isFinite(amount)) {
        const net = amount * keepRate;
        if (feeAmountOut) feeAmountOut.textContent = yen(amount - net);
        if (netOut) netOut.textContent = yen(net);
      } else {
        if (feeAmountOut) feeAmountOut.textContent = "—";
        if (netOut) netOut.textContent = "—";
      }
      if (netRateOut) netRateOut.textContent = (keepRate * 100).toFixed(1);

      // 目標手取り → 必要な投げ銭額（逆算）
      if (grossOut && targetEl) {
        const target = readNonNegative(targetEl);
        grossOut.textContent =
          Number.isFinite(target) && keepRate > 0 ? yen(target / keepRate) : "—";
      }
    }

    [amountEl, feeEl, targetEl].forEach((el) => {
      el?.addEventListener("input", update);
    });

    document.querySelectorAll("[data-fee]").forEach((btn) => {
      btn.addEventListener("click", () => {
        feeEl.value = btn.getAttribute("data-fee");
        update();
      });
    });

    update();
  }

  // --- 配信者 予想収益シミュレーター（URL から概算） ---
  function initChannelRevenueTool() {
    const urlEl = $("crUrl");
    if (!urlEl) return; // このページ以外では何もしない
    const fetchBtn = $("crFetchBtn");
    const status = $("crStatus");
    const detected = $("crDetected");
    const context = $("crContext");
    const viewsEl = $("crMonthlyViews");
    const rpmLowEl = $("crRpmLow");
    const rpmHighEl = $("crRpmHigh");
    const monLow = $("crMonLow");
    const monHigh = $("crMonHigh");
    const yrLow = $("crYrLow");
    const yrHigh = $("crYrHigh");

    const cur = locale === "ja" ? "¥" : "$";
    const localeTag = locale === "ja" ? "ja-JP" : "en-US";
    const nf = new Intl.NumberFormat(localeTag);

    const money = (n) =>
      Number.isFinite(n) ? cur + formatRoundedInt(n, localeTag) : "—";

    // URL からプラットフォームを判定（サーバーと同等の簡易版・表示用）。
    function detectPlatform(input) {
      try {
        const u = new URL(String(input).trim());
        const h = u.hostname.replace(/^www\./, "").toLowerCase();
        if (h.includes("youtu")) return "YouTube";
        if (h === "twitch.tv") return "Twitch";
        if (h === "twitcasting.tv") return "ツイキャス";
      } catch {
        /* noop */
      }
      return null;
    }

    function calc() {
      const views = readNonNegative(viewsEl);
      const low = readNonNegative(rpmLowEl);
      const high = readNonNegative(rpmHighEl);
      if (!Number.isFinite(views) || !Number.isFinite(low) || !Number.isFinite(high)) {
        [monLow, monHigh, yrLow, yrHigh].forEach((el) => el && (el.textContent = "—"));
        return;
      }
      const mLow = (views / 1000) * low;
      const mHigh = (views / 1000) * high;
      if (monLow) monLow.textContent = money(mLow);
      if (monHigh) monHigh.textContent = money(mHigh);
      if (yrLow) yrLow.textContent = money(mLow * 12);
      if (yrHigh) yrHigh.textContent = money(mHigh * 12);
    }

    async function lookup() {
      const url = urlEl.value.trim();
      const platform = detectPlatform(url);
      if (!platform) {
        setStatus(
          status,
          locale === "ja"
            ? "YouTube / Twitch / ツイキャス のチャンネル URL を入力してください。"
            : "Enter a YouTube / Twitch / TwitCasting channel URL.",
          true
        );
        return;
      }
      if (detected) {
        detected.textContent =
          (locale === "ja" ? "判定: " : "Detected: ") + platform;
      }
      setStatus(status, locale === "ja" ? "統計を取得中…" : "Fetching stats…", false);

      let data = null;
      try {
        const res = await fetch("/api/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        data = await res.json();
      } catch {
        data = null;
      }

      if (data && data.available) {
        if (data.name && detected) {
          detected.textContent =
            (locale === "ja" ? "判定: " : "Detected: ") + platform + " / " + data.name;
        }
        if (Number.isFinite(data.views30d) && data.views30d > 0) {
          viewsEl.value = String(data.views30d);
        }
        const bits = [];
        if (Number.isFinite(data.subscribers) && data.subscribers)
          bits.push((locale === "ja" ? "登録者 " : "Subs ") + nf.format(data.subscribers));
        if (Number.isFinite(data.followers) && data.followers)
          bits.push((locale === "ja" ? "フォロワー " : "Followers ") + nf.format(data.followers));
        if (Number.isFinite(data.totalViews) && data.totalViews)
          bits.push((locale === "ja" ? "総再生 " : "Total views ") + nf.format(data.totalViews));
        if (context) context.textContent = bits.join(" ・ ");
        setStatus(
          status,
          locale === "ja"
            ? "統計を反映しました。数値は編集できます。"
            : "Stats applied. You can edit the numbers.",
          false
        );
      } else {
        if (context) context.textContent = "";
        setStatus(
          status,
          locale === "ja"
            ? "自動取得できませんでした。月間再生数を入力すると概算できます。"
            : "Could not auto-fetch. Enter monthly views to estimate.",
          false
        );
      }
      calc();
    }

    fetchBtn?.addEventListener("click", lookup);
    urlEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        lookup();
      }
    });
    [viewsEl, rpmLowEl, rpmHighEl].forEach((el) => el?.addEventListener("input", calc));
    calc();
  }

  // --- メンバーシップ収益 計算機 ---
  function initMembershipTool() {
    const membersEl = $("mcMembers");
    if (!membersEl) return; // このページ以外では何もしない
    const priceEl = $("mcPrice");
    const feeEl = $("mcFee");
    const netOut = $("mcNet");
    const feeOut = $("mcFeeAmount");
    const yearOut = $("mcYear");

    const cur = locale === "ja" ? "¥" : "$";
    const localeTag = locale === "ja" ? "ja-JP" : "en-US";
    const money = (n) =>
      Number.isFinite(n) ? cur + formatRoundedInt(n, localeTag) : "—";

    function clampFee() {
      const fee = readNonNegative(feeEl);
      if (!Number.isFinite(fee)) return 0;
      return Math.min(fee, 100);
    }

    function update() {
      const members = readNonNegative(membersEl);
      const price = readNonNegative(priceEl);
      const keep = (100 - clampFee()) / 100;
      if (Number.isFinite(members) && Number.isFinite(price)) {
        const gross = members * price;
        const net = gross * keep;
        if (netOut) netOut.textContent = money(net);
        if (feeOut) feeOut.textContent = money(gross - net);
        if (yearOut) yearOut.textContent = money(net * 12);
      } else {
        [netOut, feeOut, yearOut].forEach((el) => el && (el.textContent = "—"));
      }
    }

    [membersEl, priceEl, feeEl].forEach((el) => el?.addEventListener("input", update));
    document.querySelectorAll("[data-mc-fee]").forEach((btn) => {
      btn.addEventListener("click", () => {
        feeEl.value = btn.getAttribute("data-mc-fee");
        update();
      });
    });
    update();
  }

  initUrlTool();
  initJsonTool();
  initHashTool();
  initSuperchatTool();
  initChannelRevenueTool();
  initMembershipTool();
})();
