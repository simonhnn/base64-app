(() => {
  const MAX_LEN = 10000;
  const I18N = {
    ja: {
      pageTitle: "Base64 変換ツール",
      pageDescription:
        "テキストと Base64 を相互変換する無料ツールです。変換処理はブラウザで行います。",
      appTitle: "Base64 変換ツール",
      appDescription: "変換処理はブラウザで行います。",
      base64Title: "Base64",
      plainTitle: "平文",
      base64Placeholder: "ここに【Base64】を入力",
      plainPlaceholder: "ここに【平文】を入力",
      convert: "変換",
      copyBase64: "Base64 をコピー",
      copyPlain: "平文をコピー",
      clear: "クリア",
      howTo: "使い方",
      privacy: "プライバシーポリシー",
      converted: "変換しました。",
      noInput: "Base64 か平文のどちらかを入力してください。",
      inputLimit: "入力上限（10,000 文字）に達しています。",
      invalidBase64: "Base64 の形式が正しくありません。",
      copyBase64Done: "Base64 をコピーしました。",
      copyPlainDone: "平文をコピーしました。",
      copyFailed: "クリップボードへのコピーに失敗しました。",
      cleared: "入力と出力をクリアしました。",
    },
    en: {
      pageTitle: "Base64 Converter",
      pageDescription:
        "A free tool to convert text and Base64. Conversion is processed in your browser.",
      appTitle: "Base64 Converter",
      appDescription: "Conversion is processed in your browser.",
      base64Title: "Base64",
      plainTitle: "Plain text",
      base64Placeholder: "Enter [Base64] text here",
      plainPlaceholder: "Enter [plain text] here",
      convert: "Convert",
      copyBase64: "Copy Base64",
      copyPlain: "Copy plain text",
      clear: "Clear",
      howTo: "How to use",
      privacy: "Privacy policy",
      converted: "Converted.",
      noInput: "Please enter either Base64 or plain text.",
      inputLimit: "Input limit (10,000 characters) reached.",
      invalidBase64: "Invalid Base64 format.",
      copyBase64Done: "Base64 copied.",
      copyPlainDone: "Plain text copied.",
      copyFailed: "Failed to copy to clipboard.",
      cleared: "Input and output have been cleared.",
    },
  };

  const appTitle = document.getElementById("appTitle");
  const appDescription = document.getElementById("appDescription");
  const base64Title = document.getElementById("base64Title");
  const plainTitle = document.getElementById("plainTitle");
  const base64Text = document.getElementById("base64Text");
  const plainText = document.getElementById("plainText");
  const convertBtn = document.getElementById("convertBtn");
  const copyBase64Btn = document.getElementById("copyBase64Btn");
  const copyPlainBtn = document.getElementById("copyPlainBtn");
  const clearBtn = document.getElementById("clearBtn");
  const howToLink = document.getElementById("howToLink");
  const privacyLink = document.getElementById("privacyLink");
  const statusMessage = document.getElementById("statusMessage");

  let lastEdited = "plain";
  const sentLogKeys = new Set();

  function detectLocale() {
    const candidates = Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language || "en"];
    const isJapanese = candidates.some((lang) => String(lang).toLowerCase().startsWith("ja"));
    return isJapanese ? "ja" : "en";
  }

  const locale = detectLocale();

  function t(key) {
    return I18N[locale][key] ?? I18N.en[key] ?? key;
  }

  function setStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", isError);
  }


  function applyLanguage() {
    document.documentElement.lang = locale;
    document.title = t("pageTitle");

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", t("pageDescription"));
    }

    appTitle.textContent = t("appTitle");
    appDescription.textContent = t("appDescription");
    base64Title.textContent = t("base64Title");
    plainTitle.textContent = t("plainTitle");
    base64Text.placeholder = t("base64Placeholder");
    plainText.placeholder = t("plainPlaceholder");
    convertBtn.textContent = t("convert");
    copyBase64Btn.setAttribute("aria-label", t("copyBase64"));
    copyBase64Btn.setAttribute("title", t("copyBase64"));
    copyPlainBtn.setAttribute("aria-label", t("copyPlain"));
    copyPlainBtn.setAttribute("title", t("copyPlain"));
    clearBtn.textContent = t("clear");
    howToLink.textContent = t("howTo");
    privacyLink.textContent = t("privacy");
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  function base64ToBytes(base64Value) {
    const binary = atob(base64Value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function encodeUtf8ToBase64(text) {
    const encoder = new TextEncoder();
    return bytesToBase64(encoder.encode(text));
  }

  function decodeBase64ToUtf8(base64Value) {
    const normalized = base64Value.replace(/\s+/g, "");
    const bytes = base64ToBytes(normalized);
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return decoder.decode(bytes);
  }

  async function logConversion(direction, plainValue) {
    if (!plainValue) {
      return;
    }

    const key = `${direction}:${plainValue}`;
    if (sentLogKeys.has(key)) {
      return;
    }

    try {
      const response = await fetch("/api/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ direction, plaintext: plainValue }),
        keepalive: true,
      });

      if (!response.ok) {
        return;
      }

      sentLogKeys.add(key);
    } catch {
      return;
    }
  }

  function validateLength() {
    const tooLong = base64Text.value.length > MAX_LEN || plainText.value.length > MAX_LEN;
    if (tooLong) {
      setStatus(t("inputLimit"), true);
      return false;
    }
    return true;
  }

  async function handleConvert() {
    if (!validateLength()) {
      return;
    }

    const hasBase64 = Boolean(base64Text.value.trim());
    const hasPlain = Boolean(plainText.value.trim());

    if (!hasBase64 && !hasPlain) {
      setStatus(t("noInput"), true);
      return;
    }

    try {
      if (lastEdited === "base64" && hasBase64) {
        const plainValue = decodeBase64ToUtf8(base64Text.value);
        plainText.value = plainValue;
        await logConversion("decode", plainValue);
      } else {
        const base64Value = encodeUtf8ToBase64(plainText.value);
        base64Text.value = base64Value;
        await logConversion("encode", plainText.value);
      }
      setStatus(t("converted"), false);
    } catch {
      setStatus(t("invalidBase64"), true);
    }
  }

  async function copyText(value, doneMessage) {
    if (!value) {
      setStatus(t("noInput"), true);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setStatus(doneMessage, false);
    } catch {
      setStatus(t("copyFailed"), true);
    }
  }

  function clearAll() {
    base64Text.value = "";
    plainText.value = "";
    setStatus(t("cleared"), false);
  }

  base64Text.addEventListener("input", () => {
    lastEdited = "base64";
    setStatus("", false);
  });

  plainText.addEventListener("input", () => {
    lastEdited = "plain";
    setStatus("", false);
  });

  convertBtn.addEventListener("click", handleConvert);
  copyBase64Btn.addEventListener("click", () => copyText(base64Text.value, t("copyBase64Done")));
  copyPlainBtn.addEventListener("click", () => copyText(plainText.value, t("copyPlainDone")));
  clearBtn.addEventListener("click", clearAll);

  applyLanguage();
})();
