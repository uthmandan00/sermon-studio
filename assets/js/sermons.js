import { deleteData, duplicateSermon, loadData, upsertSermon } from "./storage.js";
import { filterSermons, getSearchState, renderFilterOptions, renderRecentSearches, renderSearchSummary, saveRecentSearch } from "./search.js";
import { $, $$, calculateSermonMetrics, confirmAction, createId, escapeHtml, formatDate, formatDateTime, normalizeList, nowIso, prepProgress, readinessReview, safeExternalUrl, toast } from "./utils.js";

let selectedSermonId = "";
const VIEW_KEY = "sermon-library-view";
const workflowStatuses = ["Planning", "Drafting", "Editing", "Ready", "Preached", "Archived"];
const scriptureReferencePattern = /\b(?:[1-3]\s*)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+\d+:\d+(?:[\u2013-]\d+)?/g;
const singleScriptureReferencePattern = /\b(?:[1-3]\s*)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+\d+:\d+(?:[\u2013-]\d+)?/;
const romanPointPattern = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+(.+)$/i;

function seriesTitle(data, seriesId) {
  return data.series.find((series) => series.id === seriesId)?.title || "Standalone";
}

function renderDetailPane(data, sermon) {
  const target = $("#sermon-detail");
  if (!target) return;
  if (!sermon) {
    target.innerHTML = `
      <div class="empty-state">
        <h2>Select a sermon</h2>
        <p class="muted">Choose a row to see metadata, preparation details, and quick actions.</p>
      </div>
    `;
    return;
  }
  const metrics = calculateSermonMetrics(sermon);
  const progress = prepProgress(sermon);
  const review = readinessReview(sermon);
  const audioUrl = safeExternalUrl(sermon.audio?.url);
  target.innerHTML = `
    <p class="eyebrow">Sermon Details</p>
    <h2>${escapeHtml(sermon.title)}</h2>
    <p class="muted">${escapeHtml(sermon.bigIdea || sermon.subtitle || "No big idea entered yet.")}</p>
    <div class="detail-stat-grid">
      <div><strong>${metrics.words}</strong><span>Words</span></div>
      <div><strong>${metrics.speakingMinutes}</strong><span>Minutes</span></div>
      <div><strong>${progress.percent}%</strong><span>Prep</span></div>
    </div>
    <div class="prep-progress"><span style="width:${progress.percent}%"></span></div>
    ${review.isReady ? `<div class="prep-ok">Ready checklist complete.</div>` : `<div class="prep-warning"><strong>Needs attention</strong><ul>${review.missing.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`}
    <dl class="detail-list">
      <div><dt>Date</dt><dd>${formatDate(sermon.datePreached)}</dd></div>
      <div><dt>Passage</dt><dd>${escapeHtml(sermon.mainScripture || "Not assigned")}</dd></div>
      <div><dt>Series</dt><dd>${escapeHtml(seriesTitle(data, sermon.seriesId))}</dd></div>
      <div><dt>Speaker</dt><dd>${escapeHtml(sermon.speaker || "Not assigned")}</dd></div>
      <div><dt>Audio</dt><dd>${audioUrl ? `<a href="${escapeHtml(audioUrl)}" target="_blank" rel="noreferrer">Recording linked</a>` : "No recording linked"}</dd></div>
      <div><dt>Last Edited</dt><dd>${formatDateTime(sermon.updatedAt)}</dd></div>
    </dl>
    <div class="tag-row">${(sermon.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    <div class="button-row visually-separated">
      <a class="btn btn-primary" href="sermon-editor.html?id=${sermon.id}">Open Builder</a>
      <a class="btn" href="sermon-view.html?id=${sermon.id}">Manuscript</a>
      <a class="btn" href="sermon-view.html?id=${sermon.id}&mode=preach">Preach</a>
      <button class="btn duplicate-sermon" data-id="${sermon.id}" type="button">Duplicate</button>
      <button class="btn archive-sermon" data-id="${sermon.id}" type="button">${sermon.status === "Archived" ? "Restore" : "Archive"}</button>
      <button class="btn btn-danger delete-sermon" data-id="${sermon.id}" type="button">Delete</button>
    </div>
  `;
}

function renderSermonList(data, sermons) {
  const target = $("#sermon-list");
  renderSearchSummary(sermons.length);
  if (!sermons.length) {
    target.innerHTML = `<div class="empty-state card"><h2>No sermons found.</h2><p class="muted">Try a different search, or start a new sermon.</p><a class="btn btn-primary" href="sermon-editor.html">New Sermon</a></div>`;
    renderDetailPane(data, null);
    return;
  }
  if (!selectedSermonId || !sermons.some((sermon) => sermon.id === selectedSermonId)) {
    selectedSermonId = sermons[0].id;
  }
  target.innerHTML = sermons.map((sermon) => `
    <article class="manager-row ${sermon.id === selectedSermonId ? "selected" : ""} ${sermon.pinned ? "pinned" : ""}" data-id="${sermon.id}" role="listitem" tabindex="0">
      <span>
        <strong>${sermon.pinned ? "* " : ""}${escapeHtml(sermon.title)}</strong>
        <small>${escapeHtml(sermon.speaker || "No speaker")} - edited ${formatDateTime(sermon.updatedAt)}</small>
      </span>
      <span>${formatDate(sermon.datePreached)}</span>
      <span>${escapeHtml(sermon.mainScripture || "No scripture")}</span>
      <span>${escapeHtml(seriesTitle(data, sermon.seriesId))}</span>
      <span><span class="status status-${sermon.status.toLowerCase()}">${escapeHtml(sermon.status)}</span><small>${prepProgress(sermon).percent}% prep</small></span>
    </article>
  `).join("");
  renderDetailPane(data, sermons.find((sermon) => sermon.id === selectedSermonId));
}

function renderWorkflowBoard(data, sermons) {
  const target = $("#workflow-board");
  if (!target) return;
  if (!sermons.length) {
    target.innerHTML = `<div class="empty-state card"><h2>No sermons on the board.</h2><p class="muted">Adjust your filters or start a new sermon.</p><a class="btn btn-primary" href="sermon-editor.html">New Sermon</a></div>`;
    return;
  }
  target.innerHTML = workflowStatuses.map((status) => {
    const items = sermons.filter((sermon) => sermon.status === status);
    return `
      <section class="workflow-column" data-status="${status}" aria-label="${status} sermons">
        <header>
          <span class="status status-${status.toLowerCase()}">${status}</span>
          <strong>${items.length}</strong>
        </header>
        <div class="workflow-dropzone">
          ${items.length ? items.map((sermon) => {
            const metrics = calculateSermonMetrics(sermon);
            const progress = prepProgress(sermon).percent;
            return `
              <article class="workflow-card" draggable="true" data-id="${sermon.id}" tabindex="0">
                <strong>${escapeHtml(sermon.title || "Untitled sermon")}</strong>
                <span>${escapeHtml(sermon.mainScripture || "No scripture")} - ${escapeHtml(seriesTitle(data, sermon.seriesId))}</span>
                <div class="workflow-meta">
                  <small>${formatDate(sermon.datePreached)}</small>
                  <small>${sermon.audio?.url ? "Audio" : `${metrics.speakingMinutes} min`}</small>
                </div>
                <div class="prep-progress" aria-label="${progress}% preparation complete"><span style="width:${progress}%"></span></div>
                <div class="workflow-actions">
                  <a class="btn" href="sermon-editor.html?id=${sermon.id}">Open</a>
                  <a class="btn" href="sermon-view.html?id=${sermon.id}&mode=preach">Preach</a>
                </div>
              </article>
            `;
          }).join("") : `<div class="workflow-empty">Drop sermons here</div>`}
        </div>
      </section>
    `;
  }).join("");
}

function setLibraryView(view = "board") {
  const safeView = view === "library" ? "library" : "board";
  localStorage.setItem(VIEW_KEY, safeView);
  $$(".view-toggle").forEach((button) => {
    const isActive = button.dataset.view === safeView;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  $("#workflow-board")?.classList.toggle("view-hidden", safeView !== "board");
  $("#library-view")?.classList.toggle("view-hidden", safeView !== "library");
}

function rerender() {
  const data = loadData();
  const state = getSearchState();
  const sermons = filterSermons(data, state);
  renderWorkflowBoard(data, sermons);
  renderSermonList(data, sermons);
  renderRecentSearches(data);
  setLibraryView(localStorage.getItem(VIEW_KEY) || "board");
}

function cleanTitle(value = "") {
  return value.trim().replace(/^[\s"'\u2018\u2019\u201c\u201d]+|[\s"'\u2018\u2019\u201c\u201d]+$/g, "");
}

function parseImportedSermon(text, fileName = "Imported sermon") {
  const lines = text.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  const title = cleanTitle(lines[0] || fileName.replace(/\.docx$/i, ""));
  const scriptureLine = lines.slice(1, 5).find((line) => singleScriptureReferencePattern.test(line)) || "";
  const firstReference = scriptureLine.match(singleScriptureReferencePattern)?.[0] || text.match(singleScriptureReferencePattern)?.[0] || "";
  const outline = [];
  lines.forEach((line, index) => {
    const match = line.match(romanPointPattern);
    if (!match) return;
    const nextHeading = lines.slice(index + 1).findIndex((candidate) => romanPointPattern.test(candidate));
    const end = nextHeading === -1 ? Math.min(lines.length, index + 10) : index + 1 + nextHeading;
    outline.push({
      id: createId("block"),
      type: "Main Point",
      title: match[2].trim(),
      body: lines.slice(index + 1, end).join("\n\n")
    });
  });
  const supportingScriptures = [...new Set((text.match(scriptureReferencePattern) || []).map((item) => item.trim()))]
    .filter((reference) => reference !== firstReference)
    .join("; ");
  return {
    id: createId("sermon"),
    title,
    subtitle: "",
    seriesId: "",
    weekNumber: "",
    datePreached: "",
    location: "",
    speaker: "",
    mainScripture: firstReference,
    supportingScriptures,
    scriptureBlocks: [],
    bigIdea: "",
    purpose: "",
    fallenConditionFocus: "",
    introduction: "",
    manuscriptDraft: text.trim(),
    outline,
    transitions: "",
    illustrations: "",
    applications: "",
    quotes: "",
    conclusion: "",
    invitation: "",
    personalNotes: `Imported from ${fileName}.`,
    researchNotes: "",
    commentaryReferences: "",
    prayerNotes: "",
    audio: {
      title: "",
      url: "",
      recordedAt: "",
      notes: ""
    },
    outputNotes: { handout: "", slides: "", discussion: "" },
    prepChecklist: {
      manuscript: Boolean(text.trim()),
      slides: false,
      handout: false,
      discussion: false,
      prayer: false,
      print: false,
      preachReady: false
    },
    tags: normalizeList("word import"),
    topics: [],
    status: "Drafting",
    estimatedLength: 30,
    audience: "",
    favorite: false,
    pinned: false,
    archived: false,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function appendImportLog(message, detail = "", type = "success") {
  const target = $("#word-import-log");
  if (!target) return;
  target.insertAdjacentHTML("beforeend", `
    <article class="import-log-item ${type === "error" ? "error" : ""}">
      <span><strong>${escapeHtml(message)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}</span>
    </article>
  `);
}

async function importWordDocument(file) {
  const response = await fetch("/api/import-docx", {
    method: "POST",
    headers: { "Content-Type": file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    body: file
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not read Word document.");
  if (!result.text?.trim()) throw new Error("No sermon text found in this document.");
  const sermon = parseImportedSermon(result.text, file.name);
  upsertSermon(sermon);
  return sermon;
}

async function importWordDocuments() {
  const input = $("#word-doc-files");
  const files = Array.from(input?.files || []);
  if (!files.length) {
    toast("Choose one or more .docx files first.", "error");
    return;
  }
  if (window.location.protocol === "file:") {
    toast("Word import needs the local server URL: http://127.0.0.1:4173/", "error");
    return;
  }
  $("#word-import-log").innerHTML = "";
  let imported = 0;
  for (const file of files) {
    try {
      const sermon = await importWordDocument(file);
      imported += 1;
      appendImportLog(`Imported ${sermon.title}`, `${file.name} -> ${sermon.mainScripture || "No scripture detected"}`);
      selectedSermonId = sermon.id;
    } catch (error) {
      appendImportLog(`Could not import ${file.name}`, error.message, "error");
    }
  }
  input.value = "";
  rerender();
  toast(`${imported} sermon${imported === 1 ? "" : "s"} imported.`);
}

function bindActions() {
  document.addEventListener("click", (event) => {
    const viewToggle = event.target.closest(".view-toggle");
    if (viewToggle) {
      setLibraryView(viewToggle.dataset.view);
      return;
    }
    const row = event.target.closest(".manager-row");
    if (row) {
      selectedSermonId = row.dataset.id;
      rerender();
      return;
    }
    const workflowCard = event.target.closest(".workflow-card");
    if (workflowCard && !event.target.closest("a, button")) {
      selectedSermonId = workflowCard.dataset.id;
      setLibraryView("library");
      rerender();
      return;
    }
    const duplicate = event.target.closest(".duplicate-sermon");
    const archive = event.target.closest(".archive-sermon");
    const remove = event.target.closest(".delete-sermon");
    if (duplicate) {
      const copy = duplicateSermon(duplicate.dataset.id);
      toast(`Duplicated ${copy.title}.`);
      rerender();
    }
    if (archive) {
      const data = loadData();
      const sermon = data.sermons.find((item) => item.id === archive.dataset.id);
      upsertSermon({ ...sermon, status: sermon.status === "Archived" ? "Drafting" : "Archived", archived: sermon.status !== "Archived" });
      toast(sermon.status === "Archived" ? "Sermon restored." : "Sermon archived.");
      rerender();
    }
    if (remove && confirmAction("Delete this sermon? This cannot be undone.")) {
      deleteData("sermons", remove.dataset.id);
      toast("Sermon deleted.");
      rerender();
    }
  });
  $("#show-word-import")?.addEventListener("click", () => {
    $("#word-import-card").hidden = false;
    $("#word-doc-files")?.focus();
  });
  $("#close-word-import")?.addEventListener("click", () => $("#word-import-card").hidden = true);
  $("#import-word-docs")?.addEventListener("click", importWordDocuments);
  $("#sermon-list").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const row = event.target.closest(".manager-row");
    if (!row) return;
    selectedSermonId = row.dataset.id;
    rerender();
  });
  $("#workflow-board")?.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".workflow-card");
    if (!card) return;
    event.dataTransfer.setData("text/plain", card.dataset.id);
    card.classList.add("dragging");
  });
  $("#workflow-board")?.addEventListener("dragend", (event) => {
    event.target.closest(".workflow-card")?.classList.remove("dragging");
  });
  $("#workflow-board")?.addEventListener("dragover", (event) => {
    if (!event.target.closest(".workflow-column")) return;
    event.preventDefault();
    event.target.closest(".workflow-column").classList.add("drag-over");
  });
  $("#workflow-board")?.addEventListener("dragleave", (event) => {
    event.target.closest(".workflow-column")?.classList.remove("drag-over");
  });
  $("#workflow-board")?.addEventListener("drop", (event) => {
    const column = event.target.closest(".workflow-column");
    if (!column) return;
    event.preventDefault();
    column.classList.remove("drag-over");
    const sermonId = event.dataTransfer.getData("text/plain");
    const data = loadData();
    const sermon = data.sermons.find((item) => item.id === sermonId);
    if (!sermon || sermon.status === column.dataset.status) return;
    upsertSermon({ ...sermon, status: column.dataset.status, archived: column.dataset.status === "Archived" });
    toast(`Moved ${sermon.title || "sermon"} to ${column.dataset.status}.`);
    rerender();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const data = loadData();
  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get("q");
  const searchInput = $("#search-query");
  if (initialQuery && searchInput) searchInput.value = initialQuery;
  if (params.get("focus") === "search" && searchInput) window.setTimeout(() => searchInput.focus(), 80);
  renderFilterOptions(data);
  const sermons = filterSermons(data, getSearchState());
  renderWorkflowBoard(data, sermons);
  renderSermonList(data, sermons);
  renderRecentSearches(data);
  setLibraryView(localStorage.getItem(VIEW_KEY) || "board");
  $$(".filters input, .filters select").forEach((control) => {
    control.addEventListener("input", () => {
      saveRecentSearch($("#search-query")?.value.trim());
      rerender();
    });
  });
  bindActions();
});
