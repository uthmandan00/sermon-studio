import { loadData } from "./storage.js";
import { $, calculateSermonMetrics, escapeHtml, formatDate, parseScriptureBook, prepProgress, readinessReview } from "./utils.js";

let selectedSermonId = "";

function seriesTitle(data, seriesId) {
  return data.series.find((series) => series.id === seriesId)?.title || "Standalone";
}

function monthKey(value) {
  return value ? value.slice(0, 7) : "";
}

function renderDetail(data, sermon) {
  const target = $("#calendar-detail");
  if (!target) return;
  if (!sermon) {
    target.innerHTML = `<div class="empty-state"><h2>Select a sermon</h2><p class="muted">Choose a date or agenda item to inspect the planned message.</p></div>`;
    return;
  }
  const metrics = calculateSermonMetrics(sermon);
  const progress = prepProgress(sermon);
  const review = readinessReview(sermon);
  target.innerHTML = `
    <p class="eyebrow">Selected Sermon</p>
    <h2>${escapeHtml(sermon.title)}</h2>
    <p class="muted">${escapeHtml(sermon.bigIdea || sermon.subtitle || "No big idea entered yet.")}</p>
    <dl class="detail-list">
      <div><dt>Date</dt><dd>${formatDate(sermon.datePreached)}</dd></div>
      <div><dt>Passage</dt><dd>${escapeHtml(sermon.mainScripture || "Not assigned")}</dd></div>
      <div><dt>Series</dt><dd>${escapeHtml(seriesTitle(data, sermon.seriesId))}</dd></div>
      <div><dt>Status</dt><dd><span class="status status-${sermon.status.toLowerCase()}">${escapeHtml(sermon.status)}</span></dd></div>
      <div><dt>Length</dt><dd>${metrics.speakingMinutes} min estimate</dd></div>
      <div><dt>Prep</dt><dd>${progress.percent}% complete</dd></div>
    </dl>
    <div class="prep-progress"><span style="width:${progress.percent}%"></span></div>
    ${review.isReady ? `<div class="prep-ok">Ready checklist complete.</div>` : `<div class="prep-warning"><strong>Next step</strong><ul><li>${escapeHtml(review.missing[0] || "Review sermon preparation.")}</li></ul></div>`}
    <div class="button-row visually-separated">
      <a class="btn btn-primary" href="../sermons/sermon-editor.html?id=${sermon.id}">Open Builder</a>
      <a class="btn" href="../sermons/sermon-view.html?id=${sermon.id}&mode=preach">Preach</a>
    </div>
  `;
}

function renderMonth(data, scheduled) {
  const target = $("#calendar-month");
  if (!target) return;
  const base = scheduled[0]?.datePreached || new Date().toISOString().slice(0, 10);
  const [year, month] = base.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  $("#calendar-month-label").textContent = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const byDate = scheduled.reduce((acc, sermon) => {
    (acc[sermon.datePreached] ||= []).push(sermon);
    return acc;
  }, {});
  const cells = [];
  for (let i = 0; i < first.getDay(); i += 1) cells.push(`<div class="month-cell muted-cell"></div>`);
  for (let day = 1; day <= last.getDate(); day += 1) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const sermons = byDate[iso] || [];
    cells.push(`
      <button class="month-cell ${sermons.length ? "has-sermon" : ""}" type="button" data-id="${sermons[0]?.id || ""}">
        <strong>${day}</strong>
        ${sermons.map((sermon) => `<span>${escapeHtml(sermon.title)}</span>`).join("")}
      </button>
    `);
  }
  target.innerHTML = `
    <div class="month-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
    <div class="month-grid">${cells.join("")}</div>
  `;
}

function renderAgenda(data, scheduled) {
  $("#calendar-schedule").innerHTML = scheduled.length ? scheduled.map((sermon) => `
    <article class="list-item card sermon-card ${sermon.id === selectedSermonId ? "selected" : ""}" data-id="${sermon.id}" tabindex="0">
      <div class="list-item-header">
        <div>
          <h3>${escapeHtml(sermon.title)}</h3>
          <div class="muted">${formatDate(sermon.datePreached)} - ${escapeHtml(sermon.mainScripture || "No scripture")} - ${escapeHtml(seriesTitle(data, sermon.seriesId))}</div>
        </div>
        <div class="library-actions">
          <span class="status status-${sermon.status.toLowerCase()}">${escapeHtml(sermon.status)}</span>
          <a class="btn btn-primary" href="../sermons/sermon-editor.html?id=${sermon.id}">Open</a>
        </div>
      </div>
      <p>${escapeHtml(sermon.bigIdea || sermon.purpose || "No big idea entered yet.")}</p>
    </article>
  `).join("") : `<div class="empty-state card"><h2>No sermons scheduled.</h2><p class="muted">Add a date to a sermon and it will appear here.</p></div>`;
}

function renderSummary(scheduled) {
  const upcoming = scheduled.filter((sermon) => new Date(`${sermon.datePreached}T23:59:59`) >= new Date());
  $("#calendar-summary").innerHTML = [
    ["Scheduled", scheduled.length],
    ["Upcoming", upcoming.length],
    ["Ready", scheduled.filter((sermon) => sermon.status === "Ready").length],
    ["Drafting", scheduled.filter((sermon) => ["Planning", "Drafting", "Editing"].includes(sermon.status)).length]
  ].map(([label, value]) => `<span class="tag">${label}: ${value}</span>`).join("");
  const books = [...new Set(scheduled.map((sermon) => parseScriptureBook(sermon.mainScripture)).filter(Boolean))];
  $("#calendar-books").innerHTML = books.length ? books.map((book) => `<span class="tag">${escapeHtml(book)}</span>`).join("") : `<span class="muted">No scriptures assigned yet.</span>`;
}

document.addEventListener("DOMContentLoaded", () => {
  const data = loadData();
  const scheduled = data.sermons
    .filter((sermon) => sermon.datePreached && sermon.status !== "Archived")
    .sort((a, b) => a.datePreached.localeCompare(b.datePreached));
  selectedSermonId = scheduled[0]?.id || "";
  renderMonth(data, scheduled);
  renderAgenda(data, scheduled);
  renderSummary(scheduled);
  renderDetail(data, scheduled.find((sermon) => sermon.id === selectedSermonId));
  document.addEventListener("click", (event) => {
    const item = event.target.closest("[data-id]");
    if (!item?.dataset.id) return;
    selectedSermonId = item.dataset.id;
    renderAgenda(data, scheduled);
    renderDetail(data, scheduled.find((sermon) => sermon.id === selectedSermonId));
  });
});
