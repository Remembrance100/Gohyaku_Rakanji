// Bootstraps tour.html: loads tour stops, renders the map, and manages stop/detail interactions.
const DATA_URL =
  "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/?rest_route=/memorial/v1/tour";

const appShell = document.querySelector("#appShell");
const appLoadingOverlay = document.querySelector("#appLoadingOverlay");
const mapPins = document.querySelector("#mapPins");
const mapImage = document.querySelector("#mapImage");
const mapInner = document.querySelector("#mapInner");
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
const playerDock = document.querySelector("#detailAudioInline");
const audioScrubber = document.querySelector("#audioScrubber");
const audioTimeCurrent = document.querySelector("#audioTimeCurrent");
const audioTimeDuration = document.querySelector("#audioTimeDuration");
const detailHighlight = document.querySelector("#detailHighlight");
const detailPrevBtn = document.querySelector("#detailPrevBtn");
const detailNextBtn = document.querySelector("#detailNextBtn");
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

const omamoriScreen = document.querySelector("#omamoriScreen");
const omamoriCloseBtn = document.querySelector("#omamoriCloseBtn");
const omamoriMsgVideo = document.querySelector("#omamoriMsgVideo");
const omamoriMsgUnmute = document.querySelector("#omamoriMsgUnmute");
const omamoriMsgUnmuteIcon = document.querySelector("#omamoriMsgUnmuteIcon");
const omamoriMsgUnmuteLabel = document.querySelector("#omamoriMsgUnmuteLabel");
const omamoriMsgSettings = document.querySelector("#omamoriMsgSettings");
const mapEndBtn = document.querySelector("#mapEndBtn");
const omamoriFullscreen = document.querySelector("#omamoriFullscreen");
const omamoriFullscreenVideo = document.querySelector(
  "#omamoriFullscreenVideo",
);
const omamoriFullscreenDl = document.querySelector("#omamoriFullscreenDl");
const omamoriFullscreenBack = document.querySelector("#omamoriFullscreenBack");
const omamoriTranscriptEl = document.getElementById("omamoriTranscript");

const detailAudio = new Audio();
const isTourPage =
  new URLSearchParams(window.location.search).get("tour") === "1";

let activeStop = null;
let rawStopsData = [];
let stopsData = [];
let tourStopsData = [];
let heroSlideIndex = 0;
let heroSlideTimer = null;
let heroTouchStartX = 0;
let heroTouchStartY = 0;
let heroTouchDeltaX = 0;
let heroTouchDeltaY = 0;
let heroTouchActive = false;
let heroSwipeLockedAxis = "";
let activeTermLookup = new Map();

const MAP_MIN_SCALE = 1;
const MAP_MAX_SCALE = 4;
const MAP_ZOOM_STEP = 0.25;
const HERO_SWIPE_THRESHOLD = 28;
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
      .then((registrations) =>
        Promise.all(
          registrations.map((registration) => registration.unregister()),
        ),
      )
      .catch(() => {});
  });
}

function formatTime(secs) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
      "https://picsum.photos/id/1035/1280/960",
    ],
    thumb: "https://picsum.photos/id/1040/120/80",
    question: "Why does this memorial begin at the gate?",
    highlight: "Why does this memorial begin at the gate?",
    textBlocks: [
      "This first stop introduces the idea of arrival, where visitors shift from daily life into a shared space of memory and reflection.",
    ],
    transcriptBlocks: [
      "Welcome to the memorial grounds. This tour begins at the entrance.",
    ],
    terms: [],
    audioUrl: "",
    mapUrl: "",
  },
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
  const upgraded = base.replace(
    /-\d+x\d+(?=\.(jpe?g|png|webp|gif|avif)$)/i,
    "",
  );
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTermTokenHtml(keyRaw, labelRaw = "") {
  const label = toPlainText(labelRaw) || toPlainText(keyRaw) || "term";
  return escapeHtml(label);
}

