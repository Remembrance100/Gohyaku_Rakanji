// Bootstraps index.html: loads stop 0, applies saved settings, and sends the user into the tour.
const DATA_URL =
  "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/?rest_route=/memorial/v1/tour";

const entryLoadingOverlay = document.querySelector("#entryLoadingOverlay");
const entryHighlightLabel = document.querySelector("#entryHighlightLabel");
const entryVideo = document.querySelector("#entryVideo");
const entryUnmuteBtn = document.querySelector("#entryUnmuteBtn");
const entryUnmuteLabel = document.querySelector("#entryUnmuteLabel");
const entryUnmuteIcon = document.querySelector("#entryUnmuteIcon");
const entryTitle = document.querySelector("#entryTitle");
const entryHighlight = document.querySelector("#entryHighlight");
const entryText = document.querySelector("#entryText");
const entryGuideGallery = document.querySelector("#entryGuideGallery");
const entryGuideTrack = document.querySelector("#entryGuideTrack");
const entryGuideDots = document.querySelector("#entryGuideDots");
const entryStartBtn = document.querySelector("#entryStartBtn");

const fallbackStopZero = {
  number: "0",
  title:
    "800 Years of the Shimazu Family and the story of Japan's Modernization",
  highlight:
    "As you walk through the scenery before you, pause, ask questions, and search for answers as you go.",
  textBlocks: [
    "This journey traces more than 800 years of history.",
    "Step forward with curiosity and experience the site's living memory.",
  ],
  transcriptBlocks: [],
  videoUrl: "",
};

function disablePwa() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(
          registrations.map((registration) => registration.unregister()),
        ),
      )
      .catch(() => {});
  });
}

function safeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function resolveMediaUrl(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (value && typeof value === "object") {
    if (typeof value.url === "string" && value.url.trim()) {
      return value.url.trim();
    }
    if (typeof value.source_url === "string" && value.source_url.trim()) {
      return value.source_url.trim();
    }
  }
  return "";
}

function decodeEntities(value) {
  const input = safeText(value, "");
  if (!input) return "";
  const el = document.createElement("textarea");
  el.innerHTML = input;
  return el.value;
}

