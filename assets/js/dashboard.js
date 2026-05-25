import { loadData } from "./storage.js";
import { $, escapeHtml, formatDate, formatDateTime, parseScriptureBook, prepProgress, readinessReview } from "./utils.js";

function seriesTitle(data, seriesId) {
  return data.series.find((item) => item.id === seriesId)?.title || "Standalone";
}

function renderStats(data) {
  const now = new Date();
  const year = now.getFullYear();
  const monthPrefix = now.toISOString().slice(0, 7);
  const preachedThisYear = data.sermons.filter((sermon) => sermon.status === "Preached" && String(sermon.datePreached).startsWith(String(year))).length;
  const scheduledThisMonth = data.sermons.filter((sermon) => String(sermon.datePreached || "").startsWith(monthPrefix)).length;
  const ready = data.sermons.filter((sermon) => sermon.status === "Ready").length;
  const incompletePrep = data.sermons.filter((sermon) => sermon.datePreached && !readinessReview(sermon).isReady && sermon.status !== "Archived").length;
  const stats = [
    ["B", "Total Sermons", data.sermons.length, `${scheduledThisMonth} scheduled this month`, "#0f6b35"],
    ["S", "Active Series", data.series.filter((item) => item.status === "Active" && !item.archived).length, `${data.series.filter((item) => item.status === "Planning").length} in planning`, "#2f80ed"],
    ["C", "Sermons Preached", preachedThisYear, `${ready} ready now`, "#7c5cff"],
    ["P", "Prep Needed", incompletePrep, "Scheduled but incomplete", "#d4912b"]
  ];
  $("#stats").innerHTML = stats.map(([icon, label, value, note, color]) => `
    <article class="card panel stat" style="--stat-color:${color}">
      <span class="stat-icon">${icon}</span>
      <span>
        <strong>${value}</strong>
        <span class="muted">${label}</span>
        <small>${note}</small>
      </span>
    </article>
  `).join("");
}

function renderCurrentSeries(data) {
  const series = data.series.find((item) => item.status === "Active" && !item.archived) || data.series[0];
  const target = $("#current-series-card");
  if (!target || !series) return;
  const sermons = data.sermons.filter((sermon) => sermon.seriesId === series.id);
  const ready = sermons.filter((sermon) => ["Ready", "Preached"].includes(sermon.status)).length;
  const progress = sermons.length ? Math.max(33, Math.round((ready / sermons.length) * 100)) : 0;
  target.innerHTML = `
    <p class="eyebrow">Current Series</p>
    <h2>${escapeHtml(series.title)}</h2>
    <p class="muted">${escapeHtml(series.subtitle || series.description || "")}</p>
    <div class="series-meter">
      <div class="series-progress" aria-label="${progress}% complete"><span style="width:${progress}%"></span></div>
      <strong>${progress}%</strong>
    </div>
    <div class="series-stats">
      <div><strong>${sermons.length}</strong><span>Sermons</span></div>
      <div><strong>${formatDate(series.startDate).replace(",", "")} - ${formatDate(series.endDate, "Open").replace(",", "")}</strong><span>Date Range</span></div>
      <div><strong>${Math.max(1, sermons.length + 1)}</strong><span>Weeks</span></div>
    </div>
  `;
}

function getNextSermon(data) {
  const upcoming = data.sermons
    .filter((sermon) => sermon.datePreached && sermon.status !== "Archived")
    .sort((a, b) => a.datePreached.localeCompare(b.datePreached));
  return upcoming.find((sermon) => new Date(`${sermon.datePreached}T23:59:59`) >= new Date()) || upcoming[0];
}

function setPreachingLinks(data) {
  const next = getNextSermon(data);
  const href = next ? `sermons/sermon-view.html?id=${next.id}&mode=preach` : "sermons/index.html";
  ["#top-preaching-link", "#hero-preaching-link"].forEach((selector) => {
    const link = $(selector);
    if (link) link.href = href;
  });
}