function replaceTermShortcodes(rawText) {
  let text = decodeEntitiesDeep(rawText);

  text = text.replace(
    /\[term\s+key=(['"])(.*?)\1\]?\s*([\s\S]*?)\[\/term\]/gi,
    (_match, _quote, key, label) => renderTermTokenHtml(key, label),
  );

  text = text.replace(
    /\[term\s+key=(['"])(.*?)\1\]?\s*\[\/term\]/gi,
    (_match, _quote, key) => renderTermTokenHtml(key, key),
  );

  text = text.replace(
    /\[term\s+key=([^\]'" \t\r\n]+)\]?\s*([\s\S]*?)\[\/term\]/gi,
    (_match, key, label) => renderTermTokenHtml(key, label),
  );

  text = text.replace(/\[term\s+key=([^\]'" \t\r\n]+)\]/gi, (_match, key) =>
    renderTermTokenHtml(key, key),
  );

  return text;
}

function getLangKey() {
  const lang = (document.documentElement.lang || "ja").toLowerCase();
  if (lang.startsWith("ja")) return "ja";
  if (lang.startsWith("ko")) return "ko";
  if (lang.startsWith("zh")) return "zh";
  return "en";
}

const PREFS_KEY = "tourPrefs";

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
  } catch {
    return {};
  }
}

function getRequestedLang() {
  const params = new URLSearchParams(window.location.search);
  const langParam = safeText(params.get("lang"), "").toLowerCase();
  if (langParam.startsWith("ja")) return "ja";
  if (langParam.startsWith("en")) return "en";
  if (langParam.startsWith("ko")) return "ko";
  if (langParam.startsWith("zh")) return "zh";

  const savedLang = safeText(loadPrefs().lang, "").toLowerCase();
  if (savedLang.startsWith("en")) return "en";
  if (savedLang.startsWith("ko")) return "ko";
  if (savedLang.startsWith("zh")) return "zh";
  return "ja";
}

const UI_STRINGS = {
  ja: {
    "audio-on": "音声オン",
    "audio-off": "音声オフ",
    "label-language": "言語",
    "label-fontsize": "文字サイズ",
    "font-sample-large": "あ",
    "font-small": "小",
    "font-normal": "中",
    "font-large": "大",
    "notice-photo": "羅漢像や位牌の撮影はご遠慮ください。",
    "notice-quiet": "音声ガイドの音量にご注意いただき、周りの方のご迷惑にならないようご配慮ください。",
    "notice-smoke": "境内での喫煙は禁止されています。",
    "notice-offering": "お賽銭はお賽銭箱にお入れください、像の上に置かないでください。",
    "notice-pets": "ペットの境内への持ち込みはご遠慮ください。",
    "confirm-btn": "閉じる",
    "end-tour-btn": "ガイド終了",
    "map-preview-title": "地図",
    "highlight-label": "ハイライト",
    "audio-guide-heading": "音声ガイド",
    "all-stops-heading": "全スポット",
    "map-end-btn": "ガイド終了",
    "omamori-priest-role": "住職より",
    "omamori-priest-quote": "「本日はご参拝いただき、誠にありがとうございます。この地に眠る御霊が、皆様の歩みをいつまでも見守っておられます。どうかお守りを携え、健やかな日々をお過ごしください。」",
    "omamori-eyebrow": "記念品",
    "omamori-title": "お守り",
    "omamori-subtitle": "ツアーの記念に、お守りGIFをお選びください。",
    "omamori-blue-name": "蒼 Omamori",
    "omamori-blue-desc": "学業成就・旅行安全",
    "omamori-gold-name": "金 Omamori",
    "omamori-gold-desc": "商売繁盛・金運祈願",
    "omamori-pink-name": "桃 Omamori",
    "omamori-pink-desc": "縁結び・健康祈願",
    "omamori-save-btn": "保存",
    "omamori-fullscreen-save": "お守りを保存",
    "omamori-transcript-label": "トランスクリプト",
    "omamori-transcript-q1": "羅漢さんの前に立ち止まった時、何を考えてほしいですか？",
    "omamori-transcript-a1": "いろんな気持ちが出てくると思うんですね。その時にこう、いろんな感情があると思うんですけども、その、感じられた気持ちをぜひね、大切にしていただきたい。素直に、驚いたのか、これは何だろうと疑問に思ったのかとかですね、あの、不思議な気持ちになったのかとか、いろんなこう、楽しい気持ちになったのかとか、それぞれのですね、まあ先、説明の中でも、以前、申しましたが、その、鏡のようにですね、自分と向き合うようなものなので、ぜひですね、その時感じられた、今のご自身の気持ちをですね、ぜひ大切にしていただきたい。で、機会があればぜひもう一度来ていただいてですね、またその時に感じられるもの、また別のものを感じられたらですね、さらに深まっていくのではないかと考えています。",
    "omamori-transcript-q2": "この305体の羅漢さんが、ガラスケースに入っていない理由は？",
    "omamori-transcript-a2": "ガラスケースに入れてしまうと、ま、皆様もですね、博物館とか美術館に行った時に、その、ケースの中に入った仏像とか、仏様の絵なんかを見られることがあると思うんですけども、その前に立ち止まって手を合わせるということはなかなかないんですね。ここは、お寺なので、ここで実際に法要、法事も行いますし、この信じている方、信仰されている方が来てですね、実際に手を合わせることもある。これが全てガラスケースに入ってしまうと、そういう信仰の場を失ってしまうんですね。ですから、このように手を伸ばせば触れられるような、身近にですね、感じられる場所にですね、安置させていただいてます。その木造、木でできているので、先ほどの話の、なんですけど、ガラスケースに入れて空調管理していかないと、どんどん、どんどん、朽ちていっちゃうんですよね。で、実際問題、まああと、何、まあ、100年、200年もすればですね、この状態が実際保てるかどうかってのは非常に難しいんですけれども、仏教では、ま、その、一期一会っていう言葉がありますようにですね、今この瞬間に巡り合えたっていう、この、その時間も大切にしていただきたい。あの、形が変わっていくのももう仕方が無いんですけども、うん、今この時代に生まれて、今この瞬間ここに、来ることができた、この羅漢像と出会うことができたというですね、その奇跡をぜひ、どこか心に、留めていただければな、とは思いますね、うん。",
    "omamori-transcript-q3": "10年後、50年後の羅漢寺はどんな場所であってほしいですか？",
    "omamori-transcript-a3": "10年後、50年後にですね、まあいろいろ、世界というものはどんどん、どんどん変わっていくと思います。けれどもですね、やはり心の拠り所、安らぐ場所としてですね、今と変わらない状態でですね、この羅漢像が50年後にも残っていてほしい。今、我々が見ているものをですね、50年後の人々にもですね、ぜひ見ていただきたい。これ、350年前からですね、繋がっているものを我々は、次の世代にですね、渡さなければ、そのまま引き継いでいくことが使命だと思っておりますので、ぜひ、この今の状態、今の羅漢寺のままですね、今の羅漢像のまま、残っていたらいいなと、心から思っています。",
    "coach-1": "番号の付いたピンをタップすると、各スポットが開きます。",
    "coach-2": "このボタンをタップすると言語や設定を変更できます。",
    "coach-3a": "スポットのタイトルと番号です。今どのスポットにいるかが一目でわかります。",
    "coach-3b": "ハイライトには、そのスポットの見どころや重要なポイントがまとめられています。",
    "coach-3": "再生ボタンをタップすると音声ガイドが始まります。バーをドラッグして位置を調整できます。",
    "coach-3c": "テキストガイドには、このスポットの詳しい解説が記載されています。",
    "coach-end": "ツアーを終了するときは、このボタンをタップします。",
    "coach-back": "この「＜」ボタンをタップすると、マップに戻ります。",
    "coach-4": "この矢印ボタンで前後のスポットに移動できます。",
    "coach-next": "次へ",
    "coach-done": "始める",
    "coach-skip": "スキップ",
  },
  en: {
    "audio-on": "Audio On",
    "audio-off": "Audio Off",
    "label-language": "Language",
    "label-fontsize": "Text Size",
    "font-sample-large": "Aa",
    "font-small": "S",
    "font-normal": "M",
    "font-large": "L",
    "notice-photo": "Please refrain from photographing Rakan statues and memorial tablets.",
    "notice-quiet": "Please be mindful of the audio guide volume so as not to disturb those around you.",
    "notice-smoke": "Smoking is not permitted on the grounds.",
    "notice-offering": "Please place offerings in the offering box, not on top of the statues.",
    "notice-pets": "Pets are not allowed inside the temple grounds.",
    "confirm-btn": "Close",
    "end-tour-btn": "End Tour",
    "map-preview-title": "Map",
    "highlight-label": "Highlights",
    "audio-guide-heading": "Audio Guide",
    "all-stops-heading": "All Stops",
    "map-end-btn": "End Tour",
    "omamori-priest-role": "From the Head Priest",
    "omamori-priest-quote": "\"Thank you for visiting today. May the souls resting here watch over your journey always. Please carry this omamori with you and live each day in good health.\"",
    "omamori-eyebrow": "Memorial Gift",
    "omamori-title": "Omamori",
    "omamori-subtitle": "Choose an omamori GIF as a memento of your tour.",
    "omamori-blue-name": "Ao Omamori",
    "omamori-blue-desc": "Academic success · Safe travels",
    "omamori-gold-name": "Kin Omamori",
    "omamori-gold-desc": "Business fortune · Prosperity",
    "omamori-pink-name": "Momo Omamori",
    "omamori-pink-desc": "Good relationships · Health",
    "omamori-save-btn": "Save",
    "omamori-fullscreen-save": "Save Omamori",
    "omamori-transcript-label": "Transcript",
    "omamori-transcript-q1": "When people stop and stand in front of the Rakan statues, what do you hope crosses their minds?",
    "omamori-transcript-a1": "I believe a wide variety of emotions will naturally come up. When that happens, whatever it is you feel, I truly want you to cherish that feeling. Whether it's straightforward surprise, curiosity about what it is, a sense of wonder, or a feeling of joy—whatever it may be. As I mentioned earlier in my explanation, these statues act like a mirror reflecting your inner self. So please, hold onto and value whatever emotion you feel in that exact moment. And if you have the chance, I hope you will visit again. If you feel something entirely different on your next visit, I believe your experience and understanding will deepen even further.",
    "omamori-transcript-q2": "Why are these 305 Rakan statues not kept inside glass display cases?",
    "omamori-transcript-a2": "When things are placed inside glass cases—as you might have experienced when seeing Buddhist statues or paintings at a museum or art gallery—people rarely stop to press their hands together in prayer. Because this is a temple, we actually hold memorial services and Buddhist rituals here, and believers come to pray before them. If everything were sealed inside glass cases, we would lose that space of living faith. That is why they are enshrined out in the open, close enough that you could reach out and touch them. Now, because they are made of wood, as I mentioned earlier, they will gradually decay unless they are kept in a climate-controlled glass case. Truthfully, it is highly uncertain whether they can be preserved in this exact condition 100 or 200 years from now. However, Buddhism teaches the concept of Ichigo Ichie—the idea of a once-in-a-lifetime encounter. We want people to cherish the very moment they cross paths with these statues. While it is inevitable that their physical forms will change over time, I hope visitors will hold a small place in their hearts for the miracle of being born into this era, coming here at this exact moment, and being able to encounter these Rakan statues.",
    "omamori-transcript-q3": "What kind of place do you hope Rakan-ji Temple will be in 10 or 50 years?",
    "omamori-transcript-a3": "Ten or fifty years from now, I am sure the world will continue to change rapidly. Even so, I sincerely hope that these Rakan statues will remain fifty years from now in the exact same state they are in today—serving as a spiritual anchor and a place of peace. I truly want people fifty years into the future to see exactly what we are looking at right now. We are holding onto something that has been continuously connected to the past for 350 years. I believe it is our solemn mission to hand this down to the next generation, to pass it along seamlessly. Therefore, I hope from the bottom of my heart that Rakan-ji and these Rakan statues can be preserved just as they are today.",
    "coach-1": "Tap a numbered pin to open that stop.",
    "coach-2": "Tap this button to change the language or adjust settings.",
    "coach-3a": "This is the stop title and number — it tells you exactly where you are.",
    "coach-3b": "The highlights section shows the key points and things to look for at this stop.",
    "coach-3": "Tap the play button to start the audio guide. Drag the bar to jump to any point.",
    "coach-3c": "The text guide has a full written description of this stop.",
    "coach-end": "Tap this button when you're ready to end the tour.",
    "coach-back": "Tap the « button to return to the map at any time.",
    "coach-4": "Use these arrows to move to the previous or next stop.",
    "coach-next": "Next",
    "coach-done": "Let's go",
    "coach-skip": "Skip",
  },
  ko: {
    "audio-on": "음성 켜기",
    "audio-off": "음성 끄기",
    "label-language": "언어",
    "label-fontsize": "글자 크기",
    "font-sample-large": "가",
    "font-small": "소",
    "font-normal": "중",
    "font-large": "대",
    "notice-photo": "나한상이나 위패 촬영은 삼가 주세요.",
    "notice-quiet": "오디오 가이드 볼륨에 주의하여 주변 분들께 불편을 드리지 않도록 배려해 주세요.",
    "notice-smoke": "경내 흡연은 금지되어 있습니다.",
    "notice-offering": "헌금은 헌금함에 넣어 주세요. 상 위에 올려놓지 마세요.",
    "notice-pets": "반려동물의 경내 동반은 삼가 주세요.",
    "confirm-btn": "닫기",
    "end-tour-btn": "투어 종료",
    "map-preview-title": "지도",
    "highlight-label": "하이라이트",
    "audio-guide-heading": "오디오 가이드",
    "all-stops-heading": "전체 스팟",
    "map-end-btn": "투어 종료",
    "omamori-priest-role": "주지 스님의 말씀",
    "omamori-priest-quote": "「오늘 참배해 주셔서 진심으로 감사드립니다. 이곳에 잠든 영혼들이 여러분의 발걸음을 언제나 지켜보고 있습니다. 부디 오마모리를 간직하시고 건강한 나날을 보내시기 바랍니다.」",
    "omamori-eyebrow": "기념품",
    "omamori-title": "오마모리",
    "omamori-subtitle": "투어 기념으로 오마모리 GIF를 선택해 주세요.",
    "omamori-blue-name": "파랑 오마모리",
    "omamori-blue-desc": "학업 성취 · 여행 안전",
    "omamori-gold-name": "금 오마모리",
    "omamori-gold-desc": "사업 번창 · 금운 기원",
    "omamori-pink-name": "분홍 오마모리",
    "omamori-pink-desc": "인연 · 건강 기원",
    "omamori-save-btn": "저장",
    "omamori-fullscreen-save": "오마모리 저장",
    "omamori-transcript-label": "대화록",
    "omamori-transcript-q1": "나한상 앞에 멈춰 섰을 때, 사람들이 어떤 생각을 하길 바라시나요?",
    "omamori-transcript-a1": "다양한 감정들이 피어오를 것이라 생각합니다. 그럴 때 느끼시는 그 감정들을 꼭 소중히 여겨주셨으면 합니다. 솔직하게 놀란 감정인지, '이게 뭘까' 하는 의문인지, 신비로운 느낌인지, 아니면 즐거운 마음인지... 각자가 느끼는 감정 말이죠. 앞서 설명해 드렸듯이 나한상은 스스로를 마주하게 하는 거울과 같은 존재입니다. 그러니 그 순간 느끼신 지금 선 자리에서의 스스로의 마음을 꼭 소중히 간직해 주시길 바랍니다. 그리고 기회가 된다면 꼭 한 번 더 찾아주셔서, 그때 또 다른 감정을 느끼게 되신다면 더욱 깊어지지 않을까 생각합니다.",
    "omamori-transcript-q2": "왜 이 305점의 나한상들은 유리 쇼케이스 안에 보관하지 않나요?",
    "omamori-transcript-a2": "유리 쇼케이스에 넣어두면, 여러분도 박물관이나 미술관에 가셨을 때 쇼케이스 안의 불상이나 불화를 보신 적이 있겠지만, 그 앞에서 발길을 멈추고 두 손을 모아 합장하는 일은 좀처럼 없습니다. 이곳은 사찰이기 때문에 실제로 법요와 법사를 지내기도 하고, 불자님들이 오셔서 실제로 합장을 하기도 합니다. 이 모든 것이 유리 쇼케이스 안에 들어가 버리면, 그러한 신앙의 장소를 잃어버리게 됩니다. 그래서 손을 뻗으면 닿을 듯한, 아주 가까이에서 느끼실 수 있는 자리에 모셔두고 있습니다. 나무로 만들어졌기 때문에, 유리 쇼케이스에 넣고 공조 시스템으로 관리하지 않으면 점점 노후화되고 썩어갈 수밖에 없습니다. 현실적으로 앞으로 100년, 200년이 지났을 때 이 상태가 그대로 유지될 수 있을지는 매우 장담하기 어렵습니다. 하지만 불교에는 '일기일회(一期一會)'라는 말이 있듯이, 지금 이 순간에 마주할 수 있었다는 그 시간 자체를 소중히 여겨주셨으면 합니다. 형태가 변해가는 것은 어쩔 수 없는 일이지만, 지금 이 시대에 태어나 지금 이 순간 이곳에 올 수 있었던 것, 그리고 이 나한상과 만날 수 있었다는 그 기적을 부디 마음 한구석에 간직해 주셨으면 좋겠습니다.",
    "omamori-transcript-q3": "10년 후, 혹은 50년 후에 라칸지가 어떤 장소가 되기를 바라시나요?",
    "omamori-transcript-a3": "10년 후, 50년 후에 세상은 정말이지 빠르게 변해갈 것이라 생각합니다. 그럼에도 불구하고, 역시 마음의 안식처이자 평온을 얻는 공간으로서 지금과 변함없는 모습으로 이 나한상들이 50년 후에도 남아있기를 바랍니다. 지금 우리가 보고 있는 이 풍경을 50년 후의 사람들도 꼭 볼 수 있었으면 좋겠습니다. 이것은 350년 전부터 이어져 온 소중한 유산이며, 우리가 다음 세대에게 온전히 전해주어야 할 사명이라고 생각합니다. 그렇기에 지금 이 상태의 라칸지 그대로, 지금 이 모습의 나한상 그대로 미래에도 남아주기를 진심으로 바라고 있습니다.",
    "coach-1": "번호가 붙은 핀을 탭하면 해당 스팟이 열립니다.",
    "coach-2": "이 버튼을 탭하면 언어나 설정을 변경할 수 있습니다.",
    "coach-3a": "스팟의 제목과 번호입니다. 지금 어느 스팟에 있는지 한눈에 알 수 있습니다.",
    "coach-3b": "하이라이트에는 이 스팟의 주요 볼거리와 핵심 포인트가 정리되어 있습니다.",
    "coach-3": "재생 버튼을 탭하면 오디오 가이드가 시작됩니다. 바를 드래그하여 위치를 조정할 수 있습니다.",
    "coach-3c": "텍스트 가이드에는 이 스팟에 대한 자세한 설명이 기재되어 있습니다.",
    "coach-end": "투어를 끝낼 준비가 되면 이 버튼을 탭하세요.",
    "coach-back": "「＜」 버튼을 탭하면 언제든지 지도로 돌아갑니다.",
    "coach-4": "이 화살표로 이전 또는 다음 스팟으로 이동할 수 있습니다.",
    "coach-next": "다음",
    "coach-done": "시작하기",
    "coach-skip": "건너뛰기",
  },
  zh: {
    "audio-on": "开启音频",
    "audio-off": "关闭音频",
    "label-language": "语言",
    "label-fontsize": "文字大小",
    "font-sample-large": "文",
    "font-small": "小",
    "font-normal": "中",
    "font-large": "大",
    "notice-photo": "请勿拍摄罗汉像或灵牌。",
    "notice-quiet": "请注意音频导览的音量，以免打扰周围的其他游客。",
    "notice-smoke": "境内禁止吸烟。",
    "notice-offering": "请将香钱放入功德箱，勿置于像上。",
    "notice-pets": "请勿携带宠物进入境内。",
    "confirm-btn": "关闭",
    "end-tour-btn": "结束导览",
    "map-preview-title": "地图",
    "highlight-label": "亮点",
    "audio-guide-heading": "语音导览",
    "all-stops-heading": "全部景点",
    "map-end-btn": "结束导览",
    "omamori-priest-role": "住持寄语",
    "omamori-priest-quote": "「感谢您今日的到访。长眠于此的灵魂将永远守护您的前行。请携带御守，祝您每天健康平安。」",
    "omamori-eyebrow": "纪念礼品",
    "omamori-title": "御守",
    "omamori-subtitle": "请选择一款御守GIF作为本次导览的纪念。",
    "omamori-blue-name": "蓝色御守",
    "omamori-blue-desc": "学业进步 · 旅途平安",
    "omamori-gold-name": "金色御守",
    "omamori-gold-desc": "生意兴隆 · 财运亨通",
    "omamori-pink-name": "粉色御守",
    "omamori-pink-desc": "良缘 · 健康祈愿",
    "omamori-save-btn": "保存",
    "omamori-fullscreen-save": "保存御守",
    "omamori-transcript-label": "文字记录",
    "omamori-transcript-q1": "当人们在罗汉像前停下脚步时，您希望他们心中浮现什么？",
    "omamori-transcript-a1": "我相信人们心中会涌现出各种各样的情感。当这些情绪出现时，无论是怎样的感受，都希望大家能好好珍惜。是直截了当的惊讶，还是「这是什么」的疑惑？是不可思议的好奇，还是心生欢喜？无论哪种皆可。正如我之前在采访中提到的，罗汉像像一面镜子，能让人审视内心。因此，请务必珍视那一刻您内心最真实的感受。如果以后有机会，希望您能再来走走。到那时，如果您产生了截然不同的新感受，我相信这份体验将会变得更加深厚。",
    "omamori-transcript-q2": "为什么这305尊罗汉像没有放入玻璃展柜中保存？",
    "omamori-transcript-a2": "如果把它们放入玻璃展柜——大家去博物馆或美术馆时应该也有过类似的经历，看到展柜里的佛像或佛画，人们将少会停下脚步并合掌参拜。但这里是寺院，我们实际上会在这里举行法事和法事，信众们也会前来合掌祈福。如果全部用玻璃框隔绝开来，就会失去这种信仰的圣地。因此，我们才把它们安奉在如此近距离的地方，仿佛伸手便可触及，因为是木雕，如果不放玻璃柜进行控温控湿，它们就会不可避免地逐渐劣化。从现实问题来看，再过一个百年、两百年，这些罗汉像是否还能保持现在的状态，是非常难说的。然而，佛教中讲求一期一会，我们也希望大家能好好珍惜此时此刻得到相遇的这段缘分。虽说外在形态的变化在所难免，但我由衷地希望，大家能将这份奇遇留在心底——那就是在当今时代、在此时此刻来到这里，并得以与这些罗汉像相遇。",
    "omamori-transcript-q3": "您希望十年后、五十年后的罗汉寺成为怎样的地方？",
    "omamori-transcript-a3": "我想，十年、五十年后，世界必定会发生翻天覆地的变化。然而，我依然由衷地希望，这些罗汉像在五十年后也能保持如今的面貌，继续作为一个能让人们净化心灵、安顿身心的道场。我非常渴望能让五十年后的人们，也亲眼在看我们此时此刻正凝望着的一切。这是自350年前便紧紧相连、承袭至今的财富，我认为，将其完好无损地传递给下一代，在手中继续薪火相传，是我们的使命。因此，我由衷地期盼着，未来的罗汉寺与眼前的罗汉像，都能以现在的模样永远留存下去。",
    "coach-1": "点击编号标记可打开该景点。",
    "coach-2": "点击此按钮可更改语言或调整设置。",
    "coach-3a": "这是景点的标题和编号，让您一目了然地知道自己在哪里。",
    "coach-3b": "亮点部分列出了该景点的看点和重要内容。",
    "coach-3": "点击播放按钮开始语音导览。拖动进度条可跳转到任意位置。",
    "coach-3c": "文字导览包含此景点的详细说明。",
    "coach-end": "准备结束导览时，点击此按钮。",
    "coach-back": "点击「＜」按钮可随时返回地图。",
    "coach-4": "使用这些箭头可切换到上一个或下一个景点。",
    "coach-next": "下一步",
    "coach-done": "出发",
    "coach-skip": "跳过",
  },
};

function applyUiLang(lang) {
  const t = UI_STRINGS[lang] || UI_STRINGS.ja;
  document.querySelectorAll("[data-t]").forEach((el) => {
    const key = el.getAttribute("data-t");
    if (t[key] !== undefined) el.textContent = t[key];
  });
}

function applySelectedLanguage() {
  const lang = getRequestedLang();
  document.documentElement.lang = lang;
  applyUiLang(lang);
}

function applyFontScale(sizeOverride) {
  const scales = { small: 0.88, normal: 1, large: 1.14, xlarge: 1.3, xxlarge: 1.5 };
  const sizeRemap = { small: "large", normal: "large" };
  const raw = sizeOverride || loadPrefs().size || "xlarge";
  const size = sizeRemap[raw] || raw;
  document.documentElement.style.setProperty(
    "--tour-font-scale",
    String(scales[size] || 1),
  );
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

function initTourSettings() {
  const screen = document.getElementById("tourSettingsScreen");
  const confirmBtn = document.getElementById("tourSettingsConfirmBtn");
  const langGrid = document.getElementById("tourSettingsLangGrid");
  const mapBtn = document.getElementById("mapSettingsBtn");
  const detailBtn = document.getElementById("detailSettingsBtn");
  if (!screen) return;

  const prefs = loadPrefs();
  const sizeRemap = { small: "large", normal: "large" };
  let selectedLang = prefs.lang || "ja";
  let selectedSize = sizeRemap[prefs.size] || prefs.size || "xlarge";

  function syncLangBtns() {
    langGrid?.querySelectorAll(".settings-lang-btn").forEach((btn) => {
      const active = btn.dataset.lang === selectedLang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  function syncFontBtns() {
    screen.querySelectorAll(".settings-font-btn").forEach((btn) => {
      const active = btn.dataset.size === selectedSize;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  function openSettings() {
    selectedLang = loadPrefs().lang || "ja";
    selectedSize = sizeRemap[loadPrefs().size] || loadPrefs().size || "xlarge";
    syncLangBtns();
    syncFontBtns();
    screen.classList.remove("is-hidden");
  }

  function closeSettings() {
    screen.classList.add("is-hidden");
  }

  syncLangBtns();
  syncFontBtns();

  langGrid?.addEventListener("click", (e) => {
    const btn = e.target.closest(".settings-lang-btn");
    if (!btn) return;
    selectedLang = btn.dataset.lang;
    document.documentElement.lang = selectedLang;
    applyUiLang(selectedLang);
    savePrefs({ lang: selectedLang, size: selectedSize });
    syncLangBtns();
    remapStopsForLang();
    syncOmamoriAudioBtn();
    reloadMsgPlayerForLang();
  });

  screen.querySelectorAll(".settings-font-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedSize = btn.dataset.size;
      savePrefs({ lang: selectedLang, size: selectedSize });
      applyFontScale(selectedSize);
      syncFontBtns();
    });
  });

  confirmBtn?.addEventListener("click", () => {
    savePrefs({ lang: selectedLang, size: selectedSize });
    closeSettings();
  });

  mapBtn?.addEventListener("click", openSettings);
  detailBtn?.addEventListener("click", openSettings);
  document.getElementById("omamoriMsgSettings")?.addEventListener("click", openSettings);
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

function pickLangHalf(raw, lang) {
  const text = safeText(raw, "");
  if (!text) return text;

  // Strip surrounding <p>…</p> tags that WordPress wraps bare delimiter lines in,
  // then match all dash/entity variants WordPress may produce from --- sequences.
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

function normalizeTermKey(value) {
  return safeText(String(value || ""), "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeRichInlineHtml(rawHtml) {
  const temp = document.createElement("div");
  temp.innerHTML = replaceTermShortcodes(rawHtml);

  const allowed = new Set([
    "A",
    "IMG",
    "SPAN",
    "STRONG",
    "EM",
    "B",
    "I",
    "U",
    "BR",
    "MARK",
    "CODE",
    "SUB",
    "SUP",
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
      if (name === "class") {
        return;
      }
      if (
        node.tagName === "A" &&
        (name === "href" || name === "target" || name === "rel")
      ) {
        return;
      }
      if (
        node.tagName === "IMG" &&
        (name === "src" ||
          name === "alt" ||
          name === "title" ||
          name === "loading")
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
    "SPAN",
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

      if (
        node.tagName === "A" &&
        (name === "href" || name === "target" || name === "rel")
      ) {
        return;
      }

      if (
        node.tagName === "IMG" &&
        (name === "src" ||
          name === "alt" ||
          name === "title" ||
          name === "loading")
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

  const blocks = Array.from(temp.childNodes).flatMap((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return safeText(node.textContent || "", "")
        .split(/\n{2,}/)
        .map((line) => safeText(line, ""))
        .filter(Boolean);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return [];
    }

    if (node.matches("p, li, blockquote, h2, h3, h4, div, img, figure")) {
      return [node];
    }

    return Array.from(
      node.querySelectorAll(
        ":scope > p, :scope > li, :scope > blockquote, :scope > h2, :scope > h3, :scope > h4, :scope > div, :scope > img, :scope > figure",
      ),
    );
  });

  if (!blocks.length) {
    const fallback = toPlainText(decoded);
    return fallback ? [escapeHtml(fallback)] : [];
  }

  return blocks
    .map((node) => {
      if (typeof node === "string") {
        return sanitizeRichInlineHtml(node);
      }
      if (node.tagName === "IMG") {
        return sanitizeRichInlineHtml(node.outerHTML || "");
      }
      return sanitizeRichInlineHtml(node.innerHTML || node.textContent || "");
    })
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
          "value",
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
      row.popupGallery,
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
    rawStop?.keywordPopups,
  ];
  const rows = rawGroups.find((value) => Array.isArray(value)) || [];

  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;

      const label = toPlainText(
        row.label || row.word || row.term || row.keyword || "",
      );
      const keySeed =
        row.term_id || row.termId || row.key || row.slug || row.id || label;
      const key = normalizeTermKey(keySeed);
      if (!key) return null;
      const imageUrls = collectTermImageUrls(row);

      return {
        key,
        label,
        title: toPlainText(
          row.popup_title || row.title || row.heading || label,
        ),
        text: toPlainText(
          row.popup_text ||
            row.description ||
            row.text ||
            row.content ||
            row.details ||
            "",
        ),
        textHtml: sanitizeTermModalHtml(
          row.popup_text ||
            row.description ||
            row.text ||
            row.content ||
            row.details ||
            "",
        ),
        imageUrls,
        imageUrl: imageUrls[0] || "",
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
    rawStop?.acf?.introVideoUrl,
  ];

  return candidates.map((value) => resolveMediaUrl(value)).find(Boolean) || "";
}

function mapWpStop(rawStop, index, numberOffset = 0) {
  const number = String(index + numberOffset);
  const lang = getLangKey();
  const titleText = toPlainText(
    pickLangHalf(getLocalizedField(rawStop, "title", `Stop ${number}`), lang),
  );
  const questionRaw = getLocalizedField(rawStop, "question", "");
  const highlightRaw = pickLangHalf(
    getLocalizedField(rawStop, "highlight2", "") ||
    getLocalizedField(rawStop, "highlight", "") ||
    getLocalizedField(rawStop, "featured", ""),
    lang,
  );
  const paragraphCount = (highlightRaw.match(/<p[\s>]/gi) || []).length;

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

  const textBlocks = extractRichBlocksFromSource(textSource);
  let transcriptBlocks = extractRichBlocksFromSource(transcriptSource);
  const media = collectMediaUrls(rawStop, index);
  const terms = normalizeStopTerms(rawStop);
  const questionText = toPlainText(questionRaw);
  const highlightText = indentMultilineText(
    normalizeHighlightLines(toPlainTextWithBreaks(highlightRaw)),
  );

  const textPlain = textBlocks
    .map((block) => toPlainText(block))
    .join("\n")
    .trim();
  const transcriptPlain = transcriptBlocks
    .map((block) => toPlainText(block))
    .join("\n")
    .trim();
  const transcriptHasMedia = transcriptBlocks.some((block) =>
    /<img\b/i.test(block),
  );
  if (
    !transcriptHasMedia &&
    textPlain &&
    transcriptPlain &&
    textPlain === transcriptPlain
  ) {
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
    highlightForceBullets:
      /<li[\s>]|<br\s*\/?>/i.test(highlightRaw) || paragraphCount > 1,
    highlightHtml: sanitizeTermModalHtml(highlightRaw),
    textBlocks,
    transcriptBlocks,
    terms,
    audioUrl:
      resolveMediaUrl(rawStop?.[`audio_url_${lang}`]) ||
      resolveMediaUrl(rawStop?.audioUrl) ||
      resolveMediaUrl(rawStop?.audio_url) ||
      "",
    videoUrl: getStopVideoUrl(rawStop),
    mapUrl:
      resolveMediaUrl(rawStop?.mapUrl) ||
      resolveMediaUrl(rawStop?.map_url) ||
      resolveMediaUrl(rawStop?.mapImage) ||
      resolveMediaUrl(rawStop?.map_image) ||
      "",
  };
}

function renderDetailHighlightSection(
  container,
  htmlValue,
  textValue,
  forceBullets = false,
) {
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
  rawStopsData = data.stops;
  return data.stops.map((stop, index) => mapWpStop(stop, index, 0));
}

function remapStopsForLang() {
  if (!rawStopsData.length) return;
  stopsData = rawStopsData.map((stop, index) => mapWpStop(stop, index, 0));
  tourStopsData = getTourStops(stopsData);
  renderMapPins(tourStopsData);
  buildStopPicker();
  if (activeStop) {
    const refreshed = tourStopsData.find((s) => s.id === activeStop.id);
    if (refreshed) setDetailStop(refreshed);
  }
}

// Percentage positions [left%, top%] for stops 1–20 derived from the map image.
// These are calibrated to the temple grounds map provided.
const MAP_PIN_POSITIONS = {
  1: [55.4, 96],
  2: [56.7, 79.2],
  3: [57.2, 71.6],
  4: [69.4, 70.1],
  5: [79.3, 69.8],
  6: [79.1, 61.1],
  7: [78.8, 52],
  8: [65.1, 52],
  9: [64.7, 36.4],
  10: [78.8, 19.6],
  11: [35.3, 28.3],
  12: [31.3, 21.6],
  13: [35, 15.2],
  14: [42.8, 14.9],
  15: [46.7, 21.3],
  16: [25.8, 43.3],
  17: [41.3, 40.9],
  18: [37.3, 50.9],
  19: [26.3, 51.1],
  20: [20.9, 68.3],
};

const MAP_IMAGE_URL = "";

function renderMapPins(stops) {
  if (!mapPins) return;
  mapPins.innerHTML = "";

  const calibrationMode =
    new URLSearchParams(location.search).has("pins") ||
    localStorage.getItem("pinMode");

  if (calibrationMode) {
    // Click anywhere on the map to log percentage coordinates for that spot.
    // Open DevTools console, then click each stop location and copy the output
    // into MAP_PIN_POSITIONS above.
    let nextPin = 1;
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.82);color:#fff;font:700 13px monospace;padding:10px 14px;z-index:9999;pointer-events:none;";
    overlay.textContent = "PIN MODE — tap map to place stop 1";
    document.body.appendChild(overlay);

    const placed = {};

    mapInner.addEventListener("click", (e) => {
      const rect = mapInner.getBoundingClientRect();
      const x = (((e.clientX - rect.left) / rect.width) * 100).toFixed(1);
      const y = (((e.clientY - rect.top) / rect.height) * 100).toFixed(1);
      placed[nextPin] = [parseFloat(x), parseFloat(y)];

      const dot = document.createElement("div");
      dot.style.cssText = `position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;background:#e8a020;border:2px solid #fff;color:#fff;font:800 0.7rem Barlow,sans-serif;display:grid;place-items:center;pointer-events:none;`;
      dot.textContent = nextPin;
      mapInner.appendChild(dot);

      console.log(`  ${nextPin}: [${x}, ${y}],`);
      nextPin++;
      if (nextPin <= 20) {
        overlay.textContent = `PIN MODE — tap map to place stop ${nextPin}`;
      } else {
        overlay.textContent =
          "PIN MODE — all 20 placed! See console for output.";
        console.log("=== MAP_PIN_POSITIONS ===");
        console.log(
          Object.entries(placed)
            .map(([k, v]) => `  ${k}: [${v[0]}, ${v[1]}],`)
            .join("\n"),
        );
      }
    });
    return;
  }

  stops.forEach((stop) => {
    const pos = MAP_PIN_POSITIONS[stop.number];
    if (!pos) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "map-pin";
    btn.textContent = stop.number;
    btn.setAttribute("aria-label", `Stop ${stop.number}: ${stop.title}`);
    btn.dataset.stopId = stop.id;
    btn.style.left = `${pos[0]}%`;
    btn.style.top = `${pos[1]}%`;

    btn.addEventListener("click", () => openDetailById(stop.id));
    mapPins.appendChild(btn);
  });
}

function syncMapInnerSize() {
  if (!mapImage || !mapInner) return;
  const w = mapImage.offsetWidth;
  const h = mapImage.offsetHeight;
  if (!w || !h) return;
  mapInner.style.width = `${w}px`;
  mapInner.style.height = `${h}px`;
}

function setMapImageUrl(url) {
  if (!mapImage) return;
  if (!url) return;
  mapImage.src = url;
  mapImage.addEventListener(
    "load",
    () => {
      syncMapInnerSize();
    },
    { once: true },
  );
  if (mapImage.complete && mapImage.naturalWidth) {
    syncMapInnerSize();
  }
  window.addEventListener("resize", syncMapInnerSize);

  window.addEventListener("popstate", (e) => {
    if (appShell.classList.contains("is-detail")) {
      appShell.classList.remove("is-detail");
      closeStopPicker();
      detailAudio.pause();
      detailPlayBtn.classList.remove("is-playing");
      detailPlayBtn.innerHTML = playIconHtml(DETAIL_AUDIO_ICON_SIZE);
      Array.from(detailHeroTrack?.querySelectorAll("video") || []).forEach((v) => v.pause());
      stopHeroSlideshow();
    }
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

function hasSwipeableHeroSlides() {
  const imageSlides = detailHeroTrack?.querySelectorAll(".detail-hero-image");
  return Boolean(imageSlides && imageSlides.length > 1);
}

function resetHeroSwipeState() {
  heroTouchStartX = 0;
  heroTouchStartY = 0;
  heroTouchDeltaX = 0;
  heroTouchDeltaY = 0;
  heroTouchActive = false;
  heroSwipeLockedAxis = "";
}

function clearHeroSlideInlineStyles() {
  const slides = detailHeroTrack?.querySelectorAll(".detail-hero-media");
  if (!slides?.length) return;
  slides.forEach((slide) => {
    slide.style.transition = "";
    slide.style.transform = "";
    slide.style.opacity = "";
  });
}

function commitHeroSwipe(direction) {
  const slides = detailHeroTrack?.querySelectorAll(".detail-hero-media");
  if (!slides?.length || slides.length < 2) {
    showHeroSlide(heroSlideIndex + direction);
    return;
  }

  const trackWidth = detailHeroTrack?.offsetWidth || 320;
  const fromIdx = heroSlideIndex;
  const toIdx = (heroSlideIndex + direction + slides.length) % slides.length;

  slides.forEach((slide, idx) => {
    slide.style.transition = "transform 220ms ease, opacity 180ms ease";
    if (idx === fromIdx) {
      slide.style.opacity = "0";
      slide.style.transform = `translateX(${direction > 0 ? -trackWidth : trackWidth}px)`;
    } else if (idx === toIdx) {
      slide.style.opacity = "1";
      slide.style.transform = "translateX(0)";
    } else {
      slide.style.opacity = "0";
      slide.style.transform = "";
    }
  });

  setTimeout(() => {
    clearHeroSlideInlineStyles();
    showHeroSlide(toIdx);
  }, 220);
}

function applyHeroDragVisual(deltaX) {
  const slides = detailHeroTrack?.querySelectorAll(".detail-hero-media");
  if (!slides?.length || slides.length < 2) return;
  const trackWidth = detailHeroTrack?.offsetWidth || 320;
  const clamped =
    Math.sign(deltaX) * Math.min(Math.abs(deltaX), trackWidth * 0.45);
  const adjacentIdx =
    ((deltaX < 0 ? heroSlideIndex + 1 : heroSlideIndex - 1) + slides.length) %
    slides.length;

  slides.forEach((slide, idx) => {
    slide.style.transition = "none";
    if (idx === heroSlideIndex) {
      slide.style.opacity = "1";
      slide.style.transform = `translateX(${clamped}px)`;
    } else if (idx === adjacentIdx) {
      const fromX = deltaX < 0 ? trackWidth : -trackWidth;
      slide.style.opacity = String(
        Math.min(1, Math.abs(clamped) / (trackWidth * 0.25)),
      );
      slide.style.transform = `translateX(${fromX + clamped}px)`;
    } else {
      slide.style.opacity = "0";
      slide.style.transform = "";
    }
  });
}

function snapHeroBack() {
  const slides = detailHeroTrack?.querySelectorAll(".detail-hero-media");
  if (!slides?.length) return;
  slides.forEach((slide, idx) => {
    slide.style.transition = "transform 260ms ease, opacity 180ms ease";
    slide.style.transform = "";
    slide.style.opacity = idx === heroSlideIndex ? "1" : "0";
  });
  setTimeout(() => {
    slides.forEach((slide) => {
      slide.style.transition = "";
      slide.style.transform = "";
    });
  }, 270);
}

function handleHeroTouchStart(event) {
  if (!hasSwipeableHeroSlides()) return;
  const touch = event.touches?.[0];
  if (!touch) return;
  heroTouchActive = true;
  heroSwipeLockedAxis = "";
  heroTouchStartX = touch.clientX;
  heroTouchStartY = touch.clientY;
  heroTouchDeltaX = 0;
  heroTouchDeltaY = 0;
}

function handleHeroTouchMove(event) {
  if (!heroTouchActive || !hasSwipeableHeroSlides()) return;
  const touch = event.touches?.[0];
  if (!touch) return;

  heroTouchDeltaX = touch.clientX - heroTouchStartX;
  heroTouchDeltaY = touch.clientY - heroTouchStartY;

  if (!heroSwipeLockedAxis) {
    const absX = Math.abs(heroTouchDeltaX);
    const absY = Math.abs(heroTouchDeltaY);
    if (absX > 8 || absY > 8) {
      heroSwipeLockedAxis = absX > absY ? "x" : "y";
    }
  }

  if (heroSwipeLockedAxis === "x") {
    event.preventDefault();
    applyHeroDragVisual(heroTouchDeltaX);
  }
}

function handleHeroTouchEnd() {
  if (!heroTouchActive || !hasSwipeableHeroSlides()) {
    resetHeroSwipeState();
    return;
  }

  if (
    heroSwipeLockedAxis === "x" &&
    Math.abs(heroTouchDeltaX) >= HERO_SWIPE_THRESHOLD
  ) {
    const direction = heroTouchDeltaX < 0 ? 1 : -1;
    commitHeroSwipe(direction);
  } else if (heroSwipeLockedAxis === "x") {
    snapHeroBack();
  }

  resetHeroSwipeState();
}

function renderHeroSlideshow(stop) {
  if (!detailHeroTrack || !detailHeroIndicators) return;
  stopHeroSlideshow();
  Array.from(detailHeroTrack.querySelectorAll("video")).forEach((video) => {
    video.pause();
  });

  detailHeroTrack.innerHTML = "";
  detailHeroIndicators.innerHTML = "";
  detailHeroIndicators.hidden = true;
  if (stop.videoUrl) {
    const video = document.createElement("video");
    video.className =
      "detail-hero-slide detail-hero-media detail-hero-video active";
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
    heroSlideIndex = 0;
    return;
  }

  const leadImage =
    (Array.isArray(stop.media) && stop.media.find(Boolean)) || stop.thumb || "";
  if (!leadImage) return;

  const img = document.createElement("img");
  img.className =
    "detail-hero-slide detail-hero-media detail-hero-image active";
  img.alt = `${stop.title} image 1`;
  const setOrientationClass = () => {
    const isPortrait = img.naturalHeight > img.naturalWidth * 1.08;
    img.classList.toggle("is-portrait", isPortrait);
    img.classList.toggle("is-landscape", !isPortrait);
  };
  img.addEventListener("load", setOrientationClass);
  img.src = leadImage;
  if (img.complete && img.naturalWidth > 0) {
    setOrientationClass();
  }

  detailHeroTrack.appendChild(img);

  heroSlideIndex = 0;
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

function setDetailStop(stop) {
  activeStop = stop;
  activeTermLookup = buildTermLookup(stop.terms || []);
  detailView?.classList.toggle("is-stop-zero", isStopZero(stop));

  renderHeroSlideshow(stop);
  detailNumber.textContent = stop.number;
  detailTitle.textContent = stop.title;
  if (detailAudioTitle)
    detailAudioTitle.textContent = `${stop.number} ${stop.title}`;
  if (detailThumb) {
    detailThumb.src = stop.thumb;
    detailThumb.alt = stop.title;
  }

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
      Boolean(stop.highlightForceBullets || stop.highlightHasList),
    );
    detailHighlight.classList.toggle("hidden", !hasHighlightBlock);
  }

  renderRichBlocks(detailText, stop.textBlocks);
  detailHighlightLabel?.classList.toggle("hidden", !hasHighlightBlock);

  renderRichBlocks(detailTranscript, stop.transcriptBlocks);
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

  if (stop.audioUrl) {
    detailAudio.src = stop.audioUrl;
    detailPlayBtn.disabled = false;
  } else {
    detailPlayBtn.disabled = true;
  }
  if (stop.audioUrl) {
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
  detailNextBtn.disabled = activeIndex < 0;

  const isLastStop =
    activeIndex >= 0 && activeIndex === tourStopsData.length - 1;
  if (isLastStop) {
    detailNextBtn.innerHTML = (UI_STRINGS[getLangKey()] || UI_STRINGS.ja)["end-tour-btn"];
    detailNextBtn.classList.add("is-end-btn");
  } else {
    detailNextBtn.innerHTML = `<svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true"><polyline points="2,2 8,8 2,14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    detailNextBtn.classList.remove("is-end-btn");
  }
}

function openAdjacentStop(step) {
  const activeIndex = getActiveStopIndex();
  if (activeIndex < 0) return;
  if (step > 0 && activeIndex >= tourStopsData.length - 1) {
    openOmamori();
    return;
  }
  const targetStop = tourStopsData[activeIndex + step];
  if (!targetStop) return;
  setDetailStop(targetStop);
  detailView?.scrollTo({ top: 0, behavior: "smooth" });
}

function openOmamori() {
  if (!omamoriScreen) return;
  omamoriScreen.classList.add("is-open");
  omamoriScreen.setAttribute("aria-hidden", "false");
  renderOmamoriVideos();
  initMsgPlayer();
}

function closeOmamori() {
  if (!omamoriScreen) return;
  omamoriScreen.classList.remove("is-open");
  omamoriScreen.setAttribute("aria-hidden", "true");
  resetMsgPlayer();
}

const OMAMORI_URLS = {
  blue: "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/wp-content/uploads/2026/04/fortuneate.mp4",
  gold: "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/wp-content/uploads/2026/05/money-2.mp4",
  pink: "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/wp-content/uploads/2026/04/luck.mp4",
};

function renderOmamoriVideos() {
  omamoriScreen?.querySelectorAll("[data-omamori-video]").forEach((video) => {
    const key = video.dataset.omamoriVideo;
    if (OMAMORI_URLS[key] && !video.src) {
      video.src = OMAMORI_URLS[key];
    }
  });
}

// ─── Priest message video player ─────────────────────────────────────────────

const MSG_VIDEO_URLS = {
  ja: "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/wp-content/uploads/2026/05/1.mp4",
  zh: "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/wp-content/uploads/2026/06/%E4%B8%AD%E5%9B%BD%E8%AA%9E%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%93%E3%83%A5%E3%83%BC%E3%83%95%E3%83%AB-1.mp4",
  en: "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/wp-content/uploads/2026/06/%E8%8B%B1%E8%AA%9E%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%93%E3%83%A5%E3%83%BC%E3%83%95%E3%83%AB-1.mp4",
  ko: "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/wp-content/uploads/2026/06/%E9%9F%93%E5%9B%BD%E8%AA%9E%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%93%E3%83%A5%E3%83%BC%E3%83%95%E3%83%AB-1.mp4",
};

let msgPlayerInit = false;

function syncOmamoriAudioBtn() {
  if (!omamoriMsgVideo) return;
  const muted = omamoriMsgVideo.muted;
  const t = UI_STRINGS[getLangKey()] || UI_STRINGS.ja;
  if (omamoriMsgUnmuteLabel) {
    omamoriMsgUnmuteLabel.textContent = muted ? (t["audio-on"] ?? "音声オン") : (t["audio-off"] ?? "音声オフ");
  }
  omamoriMsgUnmuteIcon?.setAttribute(
    "d",
    muted
      ? "M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"
      : "M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"
  );
  omamoriMsgUnmute?.classList.toggle("is-unmuted", !muted);
}

omamoriMsgUnmute?.addEventListener("click", () => {
  if (!omamoriMsgVideo) return;
  omamoriMsgVideo.muted = !omamoriMsgVideo.muted;
  syncOmamoriAudioBtn();
});

function initMsgPlayer() {
  if (msgPlayerInit || !omamoriMsgVideo) return;
  msgPlayerInit = true;

  omamoriMsgVideo.muted = true;
  syncOmamoriAudioBtn();
  omamoriMsgVideo.src = MSG_VIDEO_URLS[getLangKey()] ?? MSG_VIDEO_URLS.ja;
  omamoriMsgVideo.load();
  omamoriMsgVideo.play().catch(() => {});
}

function resetMsgPlayer() {
  msgPlayerInit = false;
  if (omamoriMsgVideo) {
    omamoriMsgVideo.pause();
    omamoriMsgVideo.src = "";
  }
}

function reloadMsgPlayerForLang() {
  if (!msgPlayerInit || !omamoriMsgVideo) return;
  omamoriMsgVideo.src = MSG_VIDEO_URLS[getLangKey()] ?? MSG_VIDEO_URLS.ja;
  omamoriMsgVideo.muted = true;
  omamoriMsgVideo.load();
  omamoriMsgVideo.play().catch(() => {});
  syncOmamoriAudioBtn();
}

function openDetailById(stopId) {
  const stop = tourStopsData.find((item) => item.id === stopId);
  if (!stop) return;
  setDetailStop(stop);
  appShell.classList.add("is-detail");
  detailView.scrollTo({ top: 0, behavior: "smooth" });
  history.pushState({ stopId }, "", `?stop=${stop.number}`);
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
  if (
    !mapPreviewStage ||
    !mapPreviewModal ||
    mapPreviewModal.classList.contains("hidden")
  ) {
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
      scale: mapScale,
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

  if (
    mapPointers.size === 1 &&
    mapDragPointerId === event.pointerId &&
    mapScale > 1
  ) {
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
    mapPreviewTitle.textContent = (UI_STRINGS[getLangKey()] || UI_STRINGS.ja)["map-preview-title"];
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
      term?.text || "No additional details available.",
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
          `${term?.title || fallbackLabel} image ${index + 1}`,
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
    const urlsFromTerm =
      Array.isArray(term?.imageUrls) && term.imageUrls.length
        ? term.imageUrls.map((url) => normalizeWpImageUrl(url))
        : term?.imageUrl
          ? [normalizeWpImageUrl(term.imageUrl)]
          : [];
    const mediaItems = [
      ...urlsFromTerm.map((url, index) => ({
        src: url,
        alt: `${term?.title || fallbackLabel} image ${index + 1}`,
      })),
      ...inlineBodyImages,
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

      const frames = Array.from(
        mediaTrack.querySelectorAll(".term-media-item"),
      );
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
            frame.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "start",
            });
            paintGalleryMeta(dotIndex);
          });
          termGalleryDots.appendChild(dot);
        });
      }

      const updateActiveFromScroll = () => {
        if (!frames.length) return;
        const gap =
          parseFloat(
            getComputedStyle(mediaTrack).columnGap ||
              getComputedStyle(mediaTrack).gap ||
              "0",
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

function closeDetail() {
  appShell.classList.remove("is-detail");
  closeStopPicker();
  detailAudio.pause();
  detailPlayBtn.classList.remove("is-playing");
  detailPlayBtn.innerHTML = playIconHtml(DETAIL_AUDIO_ICON_SIZE);
  Array.from(detailHeroTrack?.querySelectorAll("video") || []).forEach(
    (video) => {
      video.pause();
    },
  );
  stopHeroSlideshow();
  if (history.state?.stopId) history.back();
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
  backButton?.addEventListener("click", closeDetail);
  mapPreviewClose?.addEventListener("click", closeMapPreview);
  termModalClose?.addEventListener("click", closeTermModal);

  mapZoomInBtn?.addEventListener("click", () =>
    setMapScale(mapScale + MAP_ZOOM_STEP),
  );
  mapZoomOutBtn?.addEventListener("click", () =>
    setMapScale(mapScale - MAP_ZOOM_STEP),
  );
  mapZoomResetBtn?.addEventListener("click", resetMapTransform);

  mapPreviewStage?.addEventListener("pointerdown", handleMapPointerDown);
  mapPreviewStage?.addEventListener("pointermove", handleMapPointerMove);
  mapPreviewStage?.addEventListener("pointerup", handleMapPointerUp);
  mapPreviewStage?.addEventListener("pointercancel", handleMapPointerUp);
  mapPreviewStage?.addEventListener("pointerleave", handleMapPointerUp);
  mapPreviewStage?.addEventListener("wheel", handleMapWheel, {
    passive: false,
  });
  mapPreviewStage?.addEventListener("dblclick", handleMapDoubleClick);

  detailHeroTrack?.addEventListener("touchstart", handleHeroTouchStart, {
    passive: true,
  });
  detailHeroTrack?.addEventListener("touchmove", handleHeroTouchMove, {
    passive: false,
  });
  detailHeroTrack?.addEventListener("touchend", handleHeroTouchEnd, {
    passive: true,
  });
  detailHeroTrack?.addEventListener("touchcancel", handleHeroTouchEnd, {
    passive: true,
  });

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

  detailAudio.addEventListener("ended", () => {
    detailPlayBtn.classList.remove("is-playing");
    detailPlayBtn.innerHTML = playIconHtml(DETAIL_AUDIO_ICON_SIZE);
  });

  detailAudio.addEventListener("timeupdate", () => {
    if (!audioScrubber || !audioTimeCurrent) return;
    const pct = detailAudio.duration ? (detailAudio.currentTime / detailAudio.duration) * 100 : 0;
    audioScrubber.value = pct;
    audioScrubber.style.backgroundSize = `${pct}% 100%`;
    audioTimeCurrent.textContent = formatTime(detailAudio.currentTime);
  });

  detailAudio.addEventListener("loadedmetadata", () => {
    if (audioTimeDuration) audioTimeDuration.textContent = formatTime(detailAudio.duration);
    if (audioScrubber) { audioScrubber.value = 0; audioScrubber.style.backgroundSize = "0% 100%"; }
    if (audioTimeCurrent) audioTimeCurrent.textContent = "0:00";
  });

  audioScrubber?.addEventListener("input", () => {
    if (!detailAudio.duration) return;
    detailAudio.currentTime = (audioScrubber.value / 100) * detailAudio.duration;
    audioScrubber.style.backgroundSize = `${audioScrubber.value}% 100%`;
  });

  detailPrevBtn?.addEventListener("click", () => {
    openAdjacentStop(-1);
  });
  detailNextBtn?.addEventListener("click", () => {
    openAdjacentStop(1);
  });

  stopPickerBackdrop?.addEventListener("click", closeStopPicker);

  omamoriCloseBtn?.addEventListener("click", closeOmamori);

  omamoriTranscriptEl?.querySelectorAll(".omamori-transcript-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      const body = document.getElementById(toggle.getAttribute("aria-controls"));
      if (body) body.hidden = expanded;
    });
  });
  mapEndBtn?.addEventListener("click", openOmamori);

  function openOmamoriFullscreen(key) {
    const url = OMAMORI_URLS[key];
    if (!url || !omamoriFullscreen || !omamoriFullscreenVideo) return;
    omamoriFullscreenVideo.src = url;
    omamoriFullscreenVideo.play().catch(() => {});
    omamoriFullscreenDl.dataset.omamoriKey = key;
    omamoriFullscreen.classList.remove("hidden");
  }

  function closeOmamoriFullscreen() {
    if (!omamoriFullscreen) return;
    omamoriFullscreen.classList.add("hidden");
    omamoriFullscreenVideo.pause();
    omamoriFullscreenVideo.src = "";
  }

  omamoriFullscreenBack?.addEventListener("click", closeOmamoriFullscreen);

  function lockOmamoriDownloads() {
    omamoriScreen?.querySelectorAll(".omamori-download-btn").forEach((btn) => {
      btn.disabled = true;
      btn.classList.add("is-downloaded");
    });
    if (omamoriFullscreenDl) {
      omamoriFullscreenDl.disabled = true;
      omamoriFullscreenDl.classList.add("is-downloaded");
    }
  }

  omamoriScreen?.querySelectorAll(".omamori-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".omamori-download-btn")) return;
      openOmamoriFullscreen(card.dataset.omamoriKey);
    });

    card.querySelector(".omamori-download-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openOmamoriFullscreen(card.dataset.omamoriKey);
    });
  });

  omamoriFullscreenDl?.addEventListener("click", async () => {
    const key = omamoriFullscreenDl.dataset.omamoriKey;
    const url = OMAMORI_URLS[key];
    if (!url) return;
    const filename = `omamori-${key}.mp4`;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "video/mp4" });
      // iOS Safari: use share sheet so user can save to Files/Photos
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        lockOmamoriDownloads();
        return;
      }
      // Desktop / Android: blob download
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      lockOmamoriDownloads();
    } catch {
      window.location.href = url;
    }
  });
}

async function init() {
  bindEvents();

  appLoadingOverlay?.classList.remove("hidden");
  applySelectedLanguage();
  applyFontScale();
  initTourSettings();

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

  // Use the map image from stop 0 if available, or the first stop
  const introStop = getIntroStop(stopsData);
  const mapUrl =
    resolveImageUrl(introStop?.mapUrl) ||
    resolveImageUrl(introStop?.map_url) ||
    resolveImageUrl(introStop?.media?.[0]) ||
    "";
  setMapImageUrl(mapUrl);

  renderMapPins(tourStopsData);
  buildStopPicker();
  appLoadingOverlay?.classList.add("hidden");
}

// ─── Coach marks ─────────────────────────────────────────────

const COACH_KEY = "tourCoachSeen";

function runCoachMarks() {
  // if (localStorage.getItem(COACH_KEY)) return;

  const overlay = document.querySelector("#coachOverlay");
  const spotlight = document.querySelector("#coachSpotlight");
  const bubble = document.querySelector("#coachBubble");
  const coachText = document.querySelector("#coachText");
  const coachStep = document.querySelector("#coachStep");
  const nextBtn = document.querySelector("#coachNextBtn");
  if (!overlay || !spotlight || !bubble || !nextBtn) return;

  const lang = getRequestedLang();
  const t = UI_STRINGS[lang] || UI_STRINGS.ja;

  // Steps: map pin → end tour → (open detail) back → settings → highlight → audio → transcript → prev/next
  // Every targetFn must return a guaranteed-visible element — no hidden/display:none targets.
  const STEPS = [
    {
      targetFn: () => document.querySelector(".map-pin"),
      text: t["coach-1"],
      pad: 14,
    },
    {
      targetFn: () => document.querySelector("#mapEndBtn"),
      text: t["coach-end"],
      pad: 14,
    },
    {
      targetFn: () => document.querySelector("#backButton"),
      text: t["coach-back"],
      pad: 14,
      openDetail: true,
    },
    {
      targetFn: () => document.querySelector("#detailSettingsBtn"),
      text: t["coach-2"],
      pad: 14,
      openDetail: true,
    },
    {
      targetFn: () => {
        const el = document.querySelector("#detailHighlight");
        return (el && !el.classList.contains("hidden")) ? el : document.querySelector("#detailText");
      },
      text: t["coach-3b"],
      pad: 10,
      rect: true,
      openDetail: true,
      scrollTo: "#detailText",
    },
    {
      targetFn: () => document.querySelector("#detailPlayBtn"),
      text: t["coach-3"],
      pad: 16,
      openDetail: true,
      scrollTo: "#detailAudioInline",
    },
    {
      targetFn: () => {
        const el = document.querySelector("#detailTranscriptBlock");
        return (el && !el.hidden) ? el : document.querySelector("#detailText");
      },
      text: t["coach-3c"],
      pad: 10,
      rect: true,
      openDetail: true,
      scrollTo: "#detailText",
    },
    {
      // bottom-nav is position:fixed — spotlight in place, no scrollIntoView
      targetFn: () => document.querySelector("#detailNextBtn"),
      text: t["coach-4"],
      pad: 14,
      openDetail: true,
    },
  ];

  let step = 0;

  let spotlightReady = false;

  function positionSpotlight(el, pad, rect) {
    const r = el.getBoundingClientRect();
    if (rect) {
      spotlight.style.width = `${r.width + pad * 2}px`;
      spotlight.style.height = `${r.height + pad * 2}px`;
      spotlight.style.left = `${r.left - pad}px`;
      spotlight.style.top = `${r.top - pad}px`;
      spotlight.style.borderRadius = "18px";
    } else {
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const radius = Math.max(r.width, r.height) / 2 + pad;
      const size = radius * 2;
      spotlight.style.width = `${size}px`;
      spotlight.style.height = `${size}px`;
      spotlight.style.left = `${cx - radius}px`;
      spotlight.style.top = `${cy - radius}px`;
      spotlight.style.borderRadius = "50%";
    }

    // Only restart pulse after the position transition settles, to avoid jank
    spotlight.classList.remove("is-pulsing");
    if (spotlightReady) {
      setTimeout(() => spotlight.classList.add("is-pulsing"), 260);
    } else {
      spotlight.classList.add("is-pulsing");
      spotlightReady = true;
    }

    const elBottom = r.top + r.height + pad;
    const elTop = r.top - pad;
    // Measure the actual rendered bubble height rather than a fixed estimate,
    // so positioning works correctly regardless of content length.
    const bubbleH = bubble.offsetHeight || 140;
    const spaceBelow = window.innerHeight - (elBottom + 16);
    if (spaceBelow > bubbleH) {
      bubble.style.top = `${elBottom + 16}px`;
      bubble.style.bottom = "auto";
      bubble.className = "coach-bubble arrow-up";
    } else {
      bubble.style.bottom = `${window.innerHeight - (elTop - 16)}px`;
      bubble.style.top = "auto";
      bubble.className = "coach-bubble arrow-down";
    }
  }

  function showStep(i) {
    const s = STEPS[i];

    // This step needs the detail view open
    if (s.openDetail && !appShell.classList.contains("is-detail")) {
      const firstStop = tourStopsData.find((st) => st.number === 1) || tourStopsData[0];
      if (firstStop) openDetailById(firstStop.id);
      setTimeout(() => showStep(i), 700);
      return;
    }

    // If the detail view is open but this step is a map-only step, close detail first
    if (!s.openDetail && appShell.classList.contains("is-detail")) {
      appShell.classList.remove("is-detail");
      detailAudio.pause();
      detailPlayBtn.classList.remove("is-playing");
      detailPlayBtn.innerHTML = playIconHtml(DETAIL_AUDIO_ICON_SIZE);
      setTimeout(() => showStep(i), 380);
      return;
    }

    // Scroll the target into view using instant (no animation) so position is
    // stable before we call getBoundingClientRect. Smooth scroll is async with
    // no callback, making timing unreliable, especially for rect-based steps.
    if (s.openDetail && s.scrollTo) {
      const primary = document.querySelector(s.scrollTo);
      const fallback = s.scrollFallback ? document.querySelector(s.scrollFallback) : null;
      const scrollTarget = (primary && !primary.hidden) ? primary : fallback;
      if (scrollTarget) {
        const pos = window.getComputedStyle(scrollTarget).position;
        if (pos !== "fixed" && pos !== "sticky") {
          scrollTarget.scrollIntoView({ behavior: "instant", block: "center" });
        }
      }
      requestAnimationFrame(() => requestAnimationFrame(() => renderStep(i)));
      return;
    }

    renderStep(i);
  }

  function renderStep(i) {
    const s = STEPS[i];
    const isLast = i === STEPS.length - 1;

    const el = s.targetFn ? s.targetFn() : null;
    if (!el) {
      if (!isLast) { showStep(i + 1); return; }
      finishCoach();
      return;
    }

    // Fade bubble out, swap content, fade back in
    const doRender = () => {
      coachText.textContent = s.text;
      coachStep.textContent = `${i + 1} / ${STEPS.length}`;
      nextBtn.style.display = "";
      nextBtn.textContent = isLast ? t["coach-done"] : t["coach-next"];
      positionSpotlight(el, s.pad, s.rect);
      bubble.style.opacity = "1";
      overlay.classList.remove("hidden");
      overlay.classList.add("is-active");
    };

    if (overlay.classList.contains("is-active")) {
      bubble.style.opacity = "0";
      setTimeout(doRender, 160);
    } else {
      bubble.style.opacity = "1";
      doRender();
    }
  }

  function finishCoach() {
    bubble.style.opacity = "0";
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("is-active");
    }, 160);
    localStorage.setItem(COACH_KEY, "1");
  }

  nextBtn.addEventListener("click", () => {
    step++;
    if (step >= STEPS.length) { finishCoach(); return; }
    showStep(step);
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) { finishCoach(); }
  });

  // Start after map loads
  const startCoach = () => showStep(0);
  if (mapImage && !mapImage.complete) {
    mapImage.addEventListener("load", startCoach, { once: true });
  } else {
    setTimeout(startCoach, 400);
  }
}

disablePwa();
init().then(() => runCoachMarks());
