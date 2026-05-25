import { getSermon, loadData, upsertSermon } from "./storage.js";
import { $, $$, calculateSermonMetrics, createId, escapeHtml, listToString, normalizeList, nowIso, prepProgress, readinessReview, sermonPlainText, toast } from "./utils.js";

const outlineTypes = ["Main Point", "Subpoint", "Illustration", "Application", "Scripture Block", "Quote", "Transition", "Prayer", "Discussion Question"];
let currentSermon = null;
let autosaveTimer = null;
const modeText = {
  plan: ["Plan", "Set the sermon metadata, series placement, and core passage."],
  manuscript: ["Manuscript", "Write and edit the full sermon in your normal preaching format."],
  outline: ["Outline", "Refine structured sections for search, preaching view, handouts, and planning."],
  notes: ["Notes", "Gather research, commentary, personal notes, and prayer prompts."],
  review: ["Review", "Finalize organization, timing, tags, audience, and publishing details."],
  outputs: ["Outputs", "Prepare manuscript, handout, and discussion-question views from this sermon."]
};
let currentOutput = "manuscript";
const romanPointPattern = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+(.+)$/i;
const scriptureReferencePattern = /\b(?:[1-3]\s*)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+\d+:\d+(?:[\u2013-]\d+)?(?:\s*\([A-Z]{2,}\))?/g;

function blankSermon() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: createId("sermon"),
    title: "",
    subtitle: "",
    seriesId: params.get("series") || "",
    weekNumber: Number(params.get("week")) || "",
    datePreached: params.get("date") || "",
    location: "",
    speaker: "",
    mainScripture: "",
    supportingScriptures: "",
    scriptureBlocks: [],
    bigIdea: "",
    purpose: "",
    fallenConditionFocus: "",
    introduction: "",
    manuscriptDraft: "",
    outline: [],
    transitions: "",
    illustrations: "",
    applications: "",
    quotes: "",
    conclusion: "",
    invitation: "",
    personalNotes: "",
    researchNotes: "",
    commentaryReferences: "",
    prayerNotes: "",
    outputNotes: {
      handout: "",
      slides: "",
      discussion: ""
    },
    prepChecklist: {
      manuscript: false,
      slides: false,
      handout: false,
      discussion: false,
      prayer: false,
      print: false,
      preachReady: false
    },
    tags: [],
    topics: [],
    status: "Planning",
    estimatedLength: 30,
    audience: "",
    favorite: false,
    pinned: false,
    archived: false,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function fillSeriesOptions(data) {
  $("#seriesId").innerHTML = `<option value="">Standalone sermon</option>${data.series.map((series) => `<option value="${series.id}">${escapeHtml(series.title)}</option>`).join("")}`;
}

function setValue(id, value) {
  const control = $(`#${id}`);
  if (!control) return;
  if (control.type === "checkbox") control.checked = Boolean(value);
  else control.value = value ?? "";
}

function getValue(id) {
  const control = $(`#${id}`);
  if (!control) return "";
  return control.type === "checkbox" ? control.checked : control.value;
}

function fillForm(sermon) {
  Object.keys(sermon).forEach((key) => setValue(key, Array.isArray(sermon[key]) ? listToString(sermon[key]) : sermon[key]));
  setValue("manuscriptDraft", sermon.manuscriptDraft || sermonPlainText(sermon));
  setValue("outputHandout", sermon.outputNotes?.handout || "");
  setValue("outputSlides", sermon.outputNotes?.slides || "");
  setValue("outputDiscussion", sermon.outputNotes?.discussion || "");
  setPrepValues(sermon.prepChecklist || {});
  renderOutline(sermon.outline || []);
  renderScriptureBlocks(sermon.scriptureBlocks || []);
  updateMetrics();
}