function decodeEntitiesDeep(value, maxPasses = 3) {
  let current = safeText(value, "");
  for (let i = 0; i < maxPasses; i += 1) {
    const next = decodeEntities(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

function replaceTermShortcodes(rawText) {
  let text = decodeEntitiesDeep(rawText);

  text = text.replace(
    /\[term\s+key=(['"])(.*?)\1\]?\s*([\s\S]*?)\[\/term\]/gi,
    (_match, _quote, _key, label) => safeText(label, ""),
  );

  text = text.replace(
    /\[term\s+key=([^\]'" \t\r\n]+)\]?\s*([\s\S]*?)\[\/term\]/gi,
    (_match, _key, label) => safeText(label, ""),
  );

  text = text.replace(/\[\/?term[^\]]*\]/gi, "");
  return text;
}

function sanitizeEntryBlockHtml(rawHtml) {
  const temp = document.createElement("div");
  temp.innerHTML = replaceTermShortcodes(rawHtml);

  const allowed = new Set([
    "P",
    "BR",
    "STRONG",
    "EM",
    "B",
    "I",
    "U",
    "A",
    "UL",
    "OL",
    "LI",
    "BLOCKQUOTE",
    "H2",
    "H3",
    "H4",
    "MARK",
    "CODE",
    "SPAN",
  ]);

  Array.from(temp.querySelectorAll("*")).forEach((node) => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent || ""));
      return;
    }

    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (
        node.tagName === "A" &&
        (name === "href" || name === "target" || name === "rel")
      ) {
        return;
      }
      node.removeAttribute(attr.name);
    });

    if (node.tagName === "A") {
      const href = safeText(node.getAttribute("href"), "");
      const safeHref =
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#");
      if (!safeHref) {
        node.removeAttribute("href");
      }
      if (node.getAttribute("href")?.startsWith("http")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }
  });

  return safeText(temp.innerHTML, "");
}

function stripHtmlToText(value) {
  const input = safeText(value, "");
  if (!input) return "";
  const temp = document.createElement("div");
  temp.innerHTML = input;
  return safeText(temp.textContent || "", "");
}

function toPlainText(value) {
  return stripHtmlToText(replaceTermShortcodes(value));
}

function toPlainTextWithBreaks(value) {
  const input = safeText(value, "");
  if (!input) return "";

  const temp = document.createElement("div");
  temp.innerHTML = replaceTermShortcodes(input);

  temp.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  temp
    .querySelectorAll("p, li")
    .forEach((node) => node.insertAdjacentText("afterend", "\n"));

  const text = (temp.textContent || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return safeText(text, "");
}

function normalizeHighlightLines(value) {
  const normalized = safeText(value, "")
    .replace(/[ \t]*(?:\\n|\/n)[ \t]*/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/([。！？.!?」）])\s*・/g, "$1\n・")
    .replace(/\n{3,}/g, "\n\n");

  const lines = normalized
    .split("\n")
    .map((line) => safeText(line.replace(/[ \t]{2,}/g, " "), ""))
    .filter(Boolean);

  const merged = [];
  lines.forEach((line) => {
    const isBulletLine = /^[・•●▪◦\-—]/.test(line);
    if (!merged.length || isBulletLine) {
      merged.push(line);
      return;
    }
    const previous = merged[merged.length - 1];
    const previousEndsSentence = /[。！？.!?」）]$/.test(previous);
    if (previousEndsSentence) {
      merged.push(line);
      return;
    }
    const joinWithoutSpace =
      /[\u3040-\u30ff\u3400-\u9fff]$/.test(previous) &&
      /^[\u3040-\u30ff\u3400-\u9fff]/.test(line);
    merged[merged.length - 1] =
      `${previous}${joinWithoutSpace ? "" : " "}${line}`;
  });

  return merged.join("\n");
}

function indentMultilineText(value) {
  return safeText(value, "")
    .split("\n")
    .map((line) => safeText(line, ""))
    .filter(Boolean)
    .join("\n");
}

function splitHighlightLines(value) {
  const bulletChars = /[・･•●▪◦\-—]/;
  return safeText(value, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .flatMap((line) => {
      const cleaned = safeText(line, "");
      if (!cleaned) return [];
      if (!bulletChars.test(cleaned)) {
        return [cleaned];
      }
      return cleaned
        .replace(/([。！？.!?」）])\s*([・･•●▪◦\-—])/g, "$1\n$2")
        .split("\n")
        .map((segment) => safeText(segment, ""))
        .filter(Boolean);
    });
}

function renderHighlightLines(container, value, options = {}) {
  const forceBullets = Boolean(options.forceBullets);
  if (!container) return false;
  const lines = splitHighlightLines(value);
  container.innerHTML = "";
  if (!lines.length) return false;

  const fragment = document.createDocumentFragment();
  let bulletList = null;

  lines.forEach((line) => {
    const bulletMatch = line.match(/^[・･•●▪◦\-—]\s*(.*)$/);
    const isBulletLine = Boolean(bulletMatch) || forceBullets;
    const displayText = bulletMatch ? safeText(bulletMatch[1], "") : line;
    if (isBulletLine) {
      if (!bulletList) {
        bulletList = document.createElement("ul");
        bulletList.className = "highlight-bullet-list";
        fragment.appendChild(bulletList);
      }
      const item = document.createElement("li");
      item.textContent = displayText;
      bulletList.appendChild(item);
      return;
    }

    bulletList = null;
    const paragraph = document.createElement("p");
    paragraph.textContent = displayText;
    fragment.appendChild(paragraph);
  });

  container.appendChild(fragment);
  return true;
}

function getLocalizedField(rawObj, key, fallback = "") {
  const lang = (document.documentElement.lang || "en")
    .toLowerCase()
    .startsWith("ja")
    ? "ja"
    : "en";
  const direct = safeText(rawObj?.[`${key}_${lang}`], "");
  const nested =
    rawObj?.translations && rawObj.translations[lang]
      ? safeText(rawObj.translations[lang][key], "")
      : "";
  return direct || nested || safeText(rawObj?.[key], fallback);
}

function getLangKey() {
  const lang = (document.documentElement.lang || "ja").toLowerCase();
  if (lang.startsWith("ja")) return "ja";
  if (lang.startsWith("ko")) return "ko";
  if (lang.startsWith("zh")) return "zh";
  return "en";
}

function pickLangHalf(raw, lang) {
  const text = safeText(raw, "");
  if (!text) return text;

  const SECTION_DELIMS = {
    en: ["<p>&#8212;EN&#8212;</p>", "<p>&#8211;EN&#8211;</p>",
         "&#8212;EN&#8212;", "&#8211;EN&#8211;",
         "---EN---", "—EN—", "–EN–", "&mdash;EN&mdash;", "&ndash;EN&ndash;",
         "<p>---EN---</p>", "<p>—EN—</p>", "<p>–EN–</p>",
         "<p>&mdash;EN&mdash;</p>", "<p>&ndash;EN&ndash;</p>"],
    ko: ["<p>&#8212;KO&#8212;</p>", "<p>&#8211;KO&#8211;</p>",
         "&#8212;KO&#8212;", "&#8211;KO&#8211;",
         "---KO---", "—KO—", "–KO–", "&mdash;KO&mdash;", "&ndash;KO&ndash;",
         "<p>---KO---</p>", "<p>—KO—</p>", "<p>–KO–</p>",
         "<p>&mdash;KO&mdash;</p>", "<p>&ndash;KO&ndash;</p>"],
    zh: ["<p>&#8212;ZH&#8212;</p>", "<p>&#8211;ZH&#8211;</p>",
         "&#8212;ZH&#8212;", "&#8211;ZH&#8211;",
         "---ZH---", "—ZH—", "–ZH–", "&mdash;ZH&mdash;", "&ndash;ZH&ndash;",
         "<p>---ZH---</p>", "<p>—ZH—</p>", "<p>–ZH–</p>",
         "<p>&mdash;ZH&mdash;</p>", "<p>&ndash;ZH&ndash;</p>"],
  };

  function findDelim(variants) {
    for (const d of variants) {
      const idx = text.indexOf(d);
      if (idx !== -1) return { idx, len: d.length };
    }
    return null;
  }

  const enPos = findDelim(SECTION_DELIMS.en);
  const koPos = findDelim(SECTION_DELIMS.ko);
  const zhPos = findDelim(SECTION_DELIMS.zh);

  if (!enPos && !koPos && !zhPos) return text;

  const ja = enPos ? text.slice(0, enPos.idx).trim() : text.trim();
  const en = enPos
    ? text.slice(enPos.idx + enPos.len, koPos ? koPos.idx : zhPos ? zhPos.idx : text.length).trim()
    : "";
  const ko = koPos
    ? text.slice(koPos.idx + koPos.len, zhPos ? zhPos.idx : text.length).trim()
    : "";
  const zh = zhPos ? text.slice(zhPos.idx + zhPos.len).trim() : "";

  if (lang === "en") return en || ja;
  if (lang === "ko") return ko || ja;
  if (lang === "zh") return zh || ja;
  return ja;
}

function normalizeWpImageUrl(url) {
  const input = safeText(url, "");
  if (!input) return "";
  const [base, query = ""] = input.split("?");
  const upgraded = base.replace(
    /-\d+x\d+(?=\.(jpe?g|png|webp|gif|avif)$)/i,
    "",
  );
  return query ? `${upgraded}?${query}` : upgraded;
}

function resolveImageUrl(value) {
  return normalizeWpImageUrl(resolveMediaUrl(value));
}

function collectMediaUrls(rawStop) {
  const items = [];
  const seen = new Set();
  const push = (value) => {
    const resolved = resolveImageUrl(value);
    if (!resolved || seen.has(resolved)) return;
    seen.add(resolved);
    items.push(resolved);
  };

  [
    rawStop?.media,
    rawStop?.images,
    rawStop?.gallery,
    rawStop?.acf?.media,
    rawStop?.acf?.images,
    rawStop?.acf?.gallery,
    rawStop?.image,
    rawStop?.thumb,
    rawStop?.thumbnail,
    rawStop?.acf?.image,
    rawStop?.acf?.thumb,
    rawStop?.acf?.thumbnail,
    rawStop?.mapUrl,
    rawStop?.map_url,
  ].forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    push(value);
  });

  return items;
}

function getStopVideoUrl(rawStop) {
  const candidates = [
    rawStop?.videoUrl,
    rawStop?.video_url,
    rawStop?.videoURL,
    rawStop?.video,
    rawStop?.intro_video,
    rawStop?.introVideo,
    rawStop?.intro_video_url,
    rawStop?.introVideoUrl,
    rawStop?.acf?.videoUrl,
    rawStop?.acf?.video_url,
    rawStop?.acf?.video,
    rawStop?.acf?.intro_video,
    rawStop?.acf?.introVideo,
    rawStop?.acf?.intro_video_url,
    rawStop?.acf?.introVideoUrl,
  ];

  return candidates.map((value) => resolveMediaUrl(value)).find(Boolean) || "";
}

function extractTextBlocks(rawHtml) {
  const decoded = replaceTermShortcodes(rawHtml);
  if (!decoded) return [];

  const temp = document.createElement("div");
  temp.innerHTML = decoded;

  const blocks = Array.from(
    temp.querySelectorAll("h2, h3, h4, p, ul, ol, blockquote"),
  )
    .map((node) =>
      sanitizeEntryBlockHtml(node.outerHTML || node.textContent || ""),
    )
    .filter(Boolean);

  if (blocks.length) return blocks;

  const fullText = safeText(temp.textContent || "", "");
  if (!fullText) return [];

  return fullText
    .split(/\n{2,}/)
    .map((line) => sanitizeEntryBlockHtml(`<p>${line}</p>`))
    .filter(Boolean);
}

function mapStop(rawStop, index) {
  const number = safeText(
    String(rawStop?.number ?? rawStop?.stop_number ?? index),
    String(index),
  );
  const lang = getLangKey();
  const title = toPlainText(
    pickLangHalf(getLocalizedField(rawStop, "title", `Stop ${number}`), lang),
  );
  const highlightRaw = pickLangHalf(
    getLocalizedField(rawStop, "highlight2", "") ||
    getLocalizedField(rawStop, "highlight", "") ||
    getLocalizedField(rawStop, "featured", ""),
    lang,
  );
  const paragraphCount = (highlightRaw.match(/<p[\s>]/gi) || []).length;
  const highlight = indentMultilineText(
    normalizeHighlightLines(toPlainTextWithBreaks(highlightRaw)),
  );

  const textSource = pickLangHalf(
    getLocalizedField(rawStop, "text", "") ||
    getLocalizedField(rawStop, "details_content", "") ||
    getLocalizedField(rawStop, "details", ""),
    lang,
  );
  const transcriptSource = pickLangHalf(
    getLocalizedField(rawStop, "transcript", ""),
    lang,
  );

  const media = collectMediaUrls(rawStop);
  const mapUrl =
    resolveImageUrl(rawStop?.mapUrl) || resolveImageUrl(rawStop?.map_url);
  const guideImages = mapUrl ? media.filter((url) => url !== mapUrl) : media;

  return {
    number,
    title,
    highlight,
    highlightHasList: /<li[\s>]/i.test(highlightRaw),
    highlightForceBullets:
      /<li[\s>]|<br\s*\/?>/i.test(highlightRaw) || paragraphCount > 1,
    textBlocks: extractTextBlocks(textSource),
    transcriptBlocks: extractTextBlocks(transcriptSource),
    videoUrl: getStopVideoUrl(rawStop),
    guideImages,
  };
}

function findStopZero(stops) {
  if (!Array.isArray(stops) || !stops.length) return null;
  return stops.find((stop) => stop.number === "0") || stops[0];
}

async function loadStopZero() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load entry data: ${response.status}`);
  }

  const data = await response.json();
  if (!data || !Array.isArray(data.stops)) {
    throw new Error("Invalid entry response");
  }

  const mappedStops = data.stops.map((rawStop, index) =>
    mapStop(rawStop, index),
  );
  return findStopZero(mappedStops);
}

function renderEntry(stop) {
  const current = stop || fallbackStopZero;

  if (entryTitle) {
    entryTitle.textContent = current.title || fallbackStopZero.title;
  }

  if (entryHighlight) {
    const highlightText =
      typeof current.highlight === "string" && current.highlight
        ? current.highlight
        : "";
    const hasHighlight = renderHighlightLines(entryHighlight, highlightText, {
      forceBullets: Boolean(
        current.highlightForceBullets || current.highlightHasList,
      ),
    });
    entryHighlight.classList.toggle("hidden", !hasHighlight);
  }
  if (entryHighlightLabel) {
    entryHighlightLabel.hidden =
      !entryHighlight || entryHighlight.classList.contains("hidden");
  }

  if (entryText) {
    entryText.innerHTML = "";
    const narrativeBlocks =
      Array.isArray(current.transcriptBlocks) && current.transcriptBlocks.length
        ? current.transcriptBlocks
        : Array.isArray(current.textBlocks) && current.textBlocks.length
          ? current.textBlocks
          : fallbackStopZero.textBlocks;

    narrativeBlocks.forEach((line) => {
      const block = document.createElement("div");
      block.className = "entry-rich-block";
      block.innerHTML = line;
      entryText.appendChild(block);
    });
  }

  const guideImages = Array.isArray(current.guideImages)
    ? current.guideImages.filter(Boolean)
    : [];
  if (entryGuideTrack && entryGuideDots && entryGuideGallery) {
    entryGuideTrack.innerHTML = "";
    entryGuideDots.innerHTML = "";
    if (guideImages.length) {
      guideImages.forEach((url, i) => {
        const img = document.createElement("img");
        img.src = url;
        img.alt = `ガイド画像 ${i + 1}`;
        img.className = "entry-guide-item";
        img.loading = "lazy";
        entryGuideTrack.appendChild(img);

        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "entry-guide-dot" + (i === 0 ? " is-active" : "");
        dot.setAttribute("aria-label", `画像 ${i + 1}`);
        dot.addEventListener("click", () => {
          entryGuideTrack.scrollTo({
            left: entryGuideTrack.offsetWidth * i,
            behavior: "smooth",
          });
        });
        entryGuideDots.appendChild(dot);
      });

      entryGuideDots.classList.toggle("hidden", guideImages.length < 2);
      entryGuideTrack.addEventListener(
        "scroll",
        () => {
          const idx = Math.round(
            entryGuideTrack.scrollLeft / entryGuideTrack.offsetWidth,
          );
          entryGuideDots
            .querySelectorAll(".entry-guide-dot")
            .forEach((d, i) => {
              d.classList.toggle("is-active", i === idx);
            });
        },
        { passive: true },
      );

      entryGuideGallery.classList.remove("hidden");
    } else {
      entryGuideGallery.classList.add("hidden");
    }
  }

  const FALLBACK_VIDEO_URL =
    "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/wp-content/uploads/2026/04/Video_仮02-1.mp4";
  const videoUrl = resolveMediaUrl(current.videoUrl) || FALLBACK_VIDEO_URL;

  if (entryVideo) {
    if (videoUrl) {
      entryVideo.src = videoUrl;
      entryVideo.controls = false;
      entryVideo.muted = true;
      entryVideo.volume = 0.35;
      entryVideo.autoplay = true;
      entryVideo.loop = true;
      entryVideo.removeAttribute("poster");
      entryVideo.classList.remove("hidden");
      entryVideo.currentTime = 0;
      entryVideo.play().catch(() => {});
      entryUnmuteBtn?.classList.remove("hidden");
      updateUnmuteBtn();
    } else {
      entryVideo.pause();
      entryVideo.removeAttribute("src");
      entryVideo.load();
      entryVideo.classList.add("hidden");
      entryUnmuteBtn?.classList.add("hidden");
    }
  }
}

function updateUnmuteBtn() {
  if (!entryVideo || !entryUnmuteBtn) return;
  const muted = entryVideo.muted;
  if (entryUnmuteLabel) {
    const lang = document.documentElement.lang || "ja";
    const t = TRANSLATIONS[lang] || TRANSLATIONS.ja;
    entryUnmuteLabel.textContent = muted
      ? t["audio-on"] ?? "音声オン"
      : t["audio-off"] ?? "音声オフ";
  }
  if (entryUnmuteIcon) {
    entryUnmuteIcon.setAttribute(
      "d",
      muted
        ? "M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"
        : "M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14",
    );
  }
  entryUnmuteBtn.classList.toggle("is-unmuted", !muted);
}

// ─── Settings screen ────────────────────────────────────────────────────────

const PREFS_KEY = "tourPrefs";

const TRANSLATIONS = {
  en: {
    "audio-on": "Audio On",
    "audio-off": "Audio Off",
    "label-language": "Language",
    "label-fontsize": "Text Size",
    "font-sample-small": "Aa",
    "font-sample-normal": "Aa",
    "font-sample-large": "Aa",
    "font-small": "S",
    "font-normal": "M",
    "font-large": "L",
    "font-xlarge": "XL",
    "font-xxlarge": "XXL",
    "notice-photo": "Please refrain from photographing Rakan statues and memorial tablets.",
    "notice-quiet": "Please be mindful of the audio guide volume so as not to disturb those around you.",
    "notice-smoke": "Smoking is not permitted on the grounds.",
    "notice-offering": "Please place offerings in the offering box, not on top of the statues.",
    "notice-pets": "Pets are not allowed inside the temple grounds.",
    "confirm-btn": "Start Tour",
    "start-btn": "Guide Map",
  },
  ja: {
    "audio-on": "音声オン",
    "audio-off": "音声オフ",
    "label-language": "言語",
    "label-fontsize": "文字サイズ",
    "font-sample-small": "あ",
    "font-sample-normal": "あ",
    "font-sample-large": "あ",
    "font-small": "小",
    "font-normal": "中",
    "font-large": "大",
    "font-xlarge": "特大",
    "font-xxlarge": "最大",
    "notice-photo": "羅漢像や位牌の撮影はご遠慮ください。",
    "notice-quiet": "音声ガイドの音量にご注意いただき、周りの方のご迷惑にならないようご配慮ください。",
    "notice-smoke": "境内での喫煙は禁止されています。",
    "notice-offering": "お賽銭はお賽銭箱にお入れください、像の上に置かないでください。",
    "notice-pets": "ペットの境内への持ち込みはご遠慮ください。",
    "confirm-btn": "ガイド開始",
    "start-btn": "ガイドマップ",
  },
  ko: {
    "audio-on": "음성 켜기",
    "audio-off": "음성 끄기",
    "label-language": "언어",
    "label-fontsize": "글자 크기",
    "font-sample-small": "가",
    "font-sample-normal": "가",
    "font-sample-large": "가",
    "font-small": "S",
    "font-normal": "M",
    "font-large": "L",
    "font-xlarge": "특대",
    "font-xxlarge": "최대",
    "notice-photo": "나한상이나 위패 촬영은 삼가 주세요.",
    "notice-quiet": "오디오 가이드 볼륨을 적절히 조절하여 주변 분들께 불편을 드리지 않도록 배려해 주세요.",
    "notice-smoke": "경내에서는 흡연이 금지되어 있습니다.",
    "notice-offering": "헌금은 헌금함에 넣어 주세요. 상 위에 올려놓지 말아 주세요.",
    "notice-pets": "반려동물의 경내 출입은 삼가 주세요.",
    "confirm-btn": "가이드 시작",
    "start-btn": "가이드 맵",
  },
  zh: {
    "audio-on": "开启音频",
    "audio-off": "关闭音频",
    "label-language": "语言",
    "label-fontsize": "文字大小",
    "font-sample-small": "文",
    "font-sample-normal": "文",
    "font-sample-large": "文",
    "font-small": "S",
    "font-normal": "M",
    "font-large": "L",
    "font-xlarge": "特大",
    "font-xxlarge": "最大",
    "notice-photo": "请勿拍摄罗汉像或灵牌。",
    "notice-quiet": "请注意导览音频的音量，以免打扰周围的其他游客。",
    "notice-smoke": "境内禁止吸烟。",
    "notice-offering": "请将香钱放入功德箱，勿置于雕像上。",
    "notice-pets": "禁止携带宠物进入境内。",
    "confirm-btn": "开始导览",
    "start-btn": "导览地图",
  },
};

const FONT_SCALES = { small: 0.88, normal: 1, large: 1.14, xlarge: 1.3, xxlarge: 1.5 };

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

function applyLang(lang) {
  document.documentElement.lang = lang;
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  document.querySelectorAll("[data-t]").forEach((el) => {
    const key = el.getAttribute("data-t");
    if (t[key]) el.textContent = t[key];
  });
}

function applyFontScale(size) {
  const scale = FONT_SCALES[size] || 1;
  document.documentElement.style.setProperty(
    "--tour-font-scale",
    String(scale),
  );
}

function initSettings(onLangChange) {
  const screen = document.getElementById("settingsScreen");
  const confirmBtn = document.getElementById("settingsConfirmBtn");
  const langGrid = document.getElementById("settingsLangGrid");
  const entrySettingsBtn = document.getElementById("entrySettingsBtn");

  if (!screen) return;

  const prefs = loadPrefs();
  let selectedLang = prefs.lang || "ja";
  // Remap old sizes that no longer exist as buttons to the nearest valid option
  const sizeRemap = { small: "large", normal: "large" };
  let selectedSize = sizeRemap[prefs.size] || prefs.size || "xlarge";

  // Apply saved prefs immediately
  applyLang(selectedLang);
  applyFontScale(selectedSize);

  // Sync button states
  function syncLangBtns() {
    langGrid?.querySelectorAll(".settings-lang-btn").forEach((btn) => {
      const active = btn.dataset.lang === selectedLang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  function syncFontBtns() {
    document.querySelectorAll(".settings-font-btn").forEach((btn) => {
      const active = btn.dataset.size === selectedSize;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  syncLangBtns();
  syncFontBtns();

  // Language selection
  langGrid?.addEventListener("click", (e) => {
    const btn = e.target.closest(".settings-lang-btn");
    if (!btn) return;
    selectedLang = btn.dataset.lang;
    applyLang(selectedLang);
    syncLangBtns();
    updateUnmuteBtn();
    onLangChange?.(selectedLang);
  });

  // Font size buttons
  document.querySelectorAll(".settings-font-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedSize = btn.dataset.size;
      applyFontScale(selectedSize);
      syncFontBtns();
    });
  });

  function hideSettings() {
    screen.classList.add("is-hidden");
    savePrefs({ lang: selectedLang, size: selectedSize });
  }

  confirmBtn?.addEventListener("click", () => {
    savePrefs({ lang: selectedLang, size: selectedSize });
    const expiry = parseInt(localStorage.getItem("tourAccessExpiry") || "0", 10);
    const hasToken = localStorage.getItem("tourAccessToken") && expiry > Date.now();
    if (hasToken) {
      hideSettings();
    } else {
      window.location.href = "./pay-select.html";
    }
  });

  // Re-open from gear icon
  entrySettingsBtn?.addEventListener("click", () => {
    screen.classList.remove("is-hidden");
    syncLangBtns();
    syncFontBtns();
  });

  // Skip settings if returning from payment (user already set prefs before paying)
  const skipSettings = new URLSearchParams(window.location.search).get("skip_settings") === "1";
  if (skipSettings) {
    history.replaceState(null, "", window.location.pathname);
    screen.classList.add("is-hidden");
  } else {
    screen.classList.remove("is-hidden");
  }
}

// ─── Entry events & init ─────────────────────────────────────────────────────

function bindEvents() {
  entryStartBtn?.addEventListener("click", () => {
    entryVideo?.pause();
    const prefs = loadPrefs();
    const lang = prefs.lang || "ja";
    const targetUrl = new URL("./tour.html", window.location.href);
    targetUrl.searchParams.set("lang", lang);
    window.location.href = targetUrl.toString();
  });

  entryUnmuteBtn?.addEventListener("click", () => {
    if (!entryVideo) return;
    entryVideo.muted = !entryVideo.muted;
    updateUnmuteBtn();
  });
}

function applySettingsBg(stop) {
  const screen = document.getElementById("settingsScreen");
  if (!screen) return;
  const images = Array.isArray(stop?.guideImages)
    ? stop.guideImages.filter(Boolean)
    : [];
  const url = images[0] || "";
  if (url) {
    screen.style.backgroundImage = `url(${JSON.stringify(url)})`;
    screen.style.backgroundSize = "cover";
    screen.style.backgroundPosition = "center";
  }
}

const STOP_ZERO_CACHE_KEY = "stopZeroCache";

function loadCachedStopZero() {
  try {
    const raw = localStorage.getItem(STOP_ZERO_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cacheStopZero(rawStop) {
  try {
    localStorage.setItem(STOP_ZERO_CACHE_KEY, JSON.stringify(rawStop));
  } catch {}
}

async function init() {
  let rawStopZeroData = null;

  function rerender() {
    const stop = rawStopZeroData
      ? mapStop(rawStopZeroData, 0)
      : fallbackStopZero;
    renderEntry(stop);
  }

  initSettings(rerender);
  bindEvents();

  const cached = loadCachedStopZero();
  if (cached) {
    rawStopZeroData = cached;
    const stopZero = mapStop(cached, 0);
    applySettingsBg(stopZero);
    renderEntry(stopZero);
    entryLoadingOverlay?.classList.add("hidden");
    return;
  }

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Failed: ${response.status}`);
    const data = await response.json();
    if (!data || !Array.isArray(data.stops)) throw new Error("Invalid data");

    const rawStop = data.stops.find((s) => {
      const num = String(s?.number ?? s?.acf?.number ?? "").trim();
      return num === "0";
    }) || data.stops[0];

    rawStopZeroData = rawStop;
    cacheStopZero(rawStop);
    const stopZero = rawStop ? mapStop(rawStop, 0) : null;
    applySettingsBg(stopZero || fallbackStopZero);
    renderEntry(stopZero || fallbackStopZero);
  } catch (error) {
    console.error(error);
    renderEntry(fallbackStopZero);
  } finally {
    entryLoadingOverlay?.classList.add("hidden");
  }
}

disablePwa();
init();
