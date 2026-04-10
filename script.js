const DATA_URL =
  "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/?rest_route=/memorial/v1/tour";

const appShell = document.querySelector("#appShell");
const appLoadingOverlay = document.querySelector("#appLoadingOverlay");
const stopList = document.querySelector(".stop-list");
const introButton = document.querySelector(".intro-cta");
const introCard = document.querySelector(".intro-card");
const introVideo = document.querySelector("#introVideo");
const title = document.querySelector(".sheet-title-row h1");
const backButton = document.querySelector("#backButton");

const detailHeroTrack = document.querySelector("#detailHeroTrack");
const detailHeroIndicators = document.querySelector("#detailHeroIndicators");
const detailNumber = document.querySelector("#detailNumber");
const detailTitle = document.querySelector("#detailTitle");
const detailQuestion = document.querySelector("#detailQuestion");
const detailQuestionBlock = document.querySelector(".detail-question-block");
const detailHighlightLabel = document.querySelector("#detailHighlightLabel");
const detailText = document.querySelector("#detailText");
const detailTranscriptBlock = document.querySelector("#detailTranscriptBlock");
const detailTranscript = document.querySelector("#detailTranscript");
const detailAudioTitle = document.querySelector("#detailAudioTitle");
const detailThumb = document.querySelector("#detailThumb");
const detailView = document.querySelector(".detail-view");
const detailContent = document.querySelector("#detailContent");
const detailStrip = document.querySelector(".detail-strip");
const detailPlayBtn = document.querySelector("#detailPlayBtn");
const detailMapBtn = document.querySelector("#detailMapBtn");
const playerDock = document.querySelector("#detailAudioInline");
const detailHighlight = document.querySelector("#detailHighlight");
const detailPrevBtn = document.querySelector("#detailPrevBtn");
const detailNextBtn = document.querySelector("#detailNextBtn");
const bottomMenuBtn = document.querySelector("#bottomMenuBtn");
const stopPicker = document.querySelector("#stopPicker");
const stopPickerItems = document.querySelector("#stopPickerItems");
const stopPickerBackdrop = document.querySelector("#stopPickerBackdrop");

const mapPreviewModal = document.querySelector("#mapPreviewModal");
const mapPreviewTitle = document.querySelector("#mapPreviewTitle");
const mapPreviewStage = document.querySelector("#mapPreviewStage");
const mapPreviewImage = document.querySelector("#mapPreviewImage");
const mapPreviewClose = document.querySelector("#mapPreviewClose");
const mapZoomOutBtn = document.querySelector("#mapZoomOut");
const mapZoomResetBtn = document.querySelector("#mapZoomReset");
const mapZoomInBtn = document.querySelector("#mapZoomIn");

const termModal = document.querySelector("#termModal");
const termModalTitle = document.querySelector("#termModalTitle");
const termModalBody = document.querySelector("#termModalBody");
const termModalMedia = document.querySelector("#termModalMedia");
const termModalClose = document.querySelector("#termModalClose");
const termGalleryMeta = document.querySelector("#termGalleryMeta");
const termGalleryCount = document.querySelector("#termGalleryCount");
const termGalleryDots = document.querySelector("#termGalleryDots");

const detailAudio = new Audio();
const listPreviewAudio = new Audio();
const isTourPage = new URLSearchParams(window.location.search).get("tour") === "1";

let activeStop = null;
let stopsData = [];
let tourStopsData = [];
let activePreviewButton = null;
let heroSlideIndex = 0;
let heroSlideTimer = null;
let activeTermLookup = new Map();

const MAP_MIN_SCALE = 1;
const MAP_MAX_SCALE = 4;
const MAP_ZOOM_STEP = 0.25;
const DETAIL_AUDIO_ICON_SIZE = 20;
let mapScale = 1;
let mapOffsetX = 0;
let mapOffsetY = 0;
let mapPointers = new Map();
let mapPinchStart = null;
let mapDragPointerId = null;
let mapDragStartX = 0;
let mapDragStartY = 0;

function disablePwa() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});
  });
}

function playIconHtml(size = 10) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true" focusable="false"><polygon points="2,1 9,5 2,9"/></svg>`;
}
function pauseIconHtml(size = 10) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true" focusable="false"><rect x="1" y="1" width="3" height="8" rx="0.5"/><rect x="6" y="1" width="3" height="8" rx="0.5"/></svg>`;
}

function isStopZero(stop) {
  return safeText(stop?.number, "") === "0";
}

function getIntroStop(stops = []) {
  if (!Array.isArray(stops) || !stops.length) return null;
  return stops.find((stop) => isStopZero(stop)) || stops[0];
}

function getTourStops(stops = []) {
  if (!Array.isArray(stops) || !stops.length) return [];
  const introStop = getIntroStop(stops);
  if (!introStop || !isStopZero(introStop)) {
    return stops;
  }
  return stops.filter((stop) => stop.id !== introStop.id);
}

const fallbackStops = [
  {
    id: "1",
    number: "0",
    title: "Welcome Gate & Orientation Plaza",
    media: [
      "https://picsum.photos/id/1040/1280/960",
      "https://picsum.photos/id/1035/1280/960"
    ],
    thumb: "https://picsum.photos/id/1040/120/80",
    question: "Why does this memorial begin at the gate?",
    highlight: "Why does this memorial begin at the gate?",
    textBlocks: [
      "This first stop introduces the idea of arrival, where visitors shift from daily life into a shared space of memory and reflection."
    ],
    transcriptBlocks: [
      "Welcome to the memorial grounds. This tour begins at the entrance."
    ],
    terms: [],
    audioUrl: "",
    mapUrl: ""
  }
];

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

function normalizeWpImageUrl(url) {
  const input = safeText(url, "");
  if (!input) return "";

  const [base, query = ""] = input.split("?");
  const upgraded = base.replace(/-\d+x\d+(?=\.(jpe?g|png|webp|gif|avif)$)/i, "");
  return query ? `${upgraded}?${query}` : upgraded;
}

function resolveImageUrl(value) {
  return normalizeWpImageUrl(resolveMediaUrl(value));
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
    if (next === current) {
      break;
    }
    current = next;
  }
  return current;
}

function stripHtmlToText(value) {
  const input = safeText(value, "");
  if (!input) return "";
  const temp = document.createElement("div");
  temp.innerHTML = input;
  return safeText(temp.textContent || "", "");
}

