import { deleteData, duplicateSeries, loadData, upsertSeries } from "./storage.js";
import { $, $$, confirmAction, createId, escapeHtml, formatDate, listToString, normalizeList, nowIso, toast } from "./utils.js";

function seriesProgress(data, series) {
  const sermons = data.sermons.filter((sermon) => sermon.seriesId === series.id);
  const ready = sermons.filter((sermon) => ["Ready", "Preached"].includes(sermon.status)).length;
  return sermons.length ? Math.round((ready / sermons.length) * 100) : 0;
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function plannedSlots(series, sermons) {
  const maxWeek = Math.max(sermons.length, ...sermons.map((sermon) => Number(sermon.weekNumber) || 0), 1);
  return Array.from({ length: maxWeek }, (_, index) => {
    const week = index + 1;
    return {
      week,
      date: series.startDate ? addDays(series.startDate, index * 7) : "",
      sermon: sermons.find((item) => Number(item.weekNumber) === week) || sermons[index]
    };
  });
}

function renderSeriesList(data) {
  const target = $("#series-list");
  if (!data.series.length) {
    target.innerHTML = `<div class="empty-state card"><h2>No active series created.</h2><p class="muted">Create a series to gather sermons around a theme.</p></div>`;
    return;
  }
  target.innerHTML = data.series.map((series) => {
    const sermons = data.sermons.filter((sermon) => sermon.seriesId === series.id);
    const progress = seriesProgress(data, series);
    return `
      <article class="card series-card">
        <div class="series-banner" style="background:${escapeHtml(series.bannerColor || "#7f1d2d")}">
          <h3>${escapeHtml(series.title)}</h3>
          <div>${escapeHtml(series.subtitle || series.themeScripture || "")}</div>
        </div>
        <div class="series-body">
          <div class="list-item-header">
            <div>
              <p>${escapeHtml(series.description || "No description yet.")}</p>
              <div class="muted">${formatDate(series.startDate)} - ${formatDate(series.endDate, "Open ended")} - ${sermons.length} sermons</div>
            </div>
            <span class="status status-${series.status.toLowerCase()}">${escapeHtml(series.status)}</span>
          </div>
          <div class="series-progress" aria-label="${progress}% complete"><span style="width:${progress}%"></span></div>
          <div class="button-row visually-separated">
            <a class="btn" href="series-view.html?id=${series.id}">Overview</a>
            <button class="btn edit-series" data-id="${series.id}" type="button">Edit</button>
            <button class="btn duplicate-series" data-id="${series.id}" type="button">Duplicate</button>
            <button class="btn archive-series" data-id="${series.id}" type="button">${series.status === "Archived" ? "Restore" : "Archive"}</button>
            <button class="btn btn-danger delete-series" data-id="${series.id}" type="button">Delete</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function openForm(series = {}) {
  $("#series-id").value = series.id || "";
  $("#series-title").value = series.title || "";
  $("#series-subtitle").value = series.subtitle || "";
  $("#series-description").value = series.description || "";
  $("#series-scripture").value = series.themeScripture || "";
  $("#series-theme").value = series.themeStatement || "";
  $("#series-start").value = series.startDate || "";
  $("#series-end").value = series.endDate || "";
  $("#series-color").value = series.bannerColor || "#0f6b35";
  $("#series-tags").value = listToString(series.tags);
  $("#series-status").value = series.status || "Planning";
  $("#series-form-card").hidden = false;
  $("#series-title").focus();
}

function readForm() {
  return {
    id: $("#series-id").value || createId("series"),
    title: $("#series-title").value.trim(),
    subtitle: $("#series-subtitle").value.trim(),
    description: $("#series-description").value.trim(),
    themeScripture: $("#series-scripture").value.trim(),
    themeStatement: $("#series-theme").value.trim(),
    startDate: $("#series-start").value,
    endDate: $("#series-end").value,
    bannerColor: $("#series-color").value,
    tags: normalizeList($("#series-tags").value),
    status: $("#series-status").value,
    sermonIds: loadData().series.find((item) => item.id === $("#series-id").value)?.sermonIds || [],
    archived: $("#series-status").value === "Archived",
    createdAt: loadData().series.find((item) => item.id === $("#series-id").value)?.createdAt || nowIso()
  };
}

function bindIndex() {
  $$(".new-series-button").forEach((button) => button.addEventListener("click", () => openForm()));
  $("#cancel-series").addEventListener("click", () => $("#series-form-card").hidden = true);
  $("#series-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const series = readForm();
    if (!series.title) {
      toast("Series title is required.", "error");
      return;
    }
    upsertSeries(series);
    toast("Series saved.");
    $("#series-form-card").hidden = true;
    renderSeriesList(loadData());
  });
  $("#series-list").addEventListener("click", (event) => {
    const data = loadData();
    const edit = event.target.closest(".edit-series");
    const duplicate = event.target.closest(".duplicate-series");
    const archive = event.target.closest(".archive-series");
    const remove = event.target.closest(".delete-series");
    if (edit) openForm(data.series.find((item) => item.id === edit.dataset.id));
    if (duplicate) {
      duplicateSeries(duplicate.dataset.id);
      toast("Series duplicated.");
      renderSeriesList(loadData());
    }
    if (archive) {
      const series = data.series.find((item) => item.id === archive.dataset.id);
      upsertSeries({ ...series, status: series.status === "Archived" ? "Planning" : "Archived", archived: series.status !== "Archived" });
      toast(series.status === "Archived" ? "Series restored." : "Series archived.");
      renderSeriesList(loadData());
    }
    if (remove && confirmAction("Delete this series? Sermons will become standalone.")) {
      deleteData("series", remove.dataset.id);
      toast("Series deleted.");
      renderSeriesList(loadData());
    }
  });
}

function renderSeriesView(data) {
  const id = new URLSearchParams(window.location.search).get("id");
  const series = data.series.find((item) => item.id === id);
  const target = $("#series-view");
  if (!series) {
    target.innerHTML = `<div class="empty-state card"><h1>Series not found.</h1><a class="btn" href="index.html">Back to series</a></div>`;
    return;
  }
  const sermons = data.sermons.filter((sermon) => sermon.seriesId === series.id).sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
  const progress = seriesProgress(data, series);
  const slots = plannedSlots(series, sermons);
  const readyCount = sermons.filter((sermon) => ["Ready", "Preached"].includes(sermon.status)).length;
  const draftCount = sermons.filter((sermon) => ["Planning", "Drafting", "Editing"].includes(sermon.status)).length;
  target.innerHTML = `
    <section class="series-overview-hero">
      <p class="eyebrow">${escapeHtml(series.themeScripture || "Series overview")}</p>
      <h1>${escapeHtml(series.title)}</h1>
      <p>${escapeHtml(series.themeStatement || series.description || "")}</p>
      <div class="meta-row">
        <span class="status status-${series.status.toLowerCase()}">${escapeHtml(series.status)}</span>
        <span>${formatDate(series.startDate)} - ${formatDate(series.endDate, "Open ended")}</span>
        <span>${sermons.length} sermons</span>
      </div>
      <div class="series-meter">
        <div class="series-progress" aria-label="${progress}% complete"><span style="width:${progress}%"></span></div>
        <strong>${progress}%</strong>
      </div>
    </section>
    <section class="series-overview-grid">
      <aside class="card panel series-planner-side">
        <h2>Series Overview</h2>
        <p>${escapeHtml(series.description || "")}</p>
        <div class="tag-row">${(series.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="detail-stat-grid visually-separated">
          <div><strong>${sermons.length}</strong><span>Sermons</span></div>
          <div><strong>${readyCount}</strong><span>Ready</span></div>
          <div><strong>${draftCount}</strong><span>In Prep</span></div>
        </div>
        <dl class="detail-list">
          <div><dt>Theme</dt><dd>${escapeHtml(series.themeStatement || "Not set")}</dd></div>
          <div><dt>Scripture</dt><dd>${escapeHtml(series.themeScripture || "Not set")}</dd></div>
          <div><dt>Status</dt><dd><span class="status status-${series.status.toLowerCase()}">${escapeHtml(series.status)}</span></dd></div>
        </dl>
      </aside>
      <div>
        <section class="section-heading"><h2>Week-by-Week Plan</h2><a class="btn btn-primary" href="../sermons/sermon-editor.html?series=${series.id}">Add Sermon</a></section>
        <div class="series-plan">${slots.map((slot) => slot.sermon ? `
          <article class="series-slot card filled">
            <div class="slot-week"><strong>Week ${slot.week}</strong><span>${formatDate(slot.sermon.datePreached || slot.date, "Unscheduled")}</span></div>
            <div>
              <h3>${escapeHtml(slot.sermon.title)}</h3>
              <p class="muted">${escapeHtml(slot.sermon.mainScripture || "No passage")} - ${escapeHtml(slot.sermon.bigIdea || "No big idea entered yet.")}</p>
              <div class="tag-row"><span class="status status-${slot.sermon.status.toLowerCase()}">${escapeHtml(slot.sermon.status)}</span>${(slot.sermon.tags || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
            </div>
            <a class="btn" href="../sermons/sermon-editor.html?id=${slot.sermon.id}">Edit</a>
          </article>
        ` : `
          <article class="series-slot card empty">
            <div class="slot-week"><strong>Week ${slot.week}</strong><span>${formatDate(slot.date, "Unscheduled")}</span></div>
            <div>
              <h3>Open sermon slot</h3>
              <p class="muted">No sermon assigned yet.</p>
            </div>
            <a class="btn btn-primary" href="../sermons/sermon-editor.html?series=${series.id}&week=${slot.week}&date=${slot.date}">Add</a>
          </article>
        `).join("") || `<div class="empty-state card"><h3>No sermons connected to this series yet.</h3></div>`}</div>
        </div>
    </section>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  const data = loadData();
  if ($("#series-list")) {
    renderSeriesList(data);
    bindIndex();
  }
  if ($("#series-view")) {
    renderSeriesView(data);
  }
});
