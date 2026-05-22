import { deleteData, duplicateSermon, loadData, upsertSermon } from "./storage.js";
import { filterSermons, getSearchState, renderFilterOptions, renderRecentSearches, renderSearchSummary, saveRecentSearch } from "./search.js";
import { $, $$, calculateSermonMetrics, confirmAction, escapeHtml, formatDate, formatDateTime, prepProgress, readinessReview, toast } from "./utils.js";

let selectedSermonId = "";

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

function rerender() {
  const data = loadData();
  const state = getSearchState();
  renderSermonList(data, filterSermons(data, state));
  renderRecentSearches(data);
}

function bindActions() {
  document.addEventListener("click", (event) => {
    const row = event.target.closest(".manager-row");
    if (row) {
      selectedSermonId = row.dataset.id;
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
  $("#sermon-list").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const row = event.target.closest(".manager-row");
    if (!row) return;
    selectedSermonId = row.dataset.id;
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
  renderSermonList(data, filterSermons(data, getSearchState()));
  renderRecentSearches(data);
  $$(".filters input, .filters select").forEach((control) => {
    control.addEventListener("input", () => {
      saveRecentSearch($("#search-query")?.value.trim());
      rerender();
    });
  });
  bindActions();
});
