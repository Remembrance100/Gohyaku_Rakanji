## Project structure

- `index.html`: settings and entry page
- `tour.html`: tour experience page
- `assets/css/`: page stylesheets
- `assets/js/`: page scripts
- `assets/icons/`: app icons and favicon assets
- `manifest.webmanifest` and `sw.js`: root-level PWA files

**Switching to one-scroll format:**

- Eliminating the multi-page structure within each stop (highlight → main text → details → map). Instead, **everything fits on a single page that you scroll top to bottom.**
- This also solves the "close button problem" — where tapping the browser back button from a detail page sent users all the way back to the intro instead of the stop they were viewing.
- Hyperlinked detail subpages are eliminated. Images and explanatory text will be embedded directly in the main body.

### 2. Photos/Content Direction

**Prioritize "things you can't normally see":**

- Izumi: "There's no value in showing the same thing that's right in front of them. What's valuable is what a normal visitor can't see up close — the inside of statues, the back side, close-up details."
- Avoid AI-generated images where possible (people can tell).
- For the monument path and similar sections, **historical photographs** (portraits, group photos from temple archives) are encouraged.
- Photo zoom/enlarge feature to be added.

**Image replacement work:**

- Fujisawa: Will review all shared images and replace each stop's featured photos with "normally unseen" content.
- Izumi: Will compile and share a set of preferred photos separately.

---

### 3. Ending — Decisions Made

**Digital omamori (charm) system confirmed:**

- Three choices: Health, Fortune, Romance.
- User taps to select, and a charm image appears full-screen. Users screenshot it as a keepsake.
- Visuals will **use the temple's existing charm designs** — which also drives sales of the physical versions.
- For romance: repurpose the existing pink goshuin design, replacing the Tokugawa crest with a heart motif.

**Head priest's message:**

- Audio + text only (not video).
- Idea to include a **short sutra reading** — a portion of the Heart Sutra or similar, chosen so it makes sense as an excerpt. Chanting (dokyō) was also suggested as a possibility.

---

### 4. Physical Stop Markers

- **Numbered plates will be installed** at each stop (not QR codes).
- QR codes change daily (to prevent unauthorized access), so fixed QR codes can't be placed on-site.
- Plates should include "Audio Guidance" label and direct interested visitors to the front desk.
- Payment method to be explored separately. Ideal scenario: scan QR → pay on device → start using immediately. But this requires payment system integration (PayPay is already set up at the temple).

---

### 5. Scheduling & Next Steps

**May 14 (Wed) at 10:00 AM — Next on-site visit:**

- Record head priest's message + sutra audio
- Meeting about the digital memorial (denshi boshi) backend system (company president attending)

**Action items before then:**

- Fujisawa: Rebuild to one-scroll format, implement map navigation, replace images → confirm timeline by end of this week via email
- Izumi: Finalize wording revisions, compile and share preferred photos
- Translation work begins after Japanese text is finalized
- Japanese audio narration to switch from AI voice to a real human voice

---

### Items Requiring Task List Updates

- Rebuild to one-scroll format (eliminate hyperlink subpages → integrate images and text into main body)
- Map navigation UI
- Language settings + etiquette notice page
- Digital omamori ending (3 charm visuals)
- Head priest message + sutra recording (May 14)
- Numbered plate design for physical stops

---

Several significant pivots came out of this meeting. The biggest one is the switch to one-scroll format — this means the hyperlinked subpage structure is going away, and all detail content needs to be integrated directly into the main text with images inline. The drafts we've been working on will need to be restructured. Want to discuss how to adjust, or wait until the format is confirmed by the programmer?
message.txt
5 KB
住職より

「本日はご参拝いただき、誠にありがとうございます。この地に眠る御霊が、皆様の歩みをいつまでも見守っておられます。どうかお守りを携え、健やかな日々をお過ごしください。」 move this text above the title

- Label the language and text size

- create a input for langauge adjustemnents for teh actual tour
