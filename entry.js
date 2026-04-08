const DATA_URL =
  "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/?rest_route=/memorial/v1/tour";

const entryVideo = document.querySelector("#entryVideo");
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

  const blocks = Array.from(temp.querySelectorAll("p, li"))
    .map((node) => safeText(node.textContent || "", ""))
    .filter(Boolean);

  if (blocks.length) return blocks;

  const fullText = safeText(temp.textContent || "", "");
  if (!fullText) return [];

  return fullText
    .split(/\n{2,}/)
    .map((line) => safeText(line, ""))
    .filter(Boolean);
}

function mapStop(rawStop, index) {
  const number = safeText(String(rawStop?.number ?? rawStop?.stop_number ?? index), String(index));
  const title = toPlainText(getLocalizedField(rawStop, "title", `Stop ${number}`));
  const highlight = toPlainText(
    getLocalizedField(rawStop, "highlight", "") || getLocalizedField(rawStop, "featured", "")
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
    const highlightText = safeText(current.highlight, "");
    entryHighlight.textContent = highlightText;
    entryHighlight.classList.toggle("hidden", !highlightText);
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
      const p = document.createElement("p");
      p.textContent = line;
      entryText.appendChild(p);
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
        img.alt = `Guide image ${i + 1}`;
        img.className = "entry-guide-item";
        img.loading = "lazy";
        entryGuideTrack.appendChild(img);

        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "entry-guide-dot" + (i === 0 ? " is-active" : "");
        dot.setAttribute("aria-label", `Image ${i + 1}`);
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
      entryVideo.removeAttribute("poster");
      entryVideo.classList.remove("hidden");
      entryVideo.play().catch(() => {});
    } else {
      entryVideo.pause();
      entryVideo.removeAttribute("src");
      entryVideo.load();
      entryVideo.classList.add("hidden");
    }
  }

}

function bindEvents() {
  entryStartBtn?.addEventListener("click", () => {
    window.location.href = "./index.html?tour=1";
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
  }
}

init();