function readForm() {
  return {
    ...currentSermon,
    title: getValue("title").trim(),
    subtitle: getValue("subtitle").trim(),
    seriesId: getValue("seriesId"),
    weekNumber: Number(getValue("weekNumber")) || "",
    datePreached: getValue("datePreached"),
    location: getValue("location").trim(),
    speaker: getValue("speaker").trim(),
    mainScripture: getValue("mainScripture").trim(),
    supportingScriptures: getValue("supportingScriptures").trim(),
    scriptureBlocks: readScriptureBlocks(),
    bigIdea: getValue("bigIdea").trim(),
    purpose: getValue("purpose").trim(),
    fallenConditionFocus: getValue("fallenConditionFocus").trim(),
    introduction: getValue("introduction").trim(),
    manuscriptDraft: getValue("manuscriptDraft").trim(),
    outline: readOutline(),
    transitions: getValue("transitions").trim(),
    illustrations: getValue("illustrations").trim(),
    applications: getValue("applications").trim(),
    quotes: getValue("quotes").trim(),
    conclusion: getValue("conclusion").trim(),
    invitation: getValue("invitation").trim(),
    personalNotes: getValue("personalNotes").trim(),
    researchNotes: getValue("researchNotes").trim(),
    commentaryReferences: getValue("commentaryReferences").trim(),
    prayerNotes: getValue("prayerNotes").trim(),
    outputNotes: {
      handout: getValue("outputHandout").trim(),
      slides: getValue("outputSlides").trim(),
      discussion: getValue("outputDiscussion").trim()
    },
    prepChecklist: readPrepValues(),
    tags: normalizeList(getValue("tags")),
    topics: normalizeList(getValue("topics")),
    status: getValue("status"),
    estimatedLength: Number(getValue("estimatedLength")) || 0,
    audience: getValue("audience").trim(),
    favorite: getValue("favorite"),
    pinned: getValue("pinned"),
    archived: getValue("status") === "Archived"
  };
}

function readPrepValues() {
  return {
    manuscript: getValue("prep-manuscript"),
    slides: getValue("prep-slides"),
    handout: getValue("prep-handout"),
    discussion: getValue("prep-discussion"),
    prayer: getValue("prep-prayer"),
    print: getValue("prep-print"),
    preachReady: getValue("prep-preachReady")
  };
}

function setPrepValues(checklist) {
  setValue("prep-manuscript", checklist.manuscript);
  setValue("prep-slides", checklist.slides);
  setValue("prep-handout", checklist.handout);
  setValue("prep-discussion", checklist.discussion);
  setValue("prep-prayer", checklist.prayer);
  setValue("prep-print", checklist.print);
  setValue("prep-preachReady", checklist.preachReady);
  updatePrepProgress();
}

function renderOutline(blocks) {
  $("#outline-list").innerHTML = blocks.map((block) => `
    <article class="outline-block" draggable="true" data-id="${block.id}">
      <div class="form-grid">
        <label class="field"><span>Type</span><select class="select outline-type">${outlineTypes.map((type) => `<option ${type === block.type ? "selected" : ""}>${type}</option>`).join("")}</select></label>
        <label class="field"><span>Title</span><input class="input outline-title" value="${escapeHtml(block.title || "")}"></label>
        <label class="field full"><span>Content</span><textarea class="textarea outline-body">${escapeHtml(block.body || "")}</textarea></label>
      </div>
      <button class="btn btn-danger remove-outline" type="button">Remove Block</button>
    </article>
  `).join("");
}

function readOutline() {
  return $$("#outline-list > .outline-block").map((block) => ({
    id: block.dataset.id,
    type: $(".outline-type", block).value,
    title: $(".outline-title", block).value.trim(),
    body: $(".outline-body", block).value.trim()
  })).filter((block) => block.title || block.body);
}

function renderScriptureBlocks(blocks) {
  $("#scripture-block-list").innerHTML = blocks.map((block) => `
    <article class="outline-block" data-id="${block.id || createId("scripture")}">
      <label class="field"><span>Reference</span><input class="input scripture-reference" value="${escapeHtml(block.reference || "")}"></label>
      <label class="field"><span>Text</span><textarea class="textarea scripture-text">${escapeHtml(block.text || "")}</textarea></label>
      <button class="btn btn-danger remove-scripture" type="button">Remove Scripture</button>
    </article>
  `).join("");
}

function readScriptureBlocks() {
  return $$("#scripture-block-list .outline-block").map((block) => ({
    id: block.dataset.id,
    reference: $(".scripture-reference", block).value.trim(),
    text: $(".scripture-text", block).value.trim()
  })).filter((block) => block.reference || block.text);
}