function renderReadinessStrip(data) {
  const target = $("#readiness-strip");
  if (!target) return;
  const next = getNextSermon(data);
  if (!next) {
    target.innerHTML = `
      <div>
        <p class="eyebrow">Preparation</p>
        <h2>No sermon scheduled yet.</h2>
        <p class="muted">Schedule the next sermon to track preparation progress.</p>
      </div>
      <a class="btn btn-primary" href="sermons/sermon-editor.html">New Sermon</a>
    `;
    return;
  }
  const progress = prepProgress(next);
  const review = readinessReview(next);
  target.innerHTML = `
    <div class="readiness-main">
      <p class="eyebrow">Next Sermon Prep</p>
      <h2>${escapeHtml(next.title)}</h2>
      <p class="muted">${formatDate(next.datePreached)} - ${escapeHtml(next.mainScripture || "No scripture")} - ${escapeHtml(seriesTitle(data, next.seriesId))}</p>
      <div class="prep-progress"><span style="width:${progress.percent}%"></span></div>
    </div>
    <div class="readiness-next">
      <strong>${progress.percent}% ready</strong>
      <span>${review.isReady ? "Ready checklist complete." : escapeHtml(review.missing[0] || "Review sermon preparation.")}</span>
    </div>
    <a class="btn btn-primary" href="sermons/sermon-editor.html?id=${next.id}">Continue Preparing</a>
  `;
}

function renderSchedule(data) {
  const sermons = data.sermons
    .filter((sermon) => sermon.datePreached && sermon.status !== "Archived")
    .sort((a, b) => a.datePreached.localeCompare(b.datePreached))
    .slice(0, 6);
  $("#upcoming-list").innerHTML = sermons.length ? sermons.map((sermon) => `
    <article class="schedule-row">
      <div class="date-pill">${formatDate(sermon.datePreached).replace(",", "").split(" ").slice(0, 2).join("<br>")}</div>
      <div>
        <strong>${escapeHtml(sermon.title)}</strong>
        <div class="muted">${escapeHtml(sermon.mainScripture || "No scripture yet")} - ${escapeHtml(seriesTitle(data, sermon.seriesId))}</div>
      </div>
      <span class="status status-${sermon.status.toLowerCase()}">${escapeHtml(sermon.status)}</span>
      <a class="btn" href="sermons/sermon-editor.html?id=${sermon.id}">Edit</a>
    </article>
  `).join("") : `<div class="empty-state card"><h3>No scheduled sermons.</h3><p class="muted">Schedule a sermon to build your preaching calendar.</p></div>`;
}

function renderSeries(data) {
  if (!$("#active-series")) return;
  const active = data.series.filter((series) => series.status === "Active" && !series.archived).slice(0, 3);
  $("#active-series").innerHTML = active.length ? active.map((series) => {
    const sermons = data.sermons.filter((sermon) => sermon.seriesId === series.id);
    const preached = sermons.filter((sermon) => ["Preached", "Ready"].includes(sermon.status)).length;
    const progress = sermons.length ? Math.round((preached / sermons.length) * 100) : 0;
    return `
      <article class="card panel">
        <div class="list-item-header">
          <div>
            <h3>${escapeHtml(series.title)}</h3>
            <p class="muted">${formatDate(series.startDate)} - ${formatDate(series.endDate, "Open ended")}</p>
          </div>
          <span class="status status-active">Active</span>
        </div>
        <p>${escapeHtml(series.themeStatement || series.description || "")}</p>
        <div class="series-progress" aria-label="${progress}% complete"><span style="width:${progress}%"></span></div>
      </article>
    `;
  }).join("") : `<div class="empty-state card"><h3>No active series created.</h3><p class="muted">Create a series to organize sermons by season or theme.</p></div>`;
}