function toPlainText(value) {
  const decoded = decodeEntitiesDeep(value);
  return stripHtmlToText(decoded);
}

function toPlainTextWithBreaks(value) {
  const input = safeText(value, "");
  if (!input) return "";

  const temp = document.createElement("div");
  temp.innerHTML = replaceTermShortcodes(input);

  temp.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  temp.querySelectorAll("p, li").forEach((node) => node.insertAdjacentText("afterend", "\n"));

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
    merged[merged.length - 1] = `${previous}${joinWithoutSpace ? "" : " "}${line}`;
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTermTokenHtml(keyRaw, labelRaw = "") {
  const key = normalizeTermKey(keyRaw) || safeText(String(keyRaw || ""), "");
  const label = toPlainText(labelRaw) || toPlainText(keyRaw) || "term";
  return `<span data-term-key="${escapeHtml(key)}">${escapeHtml(label)}</span>`;
}

function replaceTermShortcodes(rawText) {
  let text = decodeEntitiesDeep(rawText);

  text = text.replace(
    /\[term\s+key=(['"])(.*?)\1\]?\s*([\s\S]*?)\[\/term\]/gi,
    (_match, _quote, key, label) => renderTermTokenHtml(key, label)
  );

  text = text.replace(
    /\[term\s+key=(['"])(.*?)\1\]?\s*\[\/term\]/gi,
    (_match, _quote, key) => renderTermTokenHtml(key, key)
  );

  text = text.replace(
    /\[term\s+key=([^\]'" \t\r\n]+)\]?\s*([\s\S]*?)\[\/term\]/gi,
    (_match, key, label) => renderTermTokenHtml(key, label)
  );

  text = text.replace(
    /\[term\s+key=([^\]'" \t\r\n]+)\]/gi,
    (_match, key) => renderTermTokenHtml(key, key)
  );

  return text;
}

function getLangKey() {
  const lang = (document.documentElement.lang || "en").toLowerCase();
  return lang.startsWith("ja") ? "ja" : "en";
}

function getLocalizedField(rawObj, key, fallback = "") {
  const lang = getLangKey();
  const direct = safeText(rawObj?.[`${key}_${lang}`], "");
  const nested =
    rawObj?.translations && rawObj.translations[lang]
      ? safeText(rawObj.translations[lang][key], "")
      : "";
  return direct || nested || safeText(rawObj?.[key], fallback);
}

function normalizeTermKey(value) {
  return safeText(String(value || ""), "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeRichInlineHtml(rawHtml) {
  const temp = document.createElement("div");
  temp.innerHTML = replaceTermShortcodes(rawHtml);

  const allowed = new Set(["A", "SPAN", "STRONG", "EM", "B", "I", "U", "BR", "MARK", "CODE", "SUB", "SUP"]);

  Array.from(temp.querySelectorAll("*")).forEach((node) => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent || ""));
      return;
    }

    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();

      if (name === "data-term-key") {
        return;
      }
      if (name === "class") {
        return;
      }
      if (node.tagName === "A" && (name === "href" || name === "target" || name === "rel")) {
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

  return temp.innerHTML;
}

function sanitizeTermModalHtml(rawHtml) {
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
    "IMG",
    "SPAN"
  ]);

  Array.from(temp.querySelectorAll("*")).forEach((node) => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent || ""));
      return;
    }

    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();

      if (name === "data-term-key") {
        return;
      }

      if (node.tagName === "A" && (name === "href" || name === "target" || name === "rel")) {
        return;
      }

      if (node.tagName === "IMG" && (name === "src" || name === "alt" || name === "title" || name === "loading")) {
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

    if (node.tagName === "IMG") {
      const src = safeText(node.getAttribute("src"), "");
      const safeSrc =
        src.startsWith("http://") ||
        src.startsWith("https://") ||
        src.startsWith("data:image/") ||
        src.startsWith("/");
      if (!safeSrc) {
        node.remove();
      } else if (!node.getAttribute("loading")) {
        node.setAttribute("loading", "lazy");
      }
    }
  });

  return temp.innerHTML;
}

function extractRichBlocksFromSource(source) {
  const decoded = replaceTermShortcodes(source);
  if (!safeText(decoded, "")) {
    return [];
  }

  const temp = document.createElement("div");
  temp.innerHTML = decoded;
  const hasElements = Boolean(temp.querySelector("*"));

  if (!hasElements) {
    return decoded
      .split(/\n{2,}/)
      .map((line) => safeText(line, ""))
      .filter(Boolean)
      .map((line) => sanitizeRichInlineHtml(line));
  }

  const blocks = Array.from(
    temp.querySelectorAll("p, li, blockquote, h2, h3, h4, div")
  );

  if (!blocks.length) {
    const fallback = toPlainText(decoded);
    return fallback ? [escapeHtml(fallback)] : [];
  }

  return blocks
    .map((node) => sanitizeRichInlineHtml(node.innerHTML || node.textContent || ""))
    .map((html) => safeText(html, ""))
    .filter(Boolean);
}

function collectMediaUrls(rawStop, index) {
  const baseImages = Array.isArray(rawStop?.images) ? rawStop.images : [];
  const extraImages = Object.keys(rawStop || {})
    .filter((key) => /^image(?:_)?\d+$/i.test(key))
    .sort((a, b) => {
      const ai = Number.parseInt(String(a).replace(/\D+/g, ""), 10) || 0;
      const bi = Number.parseInt(String(b).replace(/\D+/g, ""), 10) || 0;
      return ai - bi;
    })
    .map((key) => rawStop[key]);

  const urls = [...baseImages, ...extraImages]
    .map((item) => resolveImageUrl(item))
    .filter(Boolean)
    .filter((url, idx, arr) => arr.indexOf(url) === idx);

  if (urls.length) {
    return urls;
  }

  return [`https://picsum.photos/seed/memorial-${index + 1}/1280/960`];
}

function normalizeStopTerms(rawStop) {
  const collectTermImageUrls = (row) => {
    const urls = [];
    const seen = new Set();

    const pushCandidate = (candidate) => {
      if (!candidate) return;

      if (Array.isArray(candidate)) {
        candidate.forEach(pushCandidate);
        return;
      }

      const direct = resolveImageUrl(candidate);
      if (direct) {
        if (!seen.has(direct)) {
          seen.add(direct);
          urls.push(direct);
        }
        return;
      }

      if (candidate && typeof candidate === "object") {
        [
          "url",
          "source_url",
          "sizes",
          "full",
          "image",
          "popup_image",
          "popupImage",
          "media",
          "file",
          "attachment",
          "value"
        ].forEach((key) => {
          if (key in candidate) {
            pushCandidate(candidate[key]);
          }
        });
      }
    };

    const candidates = [
      row.popup_image,
      row.popupImage,
      row.image,
      row.popup_images,
      row.popupImages,
      row.images,
      row.gallery,
      row.popup_gallery,
      row.popupGallery
    ];
    candidates.forEach(pushCandidate);
    return urls;
  };

  const rawGroups = [
    rawStop?.term_popups,
    rawStop?.termPopups,
    rawStop?.terms,
    rawStop?.glossary,
    rawStop?.keyword_popups,
    rawStop?.keywordPopups
  ];
  const rows = rawGroups.find((value) => Array.isArray(value)) || [];

  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;

      const label = toPlainText(row.label || row.word || row.term || row.keyword || "");
      const keySeed =
        row.term_id || row.termId || row.key || row.slug || row.id || label;
      const key = normalizeTermKey(keySeed);
      if (!key) return null;
      const imageUrls = collectTermImageUrls(row);

      return {
        key,
        label,
        title: toPlainText(row.popup_title || row.title || row.heading || label),
        text: toPlainText(
          row.popup_text || row.description || row.text || row.content || row.details || ""
        ),
        textHtml: sanitizeTermModalHtml(
          row.popup_text || row.description || row.text || row.content || row.details || ""
        ),
        imageUrls,
        imageUrl: imageUrls[0] || ""
      };
    })
    .filter(Boolean);
}

function buildTermLookup(terms) {
  const map = new Map();
  terms.forEach((term) => {
    const key = normalizeTermKey(term.key);
    if (key) map.set(key, term);
    const labelKey = normalizeTermKey(term.label);
    if (labelKey && !map.has(labelKey)) {
      map.set(labelKey, term);
    }
  });
  return map;
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
    rawStop?.acf?.introVideoUrl
  ];

  return candidates.map((value) => resolveMediaUrl(value)).find(Boolean) || "";
}

function mapWpStop(rawStop, index, numberOffset = 0) {
  const number = String(index + numberOffset);
  const titleText = toPlainText(getLocalizedField(rawStop, "title", `Stop ${number}`));
  const questionRaw = getLocalizedField(rawStop, "question", "");
  const highlightRaw =
    getLocalizedField(rawStop, "highlight2", "") ||
    getLocalizedField(rawStop, "highlight", "") ||
    getLocalizedField(rawStop, "featured", "");
  const paragraphCount = (highlightRaw.match(/<p[\s>]/gi) || []).length;

  const textSource =
    getLocalizedField(rawStop, "text", "") ||
    getLocalizedField(rawStop, "details_content", "") ||
    getLocalizedField(rawStop, "details", "");
  const transcriptSource = getLocalizedField(rawStop, "transcript", "");

  const textBlocks = extractRichBlocksFromSource(textSource);
  let transcriptBlocks = extractRichBlocksFromSource(transcriptSource);
  const media = collectMediaUrls(rawStop, index);
  const terms = normalizeStopTerms(rawStop);
  const questionText = toPlainText(questionRaw);
  const highlightText = indentMultilineText(
    normalizeHighlightLines(toPlainTextWithBreaks(highlightRaw))
  );

  const textPlain = textBlocks.map((block) => toPlainText(block)).join("\n").trim();
  const transcriptPlain = transcriptBlocks
    .map((block) => toPlainText(block))
    .join("\n")
    .trim();
  if (textPlain && transcriptPlain && textPlain === transcriptPlain) {
    transcriptBlocks = [];
  }

  return {
    id: safeText(String(rawStop?.id || ""), `stop-${number}`),
    number,
    title: titleText || `Stop ${number}`,
    media,
    thumb: media[0],
    question: questionText,
    highlight: highlightText,
    highlightHasList: /<li[\s>]/i.test(highlightRaw),
    highlightForceBullets: /<li[\s>]|<br\s*\/?>/i.test(highlightRaw) || paragraphCount > 1,
    highlightHtml: sanitizeTermModalHtml(highlightRaw),
    textBlocks,
    transcriptBlocks,
    terms,
    audioUrl:
      resolveMediaUrl(rawStop?.audioUrl) ||
      resolveMediaUrl(rawStop?.audio_url) ||
      "",
    videoUrl: getStopVideoUrl(rawStop),
    mapUrl:
      resolveMediaUrl(rawStop?.mapUrl) ||
      resolveMediaUrl(rawStop?.map_url) ||
      resolveMediaUrl(rawStop?.mapImage) ||
      resolveMediaUrl(rawStop?.map_image) ||
      ""
  };
}

function renderDetailHighlightSection(container, htmlValue, textValue, forceBullets = false) {
  if (!container) return false;
  const richHtml = safeText(htmlValue, "");
  if (richHtml) {
    container.innerHTML = richHtml;
    return true;
  }
  return renderHighlightLines(container, textValue, { forceBullets });
}

async function loadStops() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load tour data: ${response.status}`);
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.stops)) {
    throw new Error("Invalid tour data response");
  }
  return data.stops.map((stop, index) => mapWpStop(stop, index, 0));
}

function renderIntroCardVideo(stops) {
  if (!introCard) return;

  introCard
    .querySelectorAll(".intro-label, h2, .intro-cta")
    .forEach((node) => node.remove());
  introCard.classList.remove("has-video", "has-aspect-ratio");
  introCard.style.aspectRatio = "";

  let introVideoEl = introCard.querySelector("#introVideo");
  if (!introVideoEl) {
    introVideoEl = document.createElement("video");
    introVideoEl.id = "introVideo";
    introVideoEl.className = "intro-video hidden";
    introVideoEl.setAttribute("playsinline", "");
    introVideoEl.setAttribute("muted", "");
    introVideoEl.setAttribute("autoplay", "");
    introVideoEl.setAttribute("loop", "");
    introVideoEl.setAttribute("controls", "");
    introVideoEl.setAttribute("controlslist", "nodownload noplaybackrate");
    introVideoEl.setAttribute("disablepictureinpicture", "");
    introVideoEl.setAttribute("preload", "metadata");
    introVideoEl.setAttribute("aria-label", "Introduction video");
    introCard.prepend(introVideoEl);
  }

  const introStop = getIntroStop(stops);
  const introVideoUrl = resolveMediaUrl(introStop?.videoUrl);
  const introPoster = resolveImageUrl(introStop?.media?.[0] || introStop?.thumb);
  if (introPoster) {
    introVideoEl.poster = introPoster;
  } else {
    introVideoEl.removeAttribute("poster");
  }

  if (!introVideoUrl) {
    introCard.classList.remove("has-video");
    introVideoEl.pause();
    introVideoEl.removeAttribute("src");
    introVideoEl.load();
    introVideoEl.classList.add("hidden");
    introCard.hidden = true;
    return;
  }

  introVideoEl.src = introVideoUrl;
  introVideoEl.muted = true;
  introVideoEl.autoplay = true;
  introVideoEl.playsInline = true;
  introVideoEl.loop = true;
  introVideoEl.controls = true;
  introVideoEl.setAttribute("controlslist", "nodownload noplaybackrate");
  introVideoEl.setAttribute("disablepictureinpicture", "");
  introVideoEl.classList.remove("hidden");
  introCard.hidden = false;
  introCard.classList.add("has-video");

  const applyAspectRatio = () => {
    const { videoWidth: vw, videoHeight: vh } = introVideoEl;
    if (vw && vh) {
      introCard.style.aspectRatio = `${vw} / ${vh}`;
      introCard.classList.add("has-aspect-ratio");
    }
  };
  introVideoEl.addEventListener("loadedmetadata", applyAspectRatio, { once: true });
  if (introVideoEl.readyState >= 1 && introVideoEl.videoWidth) {
    applyAspectRatio();
  }

  introVideoEl.play().catch(() => {});
}

function renderStopList(stops) {
  if (!stopList) return;
  stopList.innerHTML = "";

  stops.forEach((stop, index) => {
    const item = document.createElement("article");
    item.className = "stop-card";
    item.style.setProperty("--i", String(index + 1));
    item.dataset.stopId = stop.id;

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.setAttribute("role", "img");
    thumb.setAttribute("aria-label", stop.title);

    const thumbImage = document.createElement("img");
    thumbImage.className = "stop-thumb-image";
    thumbImage.src = stop.thumb;
    thumbImage.alt = stop.title;

    const playButton = document.createElement("button");
    playButton.className = "play-btn";
    playButton.type = "button";
    playButton.setAttribute("aria-label", "Play audio stop");
    playButton.innerHTML = playIconHtml();
    playButton.dataset.stopId = stop.id;
    playButton.disabled = !stop.audioUrl;

    thumb.appendChild(thumbImage);
    thumb.appendChild(playButton);

    const stopInfo = document.createElement("div");
    stopInfo.className = "stop-info";
    const stopTitle = document.createElement("h3");
    stopTitle.textContent = `${stop.number} ${stop.title}`;
    stopInfo.appendChild(stopTitle);

    const durationEl = document.createElement("p");
    durationEl.className = "stop-duration";
    durationEl.textContent = stop.audioUrl ? "–:––" : "";
    stopInfo.appendChild(durationEl);
    if (stop.audioUrl) {
      const metaAudio = new Audio();
      metaAudio.preload = "metadata";
      metaAudio.addEventListener("loadedmetadata", () => {
        const mins = Math.floor(metaAudio.duration / 60);
        const secs = Math.floor(metaAudio.duration % 60).toString().padStart(2, "0");
        durationEl.textContent = `${mins}:${secs}`;
        metaAudio.src = "";
      });
      metaAudio.src = stop.audioUrl;
    }

    const mapButton = document.createElement("button");
    mapButton.className = "open-link";
    mapButton.type = "button";
    mapButton.dataset.stopId = stop.id;
    mapButton.textContent = "地図";
    mapButton.disabled = !stop.mapUrl;

    item.appendChild(thumb);
    item.appendChild(stopInfo);
    item.appendChild(mapButton);
    stopList.appendChild(item);
  });
}

function stopHeroSlideshow() {
  if (heroSlideTimer) {
    clearInterval(heroSlideTimer);
    heroSlideTimer = null;
  }
}

function animateActiveSlideIndicator(index) {
  const indicators = detailHeroIndicators?.querySelectorAll(".slide-indicator");
  if (!indicators?.length) return;

  indicators.forEach((node, idx) => {
    const bar = node.querySelector(".slide-progress");
    node.classList.toggle("active", idx === index);
    if (!bar) return;
    bar.style.animation = "none";
    bar.style.width = idx === index ? "100%" : "0";
  });
}

function showHeroSlide(index) {
  const slides = detailHeroTrack?.querySelectorAll(".detail-hero-media");
  if (!slides?.length) return;

  heroSlideIndex = (index + slides.length) % slides.length;
  slides.forEach((slide, idx) => {
    const isActive = idx === heroSlideIndex;
    slide.classList.toggle("active", isActive);
    if (slide instanceof HTMLVideoElement && !isActive) {
      slide.pause();
    }
  });
  animateActiveSlideIndicator(heroSlideIndex);
}

function renderHeroSlideshow(stop) {
  if (!detailHeroTrack || !detailHeroIndicators) return;
  stopHeroSlideshow();
  Array.from(detailHeroTrack.querySelectorAll("video")).forEach((video) => {
    video.pause();
  });

  detailHeroTrack.innerHTML = "";
  detailHeroIndicators.innerHTML = "";
  if (stop.videoUrl) {
    const video = document.createElement("video");
    video.className = "detail-hero-slide detail-hero-media detail-hero-video active";
    video.src = stop.videoUrl;
    video.controls = true;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("aria-label", `${stop.title} video`);
    if (stop.thumb) {
      video.poster = stop.thumb;
    }
    detailHeroTrack.appendChild(video);
    video.play().catch(() => {});
    detailHeroIndicators.hidden = true;
    heroSlideIndex = 0;
    return;
  }

  const imageMedia =
    Array.isArray(stop.media) && stop.media.length ? stop.media : [stop.thumb];
  const heroMedia = imageMedia.map((src) => ({ type: "image", src }));
  detailHeroIndicators.hidden = heroMedia.length <= 1;

  heroMedia.forEach((mediaItem, index) => {
    const img = document.createElement("img");
    img.className = "detail-hero-slide detail-hero-media";
    img.alt = `${stop.title} image ${index + 1}`;
    const setOrientationClass = () => {
      const isPortrait = img.naturalHeight > img.naturalWidth * 1.08;
      img.classList.toggle("is-portrait", isPortrait);
      img.classList.toggle("is-landscape", !isPortrait);
    };
    img.addEventListener("load", setOrientationClass);
    img.src = mediaItem.src;
    if (img.complete && img.naturalWidth > 0) {
      setOrientationClass();
    }

    img.style.cursor = heroMedia.length > 1 ? "pointer" : "default";
    img.addEventListener("click", () => {
      if (heroMedia.length > 1) showHeroSlide(heroSlideIndex + 1);
    });
    if (index === 0) img.classList.add("active");
    detailHeroTrack.appendChild(img);

    const indicator = document.createElement("button");
    indicator.type = "button";
    indicator.className = "slide-indicator";
    indicator.setAttribute("aria-label", `Go to image ${index + 1}`);

    const progress = document.createElement("span");
    progress.className = "slide-progress";
    indicator.appendChild(progress);
    indicator.addEventListener("click", () => showHeroSlide(index));

    detailHeroIndicators.appendChild(indicator);
  });

  heroSlideIndex = 0;
  showHeroSlide(0);
}

function renderRichBlocks(container, blocks) {
  if (!container) return;
  container.innerHTML = "";
  blocks.forEach((blockHtml) => {
    const p = document.createElement("p");
    p.innerHTML = blockHtml;
    container.appendChild(p);
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function injectTermTokens(container, terms) {
  if (!container || !Array.isArray(terms) || !terms.length) return;

  const labelToKey = new Map();
  terms.forEach((term) => {
    const label = safeText(term.label, "");
    const key = normalizeTermKey(term.key);
    if (label && key && !labelToKey.has(label)) {
      labelToKey.set(label, key);
    }
  });

  const labels = Array.from(labelToKey.keys()).sort((a, b) => b.length - a.length);
  if (!labels.length) return;
  const pattern = new RegExp(`(${labels.map(escapeRegExp).join("|")})`, "g");

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach((node) => {
    const parent = node.parentElement;
    if (!parent) return;
    if (parent.closest("[data-term-key],a,button")) return;

    const source = node.nodeValue || "";
    if (!source || !pattern.test(source)) {
      pattern.lastIndex = 0;
      return;
    }
    pattern.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const termLabel = match[0];
      const start = match.index;
      if (start > lastIndex) {
        fragment.appendChild(
          document.createTextNode(source.slice(lastIndex, start))
        );
      }

      const span = document.createElement("span");
      span.setAttribute(
        "data-term-key",
        labelToKey.get(termLabel) || normalizeTermKey(termLabel)
      );
      span.textContent = termLabel;
      fragment.appendChild(span);
      lastIndex = start + termLabel.length;
    }

    if (lastIndex < source.length) {
      fragment.appendChild(document.createTextNode(source.slice(lastIndex)));
    }
    node.replaceWith(fragment);
  });
}

function setDetailStop(stop) {
  activeStop = stop;
  activeTermLookup = buildTermLookup(stop.terms || []);
  detailView?.classList.toggle("is-stop-zero", isStopZero(stop));

  const previewWasPlaying = !listPreviewAudio.paused &&
    activePreviewButton?.dataset.stopId === stop.id;
  const previewTime = listPreviewAudio.currentTime;

  listPreviewAudio.pause();
  if (activePreviewButton) {
    activePreviewButton.classList.remove("is-playing");
    activePreviewButton.innerHTML = playIconHtml();
    activePreviewButton = null;
  }

  renderHeroSlideshow(stop);
  detailNumber.textContent = stop.number;
  detailTitle.textContent = stop.title;
  if (detailAudioTitle) detailAudioTitle.textContent = `${stop.number} ${stop.title}`;
  if (detailThumb) { detailThumb.src = stop.thumb; detailThumb.alt = stop.title; }

  detailQuestion.textContent = stop.question;
  detailQuestionBlock.hidden = !safeText(stop.question, "");

  const hlText =
    (typeof stop.highlight === "string" && stop.highlight) ||
    safeText(stop.question, "");
  let hasHighlightBlock = false;

  if (detailHighlight) {
    hasHighlightBlock = renderDetailHighlightSection(
      detailHighlight,
      stop.highlightHtml,
      hlText,
      Boolean(stop.highlightForceBullets || stop.highlightHasList)
    );
    detailHighlight.classList.toggle("hidden", !hasHighlightBlock);
  }

  renderRichBlocks(detailText, stop.textBlocks);
  detailHighlightLabel?.classList.toggle("hidden", !hasHighlightBlock);

  renderRichBlocks(detailTranscript, stop.transcriptBlocks);
  injectTermTokens(detailText, stop.terms || []);
  injectTermTokens(detailTranscript, stop.terms || []);
  detailTranscriptBlock.hidden = stop.transcriptBlocks.length === 0;

  if (detailContent) {
    detailContent.classList.remove("is-entering");
    void detailContent.offsetWidth;
    detailContent.classList.add("is-entering");
  }
  if (detailStrip) {
    detailStrip.classList.remove("is-entering");
    void detailStrip.offsetWidth;
    detailStrip.classList.add("is-entering");
  }

  detailAudio.pause();
  detailAudio.removeAttribute("src");
  detailPlayBtn.classList.remove("is-playing");
  detailPlayBtn.innerHTML = playIconHtml(DETAIL_AUDIO_ICON_SIZE);
  if (detailMapBtn) {
    detailMapBtn.disabled = !stop.mapUrl;
  }

  if (stop.audioUrl) {
    detailAudio.src = stop.audioUrl;
    if (previewWasPlaying) {
      detailAudio.currentTime = previewTime;
      detailAudio.play().then(() => {
        detailPlayBtn.classList.add("is-playing");
        detailPlayBtn.innerHTML = pauseIconHtml(DETAIL_AUDIO_ICON_SIZE);
      }).catch(() => {});
    }
    detailPlayBtn.disabled = false;
  } else {
    detailPlayBtn.disabled = true;
  }
  if (stop.audioUrl || stop.mapUrl) {
    playerDock?.classList.remove("hidden");
  } else {
    playerDock?.classList.add("hidden");
  }

  updateDetailStopNavState();
}

function getActiveStopIndex() {
  if (!activeStop?.id) return -1;
  return tourStopsData.findIndex((item) => item.id === activeStop.id);
}

function updateDetailStopNavState() {
  if (!detailPrevBtn || !detailNextBtn) return;
  const activeIndex = getActiveStopIndex();
  detailPrevBtn.disabled = activeIndex <= 0;
  detailNextBtn.disabled = activeIndex < 0 || activeIndex >= tourStopsData.length - 1;
}

function openAdjacentStop(step) {
  const activeIndex = getActiveStopIndex();
  if (activeIndex < 0) return;
  const targetStop = tourStopsData[activeIndex + step];
  if (!targetStop) return;
  setDetailStop(targetStop);
  detailView?.scrollTo({ top: 0, behavior: "smooth" });
}

function openDetailById(stopId) {
  const stop = tourStopsData.find((item) => item.id === stopId);
  if (!stop) return;
  setDetailStop(stop);
  appShell.classList.add("is-detail");
  detailView.scrollTo({ top: 0, behavior: "smooth" });
}

function updateMapZoomLabel() {
  if (mapZoomResetBtn) {
    mapZoomResetBtn.textContent = `${Math.round(mapScale * 100)}%`;
  }
}

function applyMapTransform() {
  if (!mapPreviewImage) return;
  mapPreviewImage.style.transform = `translate(${mapOffsetX}px, ${mapOffsetY}px) scale(${mapScale})`;
  mapPreviewImage.style.transformOrigin = "center center";
  mapPreviewStage?.classList.toggle("is-zoomed", mapScale > 1.01);
  updateMapZoomLabel();
}

function clampMapScale(scale) {
  return Math.max(MAP_MIN_SCALE, Math.min(MAP_MAX_SCALE, scale));
}

function setMapScale(nextScale) {
  mapScale = clampMapScale(nextScale);
  if (mapScale <= 1.01) {
    mapOffsetX = 0;
    mapOffsetY = 0;
  }
  applyMapTransform();
}

function resetMapTransform() {
  mapPointers.clear();
  mapPinchStart = null;
  mapDragPointerId = null;
  mapScale = 1;
  mapOffsetX = 0;
  mapOffsetY = 0;
  applyMapTransform();
}

function handleMapPointerDown(event) {
  if (!mapPreviewStage || !mapPreviewModal || mapPreviewModal.classList.contains("hidden")) {
    return;
  }

  mapPreviewStage.setPointerCapture?.(event.pointerId);
  mapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (mapPointers.size === 1 && mapScale > 1) {
    mapDragPointerId = event.pointerId;
    mapDragStartX = event.clientX - mapOffsetX;
    mapDragStartY = event.clientY - mapOffsetY;
  }

  if (mapPointers.size === 2) {
    const [a, b] = Array.from(mapPointers.values());
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    mapPinchStart = {
      distance: Math.hypot(dx, dy),
      scale: mapScale
    };
    mapDragPointerId = null;
  }
}

function handleMapPointerMove(event) {
  if (!mapPointers.has(event.pointerId)) return;
  mapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (mapPointers.size === 2) {
    const [a, b] = Array.from(mapPointers.values());
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const distance = Math.hypot(dx, dy);

    if (!mapPinchStart || !mapPinchStart.distance) {
      mapPinchStart = { distance, scale: mapScale };
      return;
    }

    setMapScale(mapPinchStart.scale * (distance / mapPinchStart.distance));
    event.preventDefault();
    return;
  }

  if (mapPointers.size === 1 && mapDragPointerId === event.pointerId && mapScale > 1) {
    mapOffsetX = event.clientX - mapDragStartX;
    mapOffsetY = event.clientY - mapDragStartY;
    applyMapTransform();
    event.preventDefault();
  }
}

function handleMapPointerUp(event) {
  if (!mapPointers.has(event.pointerId)) return;
  mapPointers.delete(event.pointerId);

  if (mapPointers.size < 2) {
    mapPinchStart = null;
  }
  if (mapDragPointerId === event.pointerId) {
    mapDragPointerId = null;
  }

  mapPreviewStage?.releasePointerCapture?.(event.pointerId);
}

function handleMapWheel(event) {
  if (!mapPreviewModal || mapPreviewModal.classList.contains("hidden")) return;
  event.preventDefault();
  const delta = event.deltaY < 0 ? MAP_ZOOM_STEP : -MAP_ZOOM_STEP;
  setMapScale(mapScale + delta);
}

function handleMapDoubleClick(event) {
  event.preventDefault();
  if (mapScale > 1.01) {
    resetMapTransform();
  } else {
    setMapScale(2);
  }
}

function openMapPreviewByStopId(stopId) {
  const stop = stopsData.find((item) => item.id === stopId);
  if (!stop || !stop.mapUrl || !mapPreviewImage || !mapPreviewModal) return;

  if (mapPreviewTitle) {
    mapPreviewTitle.textContent = "地図";
  }
  mapPreviewImage.src = stop.mapUrl;
  mapPreviewImage.alt = `${stop.title} map preview`;
  mapPreviewImage.onload = () => {
    resetMapTransform();
  };
  mapPreviewModal.classList.remove("hidden");
}

function closeMapPreview() {
  mapPreviewModal?.classList.add("hidden");
  resetMapTransform();
}

function openTermModal(term, fallbackLabel = "Keyword") {
  if (!termModal || !termModalTitle || !termModalBody) return;
  termModalTitle.textContent = term?.title || fallbackLabel;

  const html = safeText(term?.textHtml, "");
  if (html) {
    termModalBody.innerHTML = html;
  } else {
    termModalBody.innerHTML = `<p>${escapeHtml(
      term?.text || "No additional details available."
    )}</p>`;
  }

  const inlineBodyImages = Array.from(termModalBody.querySelectorAll("img"))
    .map((img, index) => {
      const src = normalizeWpImageUrl(safeText(img.getAttribute("src"), ""));
      if (!src) return null;
      return {
        src,
        alt:
          safeText(img.getAttribute("alt"), "") ||
          `${term?.title || fallbackLabel} image ${index + 1}`
      };
    })
    .filter(Boolean);
  termModalBody.querySelectorAll("img").forEach((img) => img.remove());

  if (termModalMedia) {
    termModalMedia.innerHTML = "";
    termModalMedia.onscroll = null;
    const mediaTrack = document.createElement("div");
    mediaTrack.className = "term-modal-media-track";
    termModalMedia.appendChild(mediaTrack);
    const urlsFromTerm = Array.isArray(term?.imageUrls) && term.imageUrls.length
      ? term.imageUrls.map((url) => normalizeWpImageUrl(url))
      : term?.imageUrl
      ? [normalizeWpImageUrl(term.imageUrl)]
      : [];
    const mediaItems = [
      ...urlsFromTerm.map((url, index) => ({
        src: url,
        alt: `${term?.title || fallbackLabel} image ${index + 1}`
      })),
      ...inlineBodyImages
    ].filter((item) => item?.src);

    const seen = new Set();
    const uniqueMediaItems = mediaItems.filter((item) => {
      const key = item.src.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (uniqueMediaItems.length) {
      uniqueMediaItems.forEach((item) => {
        const frame = document.createElement("figure");
        frame.className = "term-media-item";

        const img = document.createElement("img");
        img.alt = item.alt;
        img.loading = "lazy";
        const setOrientationClass = () => {
          const isLandscape = img.naturalWidth >= img.naturalHeight;
          frame.classList.toggle("is-landscape", isLandscape);
          frame.classList.toggle("is-portrait", !isLandscape);
        };
        img.addEventListener("load", setOrientationClass);
        img.src = item.src;
        if (img.complete && img.naturalWidth > 0) {
          setOrientationClass();
        }

        frame.appendChild(img);
        mediaTrack.appendChild(frame);
      });

      const frames = Array.from(mediaTrack.querySelectorAll(".term-media-item"));
      const containerW = termModalMedia.clientWidth;
      if (containerW > 0) {
        frames.forEach((frame) => {
          frame.style.minWidth = `${containerW}px`;
          frame.style.maxWidth = `${containerW}px`;
        });
      }
      const total = frames.length;
      let activeIndex = 0;

      const paintGalleryMeta = (index) => {
        const safeIndex = Math.max(0, Math.min(total - 1, index));
        activeIndex = safeIndex;
        if (termGalleryCount) {
          termGalleryCount.textContent = `${safeIndex + 1} / ${total}`;
        }
        if (termGalleryDots) {
          Array.from(termGalleryDots.children).forEach((dot, dotIndex) => {
            dot.classList.toggle("is-active", dotIndex === safeIndex);
          });
        }
      };

      if (termGalleryMeta) {
        termGalleryMeta.classList.remove("hidden");
      }
      if (termGalleryDots) {
        termGalleryDots.innerHTML = "";
        frames.forEach((frame, dotIndex) => {
          const dot = document.createElement("button");
          dot.type = "button";
          dot.className = "term-gallery-dot";
          dot.setAttribute("aria-label", `Go to image ${dotIndex + 1}`);
          dot.addEventListener("click", () => {
            frame.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
            paintGalleryMeta(dotIndex);
          });
          termGalleryDots.appendChild(dot);
        });
      }

      const updateActiveFromScroll = () => {
        if (!frames.length) return;
        const gap = parseFloat(
          getComputedStyle(mediaTrack).columnGap ||
          getComputedStyle(mediaTrack).gap ||
          "0"
        ) || 0;
        const first = frames[0];
        const step = first.getBoundingClientRect().width + gap;
        if (!step) return;
        const guessed = Math.round(termModalMedia.scrollLeft / step);
        paintGalleryMeta(guessed);
      };

      termModalMedia.classList.remove("hidden");
      termModalMedia.scrollLeft = 0;
      requestAnimationFrame(() => {
        termModalMedia.scrollTo({ left: 0, top: 0, behavior: "auto" });
        paintGalleryMeta(activeIndex);
      });
      termModalMedia.onscroll = updateActiveFromScroll;
    } else {
      termModalMedia.classList.add("hidden");
      if (termGalleryMeta) {
        termGalleryMeta.classList.add("hidden");
      }
      if (termGalleryDots) {
        termGalleryDots.innerHTML = "";
      }
      if (termGalleryCount) {
        termGalleryCount.textContent = "0 / 0";
      }
    }
  }
  termModal.classList.remove("hidden");
}

function closeTermModal() {
  termModal?.classList.add("hidden");
}

async function toggleStopPreviewAudio(stopId, triggerButton) {
  const stop = stopsData.find((item) => item.id === stopId);
  if (!stop || !stop.audioUrl) return;

  detailAudio.pause();
  detailPlayBtn.classList.remove("is-playing");
  detailPlayBtn.innerHTML = playIconHtml(DETAIL_AUDIO_ICON_SIZE);

  const sameButton = activePreviewButton === triggerButton;
  if (sameButton && !listPreviewAudio.paused) {
    listPreviewAudio.pause();
    triggerButton.classList.remove("is-playing");
    triggerButton.innerHTML = playIconHtml();
    activePreviewButton = null;
    return;
  }

  if (activePreviewButton && activePreviewButton !== triggerButton) {
    activePreviewButton.classList.remove("is-playing");
    activePreviewButton.innerHTML = playIconHtml();
  }

  activePreviewButton = triggerButton;
  triggerButton.classList.add("is-playing");
  triggerButton.innerHTML = pauseIconHtml();

  if (listPreviewAudio.getAttribute("src") !== stop.audioUrl) {
    listPreviewAudio.src = stop.audioUrl;
  }

  try {
    await listPreviewAudio.play();
  } catch (error) {
    triggerButton.classList.remove("is-playing");
    triggerButton.innerHTML = playIconHtml();
    activePreviewButton = null;
  }
}

function closeDetail() {
  appShell.classList.remove("is-detail");
  closeStopPicker();
  detailAudio.pause();
  detailPlayBtn.classList.remove("is-playing");
  detailPlayBtn.innerHTML = playIconHtml(DETAIL_AUDIO_ICON_SIZE);
  Array.from(detailHeroTrack?.querySelectorAll("video") || []).forEach((video) => {
    video.pause();
  });
  stopHeroSlideshow();
}

function bindKeywordClick(container) {
  if (!container) return;
  container.addEventListener("click", (event) => {
    const keywordNode = event.target.closest("[data-term-key]");
    if (!keywordNode) return;

    event.preventDefault();
    const key = normalizeTermKey(keywordNode.getAttribute("data-term-key") || "");
    if (!key) return;

    const term = activeTermLookup.get(key);
    openTermModal(term, toPlainText(keywordNode.textContent || "Keyword"));
  });
}

function buildStopPicker() {
  if (!stopPickerItems) return;
  stopPickerItems.innerHTML = "";

  tourStopsData.forEach((stop) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stop-picker-item";
    btn.dataset.stopId = stop.id;

    const numSpan = document.createElement("span");
    numSpan.className = "stop-picker-num";
    numSpan.textContent = stop.number;

    const titleSpan = document.createElement("span");
    titleSpan.className = "stop-picker-title";
    titleSpan.textContent = stop.title;

    btn.appendChild(numSpan);
    btn.appendChild(titleSpan);

    btn.addEventListener("click", () => {
      closeStopPicker();
      openDetailById(stop.id);
    });

    stopPickerItems.appendChild(btn);
  });
}

function openStopPicker() {
  if (!stopPicker) return;
  if (stopPickerItems && activeStop) {
    stopPickerItems.querySelectorAll(".stop-picker-item").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.stopId === activeStop.id);
    });
  }
  stopPicker.classList.remove("hidden");
}

function closeStopPicker() {
  stopPicker?.classList.add("hidden");
}

function bindEvents() {
  introButton?.addEventListener("click", () => {
    const firstTourStop = tourStopsData[0];
    if (firstTourStop) {
      openDetailById(firstTourStop.id);
    }
  });

  introCard?.addEventListener("click", (event) => {
    if (event.target.closest("button,video")) return;
    const firstTourStop = tourStopsData[0];
    if (firstTourStop) {
      openDetailById(firstTourStop.id);
    }
  });

  backButton?.addEventListener("click", closeDetail);
  mapPreviewClose?.addEventListener("click", closeMapPreview);
  termModalClose?.addEventListener("click", closeTermModal);

  mapZoomInBtn?.addEventListener("click", () => setMapScale(mapScale + MAP_ZOOM_STEP));
  mapZoomOutBtn?.addEventListener("click", () => setMapScale(mapScale - MAP_ZOOM_STEP));
  mapZoomResetBtn?.addEventListener("click", resetMapTransform);

  mapPreviewStage?.addEventListener("pointerdown", handleMapPointerDown);
  mapPreviewStage?.addEventListener("pointermove", handleMapPointerMove);
  mapPreviewStage?.addEventListener("pointerup", handleMapPointerUp);
  mapPreviewStage?.addEventListener("pointercancel", handleMapPointerUp);
  mapPreviewStage?.addEventListener("pointerleave", handleMapPointerUp);
  mapPreviewStage?.addEventListener("wheel", handleMapWheel, { passive: false });
  mapPreviewStage?.addEventListener("dblclick", handleMapDoubleClick);

  mapPreviewModal?.addEventListener("click", (event) => {
    if (event.target === mapPreviewModal) closeMapPreview();
  });

  termModal?.addEventListener("click", (event) => {
    if (event.target === termModal) closeTermModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!mapPreviewModal?.classList.contains("hidden")) {
      closeMapPreview();
      return;
    }
    if (!termModal?.classList.contains("hidden")) {
      closeTermModal();
      return;
    }
    if (!stopPicker?.classList.contains("hidden")) {
      closeStopPicker();
      return;
    }
    closeDetail();
  });

  stopList?.addEventListener("click", (event) => {
    const mapButton = event.target.closest(".open-link");
    if (mapButton) {
      openMapPreviewByStopId(mapButton.dataset.stopId || "");
      return;
    }

    const playButton = event.target.closest(".play-btn");
    if (playButton) {
      toggleStopPreviewAudio(playButton.dataset.stopId || "", playButton);
      return;
    }

    const stopInfo = event.target.closest(".stop-info");
    if (stopInfo) {
      const card = stopInfo.closest(".stop-card");
      openDetailById(card?.dataset.stopId || "");
    }
  });

  detailPlayBtn?.addEventListener("click", async () => {
    if (!activeStop?.audioUrl) return;

    if (detailAudio.paused) {
      try {
        await detailAudio.play();
        detailPlayBtn.classList.add("is-playing");
        detailPlayBtn.innerHTML = pauseIconHtml(DETAIL_AUDIO_ICON_SIZE);
      } catch (error) {
        detailPlayBtn.classList.remove("is-playing");
        detailPlayBtn.innerHTML = playIconHtml(DETAIL_AUDIO_ICON_SIZE);
      }
    } else {
      detailAudio.pause();
      detailPlayBtn.classList.remove("is-playing");
      detailPlayBtn.innerHTML = playIconHtml(DETAIL_AUDIO_ICON_SIZE);
    }
  });

  detailMapBtn?.addEventListener("click", () => {
    if (!activeStop?.id || !activeStop?.mapUrl) return;
    openMapPreviewByStopId(activeStop.id);
  });

  detailAudio.addEventListener("ended", () => {
    detailPlayBtn.classList.remove("is-playing");
    detailPlayBtn.innerHTML = playIconHtml(DETAIL_AUDIO_ICON_SIZE);
  });

  listPreviewAudio.addEventListener("ended", () => {
    if (activePreviewButton) {
      activePreviewButton.classList.remove("is-playing");
      activePreviewButton.innerHTML = playIconHtml();
      activePreviewButton = null;
    }
  });

  detailPrevBtn?.addEventListener("click", () => {
    openAdjacentStop(-1);
  });
  detailNextBtn?.addEventListener("click", () => {
    openAdjacentStop(1);
  });

  bottomMenuBtn?.addEventListener("click", () => {
    if (stopPicker?.classList.contains("hidden")) {
      openStopPicker();
    } else {
      closeStopPicker();
    }
  });

  stopPickerBackdrop?.addEventListener("click", closeStopPicker);

  bindKeywordClick(detailText);
  bindKeywordClick(detailTranscript);
}

function animateVisibleCards() {
  const cards = document.querySelectorAll(".stop-card");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = "running";
        }
      });
    },
    {
      root: document.querySelector(".stop-list"),
      threshold: 0.25
    }
  );

  cards.forEach((card) => {
    card.style.animationPlayState = "paused";
    observer.observe(card);
  });
}

async function init() {
  if (!isTourPage) {
    window.location.replace("./entry.html");
    return;
  }

  bindEvents();

  appLoadingOverlay?.classList.remove("hidden");
  renderIntroCardVideo([]);

  try {
    stopsData = await loadStops();
  } catch (error) {
    console.error(error);
    stopsData = fallbackStops;
  }

  if (!stopsData.length) {
    stopsData = fallbackStops;
  }

  tourStopsData = getTourStops(stopsData);
  renderIntroCardVideo([]);
  renderStopList(tourStopsData);
  buildStopPicker();
  const initialDetailStop = tourStopsData[0] || getIntroStop(stopsData);
  if (initialDetailStop) {
    setDetailStop(initialDetailStop);
  }
  animateVisibleCards();
  appLoadingOverlay?.classList.add("hidden");
}

disablePwa();
init();
