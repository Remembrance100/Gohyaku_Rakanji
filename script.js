const DATA_URL =
  "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/?rest_route=/memorial/v1/tour";
const SLIDE_INTERVAL_MS = 3000;

const appShell = document.querySelector("#appShell");
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
const detailText = document.querySelector("#detailText");
const detailTranscriptBlock = document.querySelector("#detailTranscriptBlock");
const detailTranscript = document.querySelector("#detailTranscript");
const detailAudioTitle = document.querySelector("#detailAudioTitle");
const detailThumb = document.querySelector("#detailThumb");
const detailView = document.querySelector(".detail-view");
const detailContent = document.querySelector("#detailContent");
const detailStrip = document.querySelector(".detail-strip");
const detailPlayBtn = document.querySelector("#detailPlayBtn");
const playerDock = document.querySelector(".player-dock");

const mapPreviewModal = document.querySelector("#mapPreviewModal");
const mapPreviewImage = document.querySelector("#mapPreviewImage");
const mapPreviewClose = document.querySelector("#mapPreviewClose");

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

let activeStop = null;
let stopsData = [];
let activePreviewButton = null;
let heroSlideIndex = 0;
let heroSlideTimer = null;
let activeTermLookup = new Map();

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
      const value = attr.value;

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
  const highlightRaw =
    getLocalizedField(rawStop, "highlight", "") ||
    getLocalizedField(rawStop, "featured", "");

  const textSource =
    getLocalizedField(rawStop, "text", "") ||
    getLocalizedField(rawStop, "details_content", "") ||
    getLocalizedField(rawStop, "details", "");
  const transcriptSource = getLocalizedField(rawStop, "transcript", "");

  const textBlocks = extractRichBlocksFromSource(textSource);
  let transcriptBlocks = extractRichBlocksFromSource(transcriptSource);
  const media = collectMediaUrls(rawStop, index);
  const terms = normalizeStopTerms(rawStop);
  const highlightBlock = sanitizeRichInlineHtml(highlightRaw);
  const questionText = toPlainText(highlightRaw);

  const textPlain = textBlocks.map((block) => toPlainText(block)).join("\n").trim();
  const transcriptPlain = transcriptBlocks
    .map((block) => toPlainText(block))
    .join("\n")
    .trim();
  if (textPlain && transcriptPlain && textPlain === transcriptPlain) {
    transcriptBlocks = [];
  }

  const useHighlightAsBody = !textBlocks.length && Boolean(highlightBlock);

  return {
    id: safeText(String(rawStop?.id || ""), `stop-${number}`),
    number,
    title: titleText || `Stop ${number}`,
    media,
    thumb: media[0],
    question: useHighlightAsBody ? "" : questionText,
    highlightAsBody: useHighlightAsBody,
    textBlocks: textBlocks.length
      ? textBlocks
      : [
          highlightBlock
            ? highlightBlock
            : escapeHtml("Content for this stop is being prepared.")
        ],
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
  introCard.classList.remove("has-video");

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
    introVideoEl.setAttribute("preload", "metadata");
    introVideoEl.setAttribute("aria-label", "Introduction video");
    introCard.prepend(introVideoEl);
  }

  const firstStop = Array.isArray(stops) && stops.length ? stops[0] : null;
  const introVideoUrl = resolveMediaUrl(firstStop?.videoUrl);
  const introPoster = resolveImageUrl(firstStop?.thumb);
  if (introPoster) {
    introVideoEl.poster = introPoster;
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
  const setIntroVideoFit = () => {
    const isPortrait = introVideoEl.videoHeight > introVideoEl.videoWidth * 1.08;
    introVideoEl.classList.toggle("is-portrait", isPortrait);
    introVideoEl.classList.toggle("is-landscape", !isPortrait);
  };
  introVideoEl.onloadedmetadata = setIntroVideoFit;
  introVideoEl.classList.remove("hidden");
  introCard.hidden = false;
  introCard.classList.add("has-video");
  introVideoEl.play().catch(() => {});
  if (introVideoEl.readyState >= 1) {
    setIntroVideoFit();
  }
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
    playButton.textContent = "▶";
    playButton.dataset.stopId = stop.id;
    playButton.disabled = !stop.audioUrl;

    thumb.appendChild(thumbImage);
    thumb.appendChild(playButton);

    const stopInfo = document.createElement("div");
    stopInfo.className = "stop-info";
    const stopTitle = document.createElement("h3");
    stopTitle.textContent = `${stop.number} | ${stop.title}`;
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
    mapButton.textContent = "MAP";
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
    bar.style.width = idx < index ? "100%" : "0";
    if (idx === index) {
      void bar.offsetWidth;
      bar.style.animation = `slideProgress ${SLIDE_INTERVAL_MS}ms linear forwards`;
    }
  });
}

function showHeroSlide(index, restartTimer = true) {
  const slides = detailHeroTrack?.querySelectorAll(".detail-hero-media");
  if (!slides?.length) return;
  const hasVideo = Array.from(slides).some((slide) => slide instanceof HTMLVideoElement);

  heroSlideIndex = (index + slides.length) % slides.length;
  slides.forEach((slide, idx) => {
    const isActive = idx === heroSlideIndex;
    slide.classList.toggle("active", isActive);
    if (slide instanceof HTMLVideoElement && !isActive) {
      slide.pause();
    }
  });
  animateActiveSlideIndicator(heroSlideIndex);

  if (restartTimer && slides.length > 1 && !hasVideo) {
    stopHeroSlideshow();
    heroSlideTimer = setInterval(() => {
      showHeroSlide(heroSlideIndex + 1, false);
    }, SLIDE_INTERVAL_MS);
  }
}

