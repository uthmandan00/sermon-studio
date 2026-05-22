import { updateData } from "./storage.js";
import { $, escapeHtml, parseScriptureBook } from "./utils.js";

export function getSearchState() {
  return {
    q: $("#search-query")?.value.trim().toLowerCase() || "",
    status: $("#filter-status")?.value || "",
    seriesId: $("#filter-series")?.value || "",
    speaker: $("#filter-speaker")?.value || "",
    book: $("#filter-book")?.value || "",
    sort: $("#sort-sermons")?.value || "updated"
  };
}

export function filterSermons(data, state) {
  const searchable = (sermon) => [
    sermon.title,
    sermon.subtitle,
    sermon.mainScripture,
    sermon.supportingScriptures,
    sermon.bigIdea,
    sermon.illustrations,
    sermon.applications,
    sermon.personalNotes,
    sermon.researchNotes,
    sermon.tags?.join(" "),
    sermon.topics?.join(" ")
  ].join(" ").toLowerCase();

  return data.sermons
    .filter((sermon) => !state.q || searchable(sermon).includes(state.q))
    .filter((sermon) => !state.status || sermon.status === state.status)
    .filter((sermon) => !state.seriesId || sermon.seriesId === state.seriesId)
    .filter((sermon) => !state.speaker || sermon.speaker === state.speaker)
    .filter((sermon) => !state.book || parseScriptureBook(sermon.mainScripture) === state.book)
    .sort((a, b) => {
      if (state.sort === "title") return a.title.localeCompare(b.title);
      if (state.sort === "date") return (b.datePreached || "").localeCompare(a.datePreached || "");
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });
}

export function renderFilterOptions(data) {
  const series = $("#filter-series");
  const speaker = $("#filter-speaker");
  const book = $("#filter-book");
  if (series) {
    series.innerHTML = `<option value="">All series</option>${data.series.map((item) => `<option value="${item.id}">${escapeHtml(item.title)}</option>`).join("")}`;
  }
  if (speaker) {
    const speakers = [...new Set(data.sermons.map((item) => item.speaker).filter(Boolean))];
    speaker.innerHTML = `<option value="">All speakers</option>${speakers.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}`;
  }
  if (book) {
    const books = [...new Set(data.sermons.map((item) => parseScriptureBook(item.mainScripture)).filter(Boolean))].sort();
    book.innerHTML = `<option value="">All books</option>${books.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}`;
  }
}

export function saveRecentSearch(query) {
  if (!query) return;
  updateData((data) => {
    data.meta.recentSearches = [query, ...(data.meta.recentSearches || []).filter((item) => item !== query)].slice(0, 8);
    return data;
  });
}

export function renderRecentSearches(data) {
  const target = $("#recent-searches");
  if (!target) return;
  target.innerHTML = (data.meta.recentSearches || []).map((term) => `
    <button class="tag recent-search" type="button">${escapeHtml(term)}</button>
  `).join("");
  target.querySelectorAll(".recent-search").forEach((button) => {
    button.addEventListener("click", () => {
      $("#search-query").value = button.textContent;
      $("#search-query").dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
}

export function renderSearchSummary(count) {
  const target = $("#search-summary");
  if (target) target.textContent = `${count} sermon${count === 1 ? "" : "s"} found`;
}
