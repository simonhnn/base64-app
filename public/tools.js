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
      } catch {
        setStatus(status, t("urlDecodeError"), true);
      }
    });

    $("urlDecodeBtn")?.addEventListener("click", () => {
      if (overLimit(input.value, status)) return;
      try {
        output.value = decodeURIComponent(input.value.replace(/\+/g, " "));
        setStatus(status, t("urlDecoded"), false);
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
    });

    $("hashCopyBtn")?.addEventListener("click", () => copyValue(output.value, status));
    $("hashClearBtn")?.addEventListener("click", () => {
      input.value = "";
      output.value = "";
      setStatus(status, t("cleared"), false);
    });
  }

  initUrlTool();
  initJsonTool();
  initHashTool();
})();