function renderHeroSlideshow(stop) {
  if (!detailHeroTrack || !detailHeroIndicators) return;
  stopHeroSlideshow();
  Array.from(detailHeroTrack.querySelectorAll("video")).forEach((video) => {
    video.pause();
  });

  detailHeroTrack.innerHTML = "";
  detailHeroIndicators.innerHTML = "";
  if (stop.videoUrl && stop.number !== "0") {
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
      if (heroMedia.length > 1) showHeroSlide(heroSlideIndex + 1, true);
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
    indicator.addEventListener("click", () => showHeroSlide(index, true));

    detailHeroIndicators.appendChild(indicator);
  });

  heroSlideIndex = 0;
  showHeroSlide(0, true);
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

  listPreviewAudio.pause();
  if (activePreviewButton) {
    activePreviewButton.classList.remove("is-playing");
    activePreviewButton.textContent = "▶";
    activePreviewButton = null;
  }

  renderHeroSlideshow(stop);
  detailNumber.textContent = stop.number;
  detailTitle.textContent = stop.title;
  detailAudioTitle.textContent = `${stop.number} | ${stop.title}`;
  detailThumb.src = stop.thumb;
  detailThumb.alt = stop.title;

  detailQuestion.textContent = stop.question;
  detailQuestionBlock.hidden = !safeText(stop.question, "");

  renderRichBlocks(detailText, stop.textBlocks);
  Array.from(detailText.children).forEach((node) => {
    node.classList.remove("detail-highlight-lead");
  });
  if (stop.highlightAsBody && detailText.firstElementChild) {
    detailText.firstElementChild.classList.add("detail-highlight-lead");
  }
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
  detailPlayBtn.textContent = "▶";

  if (stop.audioUrl) {
    detailAudio.src = stop.audioUrl;
    detailPlayBtn.disabled = false;
    playerDock.hidden = false;
  } else {
    detailPlayBtn.disabled = true;
    playerDock.hidden = true;
  }
}

function openDetailById(stopId) {
  const stop = stopsData.find((item) => item.id === stopId);
  if (!stop) return;
  setDetailStop(stop);
  appShell.classList.add("is-detail");
  detailView.scrollTo({ top: 0, behavior: "smooth" });
}

function openMapPreviewByStopId(stopId) {
  const stop = stopsData.find((item) => item.id === stopId);
  if (!stop || !stop.mapUrl || !mapPreviewImage || !mapPreviewModal) return;
  mapPreviewImage.src = stop.mapUrl;
  mapPreviewImage.alt = `${stop.title} map preview`;
  mapPreviewModal.classList.remove("hidden");
}

function closeMapPreview() {
  mapPreviewModal?.classList.add("hidden");
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
  detailPlayBtn.textContent = "▶";

  const sameButton = activePreviewButton === triggerButton;
  if (sameButton && !listPreviewAudio.paused) {
    listPreviewAudio.pause();
    triggerButton.classList.remove("is-playing");
    triggerButton.textContent = "▶";
    activePreviewButton = null;
    return;
  }

  if (activePreviewButton && activePreviewButton !== triggerButton) {
    activePreviewButton.classList.remove("is-playing");
    activePreviewButton.textContent = "▶";
  }

  activePreviewButton = triggerButton;
  triggerButton.classList.add("is-playing");
  triggerButton.textContent = "⏸";

  if (listPreviewAudio.getAttribute("src") !== stop.audioUrl) {
    listPreviewAudio.src = stop.audioUrl;
  }

  try {
    await listPreviewAudio.play();
  } catch (error) {
    triggerButton.classList.remove("is-playing");
    triggerButton.textContent = "▶";
    activePreviewButton = null;
  }
}

function closeDetail() {
  appShell.classList.remove("is-detail");
  detailAudio.pause();
  detailPlayBtn.classList.remove("is-playing");
  detailPlayBtn.textContent = "▶";
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

function bindEvents() {
  introButton?.addEventListener("click", () => {
    const firstStop = stopsData[0];
    if (firstStop) {
      openDetailById(firstStop.id);
    }
  });

  introCard?.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    const firstStop = stopsData[0];
    if (firstStop) {
      openDetailById(firstStop.id);
    }
  });

  backButton?.addEventListener("click", closeDetail);
  mapPreviewClose?.addEventListener("click", closeMapPreview);
  termModalClose?.addEventListener("click", closeTermModal);

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
        detailPlayBtn.textContent = "⏸";
      } catch (error) {
        detailPlayBtn.classList.remove("is-playing");
        detailPlayBtn.textContent = "▶";
      }
    } else {
      detailAudio.pause();
      detailPlayBtn.classList.remove("is-playing");
      detailPlayBtn.textContent = "▶";
    }
  });

  detailAudio.addEventListener("ended", () => {
    detailPlayBtn.classList.remove("is-playing");
    detailPlayBtn.textContent = "▶";
  });

  listPreviewAudio.addEventListener("ended", () => {
    if (activePreviewButton) {
      activePreviewButton.classList.remove("is-playing");
      activePreviewButton.textContent = "▶";
      activePreviewButton = null;
    }
  });

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
  bindEvents();
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

  renderIntroCardVideo(stopsData);
  renderStopList(stopsData);
  setDetailStop(stopsData[0]);
  animateVisibleCards();
}

init();