function renderRecent(data) {
  if (!$("#recent-sermons")) return;
  const recent = [...data.sermons].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 5);
  $("#recent-sermons").innerHTML = recent.map((sermon) => `
    <article class="list-item card">
      <div class="list-item-header">
        <div>
          <h3><a href="sermons/sermon-editor.html?id=${sermon.id}">${escapeHtml(sermon.title)}</a></h3>
          <div class="muted">${escapeHtml(sermon.mainScripture || "No scripture")} - edited ${formatDateTime(sermon.updatedAt)}</div>
        </div>
        <span class="status status-${sermon.status.toLowerCase()}">${escapeHtml(sermon.status)}</span>
      </div>
    </article>
  `).join("");
}

function renderActivity(data) {
  const recent = (data.meta.activity || []).slice(0, 8);
  $("#activity-feed").innerHTML = recent.length ? recent.map((item) => `
    <li>
      <strong>${escapeHtml(item.message)}</strong>
      <div class="muted">${formatDateTime(item.date)}</div>
    </li>
  `).join("") : `<li><strong>No activity yet.</strong><div class="muted">Create or edit a sermon to begin tracking work.</div></li>`;
}

function renderAnalytics(data) {
  if (!$("#analytics")) return;
  const byBook = data.sermons.reduce((acc, sermon) => {
    const book = parseScriptureBook(sermon.mainScripture) || "Unassigned";
    acc[book] = (acc[book] || 0) + 1;
    return acc;
  }, {});
  $("#analytics").innerHTML = Object.entries(byBook).map(([book, count]) => `
    <span class="tag">${escapeHtml(book)}: ${count}</span>
  `).join("");
}

function renderInsights(data) {
  const target = $("#insight-list");
  if (!target) return;
  const scheduled = data.sermons.filter((sermon) => sermon.datePreached && sermon.status !== "Archived").sort((a, b) => a.datePreached.localeCompare(b.datePreached));
  const nextIncomplete = scheduled.find((sermon) => !readinessReview(sermon).isReady);
  const unscheduledDrafts = data.sermons.filter((sermon) => !sermon.datePreached && ["Planning", "Drafting", "Editing"].includes(sermon.status));
  const activeSeries = data.series.filter((series) => series.status === "Active" && !series.archived);
  const books = scheduled.reduce((acc, sermon) => {
    const book = parseScriptureBook(sermon.mainScripture) || "Unassigned";
    acc[book] = (acc[book] || 0) + 1;
    return acc;
  }, {});
  const topBook = Object.entries(books).sort((a, b) => b[1] - a[1])[0];
  const insights = [
    nextIncomplete
      ? ["Next prep step", `${nextIncomplete.title}: ${readinessReview(nextIncomplete).missing[0]}`, `sermons/sermon-editor.html?id=${nextIncomplete.id}`]
      : ["Preparation", "Scheduled sermons are ready by current checklist.", "calendar/index.html"],
    ["Unscheduled drafts", `${unscheduledDrafts.length} draft sermon${unscheduledDrafts.length === 1 ? "" : "s"} need dates.`, "sermons/index.html"],
    ["Active series", `${activeSeries.length} active series in progress.`, "series/index.html"],
    ["Scripture coverage", topBook ? `${topBook[0]} appears in ${topBook[1]} scheduled sermon${topBook[1] === 1 ? "" : "s"}.` : "No scheduled scripture data yet.", "calendar/index.html"]
  ];
  target.innerHTML = insights.map(([title, body, href]) => `
    <a class="insight-item" href="${href}">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
    </a>
  `).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const data = loadData();
  const profile = data.meta.profile || {};
  if ($("#dashboard-greeting")) {
    $("#dashboard-greeting").textContent = `Good morning, ${profile.pastorName || "Pastor"}.`;
  }
  if ($("#weekly-focus-text")) {
    $("#weekly-focus-text").textContent = profile.weeklyFocus || "Faithful preparation leads to powerful proclamation.";
  }
  renderStats(data);
  setPreachingLinks(data);
  renderCurrentSeries(data);
  renderReadinessStrip(data);
  renderSchedule(data);
  renderSeries(data);
  renderRecent(data);
  renderActivity(data);
  renderAnalytics(data);
  renderInsights(data);
});
