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
  title: "800 Years of the Shimazu Family and the story of Japan's Modernization",
  highlight: "As you walk through the scenery before you, pause, ask questions, and search for answers as you go.",
  textBlocks: [
    "This journey traces more than 800 years of history.",
    "Step forward with curiosity and experience the site's living memory."
  ],
  transcriptBlocks: [],
  videoUrl: ""
};

function disablePwa() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
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
    (_match, _quote, _key, label) => safeText(label, "")
  );

  text = text.replace(
    /\[term\s+key=([^\]'" \t\r\n]+)\]?\s*([\s\S]*?)\[\/term\]/gi,
    (_match, _key, label) => safeText(label, "")
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
    "SPAN"
  ]);

  Array.from(temp.querySelectorAll("*")).forEach((node) => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent || ""));
      return;
    }

    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
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

function getLocalizedField(rawObj, key, fallback = "") {
  const lang = (document.documentElement.lang || "en").toLowerCase().startsWith("ja")
    ? "ja"
    : "en";
  const direct = safeText(rawObj?.[`${key}_${lang}`], "");
  const nested =
    rawObj?.translations && rawObj.translations[lang]
      ? safeText(rawObj.translations[lang][key], "")
      : "";
  return direct || nested || safeText(rawObj?.[key], fallback);
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
    rawStop?.map_url
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
    rawStop?.acf?.introVideoUrl
  ];

  return candidates.map((value) => resolveMediaUrl(value)).find(Boolean) || "";
}

function extractTextBlocks(rawHtml) {
  const decoded = replaceTermShortcodes(rawHtml);
  if (!decoded) return [];

  const temp = document.createElement("div");
  temp.innerHTML = decoded;

  const blocks = Array.from(temp.querySelectorAll("h2, h3, h4, p, ul, ol, blockquote"))
    .map((node) => sanitizeEntryBlockHtml(node.outerHTML || node.textContent || ""))
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
  const number = safeText(String(rawStop?.number ?? rawStop?.stop_number ?? index), String(index));
  const title = toPlainText(getLocalizedField(rawStop, "title", `Stop ${number}`));
  const highlightRaw =
    getLocalizedField(rawStop, "highlight2", "") ||
    getLocalizedField(rawStop, "highlight", "") ||
    getLocalizedField(rawStop, "featured", "");
  const paragraphCount = (highlightRaw.match(/<p[\s>]/gi) || []).length;
  const highlight = indentMultilineText(
    normalizeHighlightLines(
      toPlainTextWithBreaks(
        highlightRaw
      )
    )
  );

  const textSource =
    getLocalizedField(rawStop, "text", "") ||
    getLocalizedField(rawStop, "details_content", "") ||
    getLocalizedField(rawStop, "details", "");
  const transcriptSource = getLocalizedField(rawStop, "transcript", "");

  const media = collectMediaUrls(rawStop);
  const mapUrl = resolveImageUrl(rawStop?.mapUrl) || resolveImageUrl(rawStop?.map_url);
  const guideImages = (mapUrl ? media.filter(url => url !== mapUrl) : media);

  return {
    number,
    title,
    highlight,
    highlightHasList: /<li[\s>]/i.test(highlightRaw),
    highlightForceBullets: /<li[\s>]|<br\s*\/?>/i.test(highlightRaw) || paragraphCount > 1,
    textBlocks: extractTextBlocks(textSource),
    transcriptBlocks: extractTextBlocks(transcriptSource),
    videoUrl: getStopVideoUrl(rawStop),
    guideImages
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

  const mappedStops = data.stops.map((rawStop, index) => mapStop(rawStop, index));
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
      forceBullets: Boolean(current.highlightForceBullets || current.highlightHasList)
    });
    entryHighlight.classList.toggle("hidden", !hasHighlight);
  }
  if (entryHighlightLabel) {
    entryHighlightLabel.hidden = !entryHighlight || entryHighlight.classList.contains("hidden");
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

  const guideImages = Array.isArray(current.guideImages) ? current.guideImages.filter(Boolean) : [];
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
          entryGuideTrack.scrollTo({ left: entryGuideTrack.offsetWidth * i, behavior: "smooth" });
        });
        entryGuideDots.appendChild(dot);
      });

      entryGuideDots.classList.toggle("hidden", guideImages.length < 2);
      entryGuideTrack.addEventListener("scroll", () => {
        const idx = Math.round(entryGuideTrack.scrollLeft / entryGuideTrack.offsetWidth);
        entryGuideDots.querySelectorAll(".entry-guide-dot").forEach((d, i) => {
          d.classList.toggle("is-active", i === idx);
        });
      }, { passive: true });

      entryGuideGallery.classList.remove("hidden");
    } else {
      entryGuideGallery.classList.add("hidden");
    }
  }

  const videoUrl = resolveMediaUrl(current.videoUrl);

  if (entryVideo) {
    if (videoUrl) {
      entryVideo.src = videoUrl;
      entryVideo.controls = false;
      entryVideo.muted = true;
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
  if (entryUnmuteLabel) entryUnmuteLabel.textContent = muted ? "音声オン" : "音声オフ";
  if (entryUnmuteIcon) {
    entryUnmuteIcon.setAttribute(
      "d",
      muted
        ? "M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"
        : "M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"
    );
  }
  entryUnmuteBtn.classList.toggle("is-unmuted", !muted);
}

function bindEvents() {
  entryStartBtn?.addEventListener("click", () => {
    entryVideo?.pause();
    window.location.href = "./index.html?tour=1";
  });

  entryUnmuteBtn?.addEventListener("click", () => {
    if (!entryVideo) return;
    entryVideo.muted = !entryVideo.muted;
    updateUnmuteBtn();
  });
}

async function init() {
  bindEvents();

  try {
    const stopZero = await loadStopZero();
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