function cleanHeading(value = "") {
  return value.trim().replace(/^[\s"'\u2018\u2019\u201c\u201d?]+|[\s"'\u2018\u2019\u201c\u201d?]+$/g, "");
}

function splitParagraphs(text = "") {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSermonManuscript(text = "") {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  if (nonEmpty.length < 3) throw new Error("Paste a title, scripture, and sermon body first.");

  const title = cleanHeading(nonEmpty[0]);
  const mainScripture = nonEmpty[1];
  const bodyStart = lines.findIndex((line) => line.trim() === nonEmpty[2]);
  const body = lines.slice(Math.max(0, bodyStart)).join("\n").trim();
  const sectionMatches = [...body.matchAll(/^(INTRODUCTION|CONCLUSION|INVITATION)\s*$/gim)];
  const pointMatches = [...body.matchAll(new RegExp(romanPointPattern.source, "gim"))];
  const markers = [
    ...sectionMatches.map((match) => ({ kind: match[1].toUpperCase(), title: match[1].toUpperCase(), index: match.index, length: match[0].length })),
    ...pointMatches.map((match) => ({ kind: "POINT", title: match[2].trim(), index: match.index, length: match[0].length }))
  ].sort((a, b) => a.index - b.index);

  const sections = markers.map((marker, index) => {
    const next = markers[index + 1];
    return {
      ...marker,
      content: body.slice(marker.index + marker.length, next?.index ?? body.length).trim()
    };
  });
  const outline = sections
    .filter((section) => section.kind === "POINT")
    .map((section) => {
      const paragraphs = splitParagraphs(section.content);
      const passage = paragraphs[0]?.match(scriptureReferencePattern)?.[0] ? paragraphs.shift() : "";
      return {
        id: createId("block"),
        type: "Main Point",
        title: section.title,
        body: [passage, ...paragraphs].filter(Boolean).join("\n\n")
      };
    });
  const introduction = sections.find((section) => section.kind === "INTRODUCTION")?.content || "";
  const conclusion = sections.find((section) => section.kind === "CONCLUSION")?.content || "";
  const invitation = sections.find((section) => section.kind === "INVITATION")?.content || "";
  const applications = [...body.matchAll(/Life Application:\s*([\s\S]*?)(?=\n\n(?:[a-e]\.|[IVX]+\.\s|CONCLUSION|INVITATION)|$)/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .join("\n\n");
  const scriptureBlocks = [...body.matchAll(/^((?:[1-3]\s*)?[A-Z][A-Za-z ]+\s+\d+:\d+(?:[\u2013-]\d+)?\s*\([A-Z]{2,}\))\s+(.+)$/gm)]
    .map((match) => ({
      id: createId("scripture"),
      reference: match[1].trim(),
      text: match[2].trim()
    }));
  const supportingScriptures = [...new Set([...body.matchAll(scriptureReferencePattern)].map((match) => match[0].replace(/\s*\([A-Z]{2,}\)/, "").trim()))]
    .filter((reference) => reference !== mainScripture)
    .join("; ");

  return {
    title,
    mainScripture,
    supportingScriptures,
    introduction,
    outline,
    applications,
    conclusion,
    invitation,
    manuscriptDraft: text.trim(),
    scriptureBlocks,
    bigIdea: outline[0]?.title ? `Jesus calls us forward from ${outline[0].title.toLowerCase()} into a transformed life.` : "",
    status: "Drafting",
    tags: ["manuscript import"],
    topics: []
  };
}

function applyParsedSermon(parsed) {
  setValue("title", parsed.title);
  setValue("mainScripture", parsed.mainScripture);
  setValue("supportingScriptures", parsed.supportingScriptures);
  setValue("introduction", parsed.introduction);
  setValue("manuscriptDraft", parsed.manuscriptDraft);
  setValue("bigIdea", parsed.bigIdea);
  setValue("applications", parsed.applications);
  setValue("conclusion", parsed.conclusion);
  setValue("invitation", parsed.invitation);
  setValue("status", parsed.status);
  setValue("tags", listToString(parsed.tags));
  setValue("topics", listToString(parsed.topics));
  renderOutline(parsed.outline);
  renderScriptureBlocks(parsed.scriptureBlocks);
  setValue("prep-manuscript", Boolean(parsed.outline.length && parsed.introduction && parsed.conclusion));
  updateMetrics();
  renderImportResult(parsed);
  setEditorMode("manuscript");
  save({ quiet: true });
  toast(`Built and saved "${parsed.title}".`);
}

function renderImportResult(parsed) {
  const target = $("#import-result");
  if (!target) return;
  target.hidden = false;
  target.innerHTML = `
    <strong>Last import</strong>
    <ul>
      <li>${escapeHtml(parsed.title || "Untitled sermon")}</li>
      <li>${escapeHtml(parsed.mainScripture || "No main scripture")}</li>
      <li>${parsed.outline.length} main points</li>
      <li>${parsed.scriptureBlocks.length} scripture blocks</li>
    </ul>
  `;
}

function updateMetrics() {
  const metrics = calculateSermonMetrics(readForm());
  $("#word-count").textContent = metrics.words;
  $("#character-count").textContent = metrics.characters;
  $("#speaking-time").textContent = metrics.speakingMinutes;
  updatePrepProgress();
}

function syncFromManuscript() {
  try {
    const parsed = parseSermonManuscript(getValue("manuscriptDraft").trim());
    applyParsedSermon(parsed);
  } catch (error) {
    toast(error.message || "Could not update from manuscript.", "error");
  }
}

function refreshManuscriptFromFields() {
  setValue("manuscriptDraft", sermonPlainText(readForm()));
  scheduleAutosave();
  toast("Manuscript refreshed from structured fields.");
}

function updatePrepProgress() {
  const sermon = readForm();
  const progress = prepProgress(sermon);
  const review = readinessReview(sermon);
  $("#prep-progress-label").textContent = `${progress.percent}%`;
  $("#prep-progress-bar").style.width = `${progress.percent}%`;
  $("#prep-readiness").innerHTML = review.isReady
    ? `<div class="prep-ok">This sermon is ready to mark as Ready.</div>`
    : `<div class="prep-warning"><strong>Before Sunday</strong><ul>${review.missing.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`;
}

function suggestChecklist() {
  const sermon = readForm();
  setValue("prep-manuscript", Boolean(sermon.introduction && sermon.conclusion && (sermon.outline || []).length));
  setValue("prep-slides", Boolean(sermon.outputNotes?.slides));
  setValue("prep-handout", Boolean(sermon.outputNotes?.handout));
  setValue("prep-discussion", Boolean(sermon.outputNotes?.discussion || (sermon.outline || []).some((block) => block.type === "Discussion Question")));
  setValue("prep-prayer", Boolean(sermon.prayerNotes));
  setValue("prep-print", getValue("prep-print"));
  setValue("prep-preachReady", getValue("prep-preachReady"));
  updatePrepProgress();
  scheduleAutosave();
}

function markReady() {
  setValue("prep-preachReady", true);
  const sermon = { ...readForm(), status: "Ready" };
  const review = readinessReview(sermon);
  if (!review.isReady) {
    setValue("prep-preachReady", false);
    updatePrepProgress();
    toast(`Still missing: ${review.missing[0]}`, "error");
    return;
  }
  setValue("status", "Ready");
  save();
  toast("Sermon marked ready.");
}

function setEditorMode(mode = "plan") {
  const [title, description] = modeText[mode] || modeText.plan;
  $$(".builder-mode").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  $$(".editor-section").forEach((section) => {
    const isVisible = section.dataset.mode === mode;
    section.classList.toggle("mode-hidden", !isVisible);
    if (isVisible) section.open = true;
  });
  $("#builder-mode-title").textContent = title;
  $("#builder-mode-description").textContent = description;
  if (mode === "outputs") renderOutputPreview();
}

function outputText(sermon, type) {
  const outline = (sermon.outline || []).map((block, index) => `${index + 1}. ${block.title || block.type}\n${block.body || ""}`).join("\n\n");
  const questions = (sermon.outline || [])
    .filter((block) => ["Application", "Discussion Question", "Main Point"].includes(block.type))
    .map((block, index) => `${index + 1}. How does \"${block.title || block.type}\" shape the way we trust and obey Christ this week?`)
    .join("\n");
  if (type === "handout") {
    return [
      sermon.title,
      sermon.mainScripture ? `Text: ${sermon.mainScripture}` : "",
      sermon.bigIdea ? `Big Idea: ${sermon.bigIdea}` : "",
      sermon.outputNotes?.handout ? `Handout Note: ${sermon.outputNotes.handout}` : "",
      "",
      "Sermon Outline",
      outline,
      "",
      sermon.applications ? `Application: ${sermon.applications}` : ""
    ].filter(Boolean).join("\n");
  }
  if (type === "questions") {
    return [
      `${sermon.title} - Discussion Questions`,
      sermon.mainScripture ? `Read: ${sermon.mainScripture}` : "",
      sermon.outputNotes?.discussion ? `Leader Note: ${sermon.outputNotes.discussion}` : "",
      "",
      questions || "1. What stood out from this sermon?\n2. Where do you sense God inviting you to respond?\n3. How can we pray for one another this week?"
    ].filter(Boolean).join("\n");
  }
  if (type === "slides") {
    const slideLines = (sermon.outline || []).map((block, index) => `Slide ${index + 3}: ${block.title || block.type}\n${block.type} - ${block.body || ""}`).join("\n\n");
    return [
      `${sermon.title} - Slide Plan`,
      sermon.mainScripture ? `Slide 1: Scripture\n${sermon.mainScripture}` : "",
      sermon.bigIdea ? `Slide 2: Big Idea\n${sermon.bigIdea}` : "",
      slideLines,
      sermon.outputNotes?.slides ? `Production Notes\n${sermon.outputNotes.slides}` : ""
    ].filter(Boolean).join("\n\n");
  }
  return sermonPlainText(sermon);
}

function outputHtml(sermon, type) {
  const text = outputText(sermon, type);
  return text.split("\n").map((line) => {
    if (!line.trim()) return "<br>";
    if (/^Slide \d+:/.test(line)) return `<h2>${escapeHtml(line)}</h2>`;
    if (/^\d+\./.test(line)) return `<p>${escapeHtml(line)}</p>`;
    if (["Sermon Outline", "Production Notes"].includes(line) || line.includes("Discussion Questions") || line.includes("Slide Plan")) return `<h2>${escapeHtml(line)}</h2>`;
    if (line === sermon.title) return `<h1>${escapeHtml(line)}</h1>`;
    return `<p>${escapeHtml(line)}</p>`;
  }).join("");
}

function manuscriptHtml(text = "") {
  return text.split(/\n+/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    if (/^(INTRODUCTION|CONCLUSION|INVITATION|LIFE APPLICATIONS)$/i.test(trimmed)) return `<h2>${escapeHtml(trimmed.toUpperCase())}</h2>`;
    if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+/.test(trimmed)) return `<h2>${escapeHtml(trimmed)}</h2>`;
    if (/^[A-Z0-9\s'":;,.!?-]{8,}$/.test(trimmed) && trimmed === trimmed.toUpperCase()) return `<h1>${escapeHtml(trimmed)}</h1>`;
    if (scriptureReferencePattern.test(trimmed)) {
      scriptureReferencePattern.lastIndex = 0;
      return `<p class="scripture-line">${escapeHtml(trimmed)}</p>`;
    }
    scriptureReferencePattern.lastIndex = 0;
    return `<p>${escapeHtml(trimmed)}</p>`;
  }).join("");
}

function renderOutputPreview() {
  const preview = $("#output-preview");
  if (!preview) return;
  preview.innerHTML = outputHtml(readForm(), currentOutput);
}

function save({ quiet = false } = {}) {
  const sermon = readForm();
  if (!sermon.title) {
    if (!quiet) toast("A sermon title is required.", "error");
    return false;
  }
  currentSermon = sermon;
  upsertSermon(sermon);
  $("#autosave-status").textContent = `Saved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  $("#autosave-status-top").textContent = "Saved";
  if (!quiet) toast("Sermon saved.");
  return true;
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  $("#autosave-status").textContent = "Unsaved changes";
  $("#autosave-status-top").textContent = "Unsaved";
  updateMetrics();
  autosaveTimer = window.setTimeout(() => {
    if (getValue("title").trim()) save({ quiet: true });
  }, 900);
}

function setupDrag() {
  let dragged = null;
  $("#outline-list").addEventListener("dragstart", (event) => {
    dragged = event.target.closest(".outline-block");
    if (dragged) dragged.classList.add("dragging");
  });
  $("#outline-list").addEventListener("dragend", () => {
    dragged?.classList.remove("dragging");
    dragged = null;
    scheduleAutosave();
  });
  $("#outline-list").addEventListener("dragover", (event) => {
    event.preventDefault();
    const after = [...$("#outline-list").querySelectorAll(".outline-block:not(.dragging)")].find((block) => event.clientY <= block.getBoundingClientRect().top + block.offsetHeight / 2);
    if (dragged) $("#outline-list").insertBefore(dragged, after || null);
  });
}

function bindEditor() {
  $("#sermon-form").addEventListener("input", scheduleAutosave);
  $("#save-sermon").addEventListener("click", () => save());
  $("#save-sermon-bottom").addEventListener("click", () => save());
  $("#parse-manuscript")?.addEventListener("click", () => {
    try {
      const pasted = getValue("manuscript-paste").trim();
      const parsed = parseSermonManuscript(pasted);
      applyParsedSermon(parsed);
    } catch (error) {
      toast(error.message || "Could not parse that sermon.", "error");
    }
  });
  $("#clear-manuscript-paste")?.addEventListener("click", () => {
    setValue("manuscript-paste", "");
    toast("Paste field cleared.");
  });
  $("#sync-from-manuscript")?.addEventListener("click", syncFromManuscript);
  $("#refresh-manuscript")?.addEventListener("click", refreshManuscriptFromFields);
  $("#focus-mode").addEventListener("click", () => document.body.classList.toggle("writing-focus"));
  $("#focus-mode-top")?.addEventListener("click", () => document.body.classList.toggle("writing-focus"));
  $("#print-sermon").addEventListener("click", () => window.print());
  $("#copy-notes").addEventListener("click", async () => {
    await navigator.clipboard.writeText(sermonPlainText(readForm()));
    toast("Sermon notes copied.");
  });
  $("#copy-notes-panel").addEventListener("click", async () => {
    await navigator.clipboard.writeText(sermonPlainText(readForm()));
    toast("Manuscript copied.");
  });
  $("#copy-handout-panel").addEventListener("click", async () => {
    await navigator.clipboard.writeText(outputText(readForm(), "handout"));
    toast("Handout copied.");
  });
  $("#suggest-prep").addEventListener("click", suggestChecklist);
  $("#mark-ready").addEventListener("click", markReady);
  $("#export-manuscript").addEventListener("click", () => {
    const blob = new Blob([sermonPlainText(readForm())], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(getValue("title") || "sermon").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  $("#export-manuscript-panel").addEventListener("click", () => $("#export-manuscript").click());
  $$(".builder-mode").forEach((button) => {
    button.addEventListener("click", () => setEditorMode(button.dataset.mode));
  });
  $$(".output-tab").forEach((button) => {
    button.addEventListener("click", () => {
      currentOutput = button.dataset.output;
      $$(".output-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      renderOutputPreview();
    });
  });
  $("#copy-output").addEventListener("click", async () => {
    await navigator.clipboard.writeText(outputText(readForm(), currentOutput));
    toast("Output copied.");
  });
  $("#print-output").addEventListener("click", () => {
    renderOutputPreview();
    window.print();
  });
  $(".quick-add").addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]");
    if (!button) return;
    renderOutline([...readOutline(), { id: createId("block"), type: button.dataset.add, title: "", body: "" }]);
    scheduleAutosave();
  });
  $("#add-scripture").addEventListener("click", () => {
    renderScriptureBlocks([...readScriptureBlocks(), { id: createId("scripture"), reference: getValue("mainScripture"), text: "" }]);
    scheduleAutosave();
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".remove-outline")) {
      event.target.closest(".outline-block").remove();
      scheduleAutosave();
    }
    if (event.target.closest(".remove-scripture")) {
      event.target.closest(".outline-block").remove();
      scheduleAutosave();
    }
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    }
  });
  setupDrag();
}

function renderPreachingView(sermon) {
  document.body.className = "preaching-body";
  const metrics = calculateSermonMetrics(sermon);
  document.body.innerHTML = `
    <main class="preaching-shell">
      <div class="preaching-toolbar no-print">
        <div class="button-row">
          <a class="btn" href="sermon-editor.html?id=${sermon.id}">Exit</a>
          <button class="btn" id="size-down" type="button">A-</button>
          <button class="btn" id="size-up" type="button">A+</button>
          <button class="btn" id="timer-toggle" type="button">Start Timer</button>
        </div>
        <strong id="timer">00:00</strong>
      </div>
      <article class="preaching-content">
        <p><strong>${escapeHtml(sermon.mainScripture || "")}</strong> - ${metrics.speakingMinutes} min estimated</p>
        ${sermon.manuscriptDraft ? manuscriptHtml(sermon.manuscriptDraft) : `
          <h1>${escapeHtml(sermon.title)}</h1>
          <p>${escapeHtml(sermon.subtitle || "")}</p>
          ${(sermon.scriptureBlocks || []).map((block) => `<div class="scripture-highlight"><strong>${escapeHtml(block.reference)}</strong><p>${escapeHtml(block.text)}</p></div>`).join("")}
          <h2>Big Idea</h2><p>${escapeHtml(sermon.bigIdea || "")}</p>
          <h2>Introduction</h2><p>${escapeHtml(sermon.introduction || "")}</p>
          ${(sermon.outline || []).map((block) => `<h2>${escapeHtml(block.title || block.type)}</h2><p><em>${escapeHtml(block.type)}</em></p><p>${escapeHtml(block.body || "")}</p>`).join("")}
          <h2>Conclusion</h2><p>${escapeHtml(sermon.conclusion || "")}</p>
          <h2>Invitation / Response</h2><p>${escapeHtml(sermon.invitation || "")}</p>
        `}
      </article>
    </main>
  `;
  let size = 28;
  let timer = 0;
  let timerId = null;
  $("#size-up").addEventListener("click", () => {
    size = Math.min(44, size + 2);
    document.documentElement.style.setProperty("--preach-size", `${size}px`);
  });
  $("#size-down").addEventListener("click", () => {
    size = Math.max(20, size - 2);
    document.documentElement.style.setProperty("--preach-size", `${size}px`);
  });
  $("#timer-toggle").addEventListener("click", () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      $("#timer-toggle").textContent = "Start Timer";
      return;
    }
    $("#timer-toggle").textContent = "Pause Timer";
    timerId = window.setInterval(() => {
      timer += 1;
      $("#timer").textContent = `${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")}`;
    }, 1000);
  });
}

function renderReadOnly(sermon) {
  const metrics = calculateSermonMetrics(sermon);
  $("#sermon-view").innerHTML = `
    <section class="hero">
      <p class="eyebrow">${escapeHtml(sermon.mainScripture || "Sermon manuscript")}</p>
      <h1>${escapeHtml(sermon.title)}</h1>
      <p>${escapeHtml(sermon.bigIdea || sermon.subtitle || "")}</p>
      <div class="meta-row"><span class="status status-${sermon.status.toLowerCase()}">${escapeHtml(sermon.status)}</span><span>${metrics.words} words</span><span>${metrics.speakingMinutes} min</span></div>
      <div class="button-row no-print"><a class="btn" href="sermon-editor.html?id=${sermon.id}">Edit</a><a class="btn btn-primary" href="sermon-view.html?id=${sermon.id}&mode=preach">Preaching View</a><button class="btn" id="print-readonly" type="button">Print Sermon</button></div>
    </section>
    <article class="card panel manuscript">
      ${sermon.manuscriptDraft ? manuscriptHtml(sermon.manuscriptDraft) : `
        <h2>Scripture</h2><p>${escapeHtml(sermon.mainScripture || "")}</p>
        ${(sermon.scriptureBlocks || []).map((block) => `<blockquote><strong>${escapeHtml(block.reference)}</strong><p>${escapeHtml(block.text)}</p></blockquote>`).join("")}
        <h2>Big Idea</h2><p>${escapeHtml(sermon.bigIdea || "")}</p>
        <h2>Introduction</h2><p>${escapeHtml(sermon.introduction || "")}</p>
        ${(sermon.outline || []).map((block) => `<h2>${escapeHtml(block.title || block.type)}</h2><p><strong>${escapeHtml(block.type)}</strong></p><p>${escapeHtml(block.body || "")}</p>`).join("")}
        <h2>Conclusion</h2><p>${escapeHtml(sermon.conclusion || "")}</p>
        <h2>Notes</h2><p>${escapeHtml(sermon.personalNotes || "")}</p>
      `}
    </article>
  `;
  $("#print-readonly").addEventListener("click", () => window.print());
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const data = loadData();
  const sermon = id ? getSermon(id) : blankSermon();
  if (!sermon) {
    document.body.innerHTML = `<main class="page"><div class="empty-state card"><h1>Sermon not found.</h1><a class="btn" href="index.html">Back to sermons</a></div></main>`;
    return;
  }
  if (params.get("mode") === "preach") {
    renderPreachingView(sermon);
    return;
  }
  if ($("#sermon-view")) {
    renderReadOnly(sermon);
    return;
  }
  currentSermon = sermon;
  fillSeriesOptions(data);
  fillForm(sermon);
  bindEditor();
  setEditorMode("plan");
});
