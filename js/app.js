const MEMORY = {
  summary: null,
  overall: null,
  weeks: new Map()
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  buildSeasonSelector();

  document.getElementById("seasonSelect").addEventListener("change", async (event) => {
    MEMORY.summary = null;
    MEMORY.overall = null;
    MEMORY.weeks.clear();
    await loadSeason(Number(event.target.value));
  });

  document.getElementById("weekSelect").addEventListener("change", async () => {
    const week = Number(document.getElementById("weekSelect").value);
    await loadWeek(week, true);
  });

  await loadSeason(PICKEM_CONFIG.currentSeason);
}

function buildSeasonSelector() {
  const select = document.getElementById("seasonSelect");
  const seasons = Object.keys(PICKEM_CONFIG.seasons)
    .map(Number)
    .sort((a, b) => b - a);

  select.innerHTML = "";

  seasons.forEach((season) => {
    const option = document.createElement("option");
    option.value = String(season);
    option.textContent = String(season);
    select.appendChild(option);
  });

  select.value = String(PICKEM_CONFIG.currentSeason);
}

async function loadSeason(season) {
  const cfg = PICKEM_CONFIG.seasons[season];

  if (!cfg || !cfg.api || cfg.api.includes("PASTE_")) {
    showError("The Pick Ems 2.0 API has not been configured yet.");
    return;
  }

  document.getElementById("seasonTitle").textContent =
    cfg.name || `${season} Football Pick Ems`;

  showStatus("Loading…");

  try {
    const cachedSummary = readBrowserCache(cacheKey(season, "summary"));

    if (cachedSummary) {
      assertPublicPayload(cachedSummary);
      MEMORY.summary = cachedSummary;
      renderSummaryShell(cachedSummary);
    }

    const freshSummary = await fetchApi(cfg.api, "summary");
    assertPublicPayload(freshSummary);

    MEMORY.summary = freshSummary;
    writeBrowserCache(cacheKey(season, "summary"), freshSummary);
    renderSummaryShell(freshSummary);

    const activeWeek = freshSummary.activeWeek ?? freshSummary.weeks?.[0];

    if (activeWeek != null) {
      document.getElementById("weekSelect").value = String(activeWeek);
    }

    // Active week first. Overall loads separately so it cannot block the weekly view.
    await loadWeek(activeWeek, false);

    loadOverall(season).catch((error) => {
      console.error(error);
      renderOverallError();
    });

    hideStatus();
  } catch (error) {
    console.error(error);
    showError("Could not load Pick Em data.");
  }
}

function renderSummaryShell(summary) {
  buildWeekSelector(summary);

  document.getElementById("activeWeekBadge").textContent =
    summary.activeWeek ? `Current: Week ${summary.activeWeek}` : "";

  if (PICKEM_CONFIG.display.showEndOfSeasonPot) {
    document.getElementById("endOfSeasonPot").textContent =
      formatMoney(summary.endOfSeasonPot || 0);
  } else {
    document.getElementById("endOfSeasonPot").textContent = "Hidden";
  }
}

function buildWeekSelector(summary) {
  const select = document.getElementById("weekSelect");
  const current = select.value;
  const weeks = Array.isArray(summary?.weeks) ? summary.weeks : [];

  select.innerHTML = "";

  weeks.forEach((week) => {
    const option = document.createElement("option");
    option.value = String(week);
    option.textContent = `Week ${week}`;
    select.appendChild(option);
  });

  if (weeks.includes(Number(current))) {
    select.value = current;
  } else if (summary.activeWeek != null) {
    select.value = String(summary.activeWeek);
  }
}

async function loadWeek(week, useBrowserCacheFirst) {
  if (week == null) return;

  const season = Number(document.getElementById("seasonSelect").value);
  const cfg = PICKEM_CONFIG.seasons[season];
  const key = cacheKey(season, `week-${week}`);

  if (MEMORY.weeks.has(week)) {
    renderWeek(MEMORY.weeks.get(week));
  } else if (useBrowserCacheFirst) {
    const cached = readBrowserCache(key);
    if (cached) {
      assertPublicPayload(cached);
      MEMORY.weeks.set(week, cached);
      renderWeek(cached);
    }
  }

  const fresh = await fetchApi(cfg.api, "week", { week });
  assertPublicPayload(fresh);

  MEMORY.weeks.set(week, fresh);
  writeBrowserCache(key, fresh);
  renderWeek(fresh);
}

async function loadOverall(season) {
  const cfg = PICKEM_CONFIG.seasons[season];
  const key = cacheKey(season, "overall");

  const cached = readBrowserCache(key);

  if (cached) {
    assertPublicPayload(cached);
    MEMORY.overall = cached;
    renderOverall(cached);
  }

  const fresh = await fetchApi(cfg.api, "overall");
  assertPublicPayload(fresh);

  MEMORY.overall = fresh;
  writeBrowserCache(key, fresh);
  renderOverall(fresh);
}

function renderWeek(data) {
  const week = Number(data.week);
  const standings = Array.isArray(data.standings) ? data.standings : [];
  const games = Array.isArray(data.games) ? data.games : [];
  const outcome = data.outcome || {};

  document.getElementById("summaryWeek").textContent = `Week ${week}`;
  document.getElementById("summaryPlayers").textContent = data.playerCount ?? standings.length;

  const leaders = standings.filter((p) =>
    standings[0] && p.points === standings[0].points
  );

  document.getElementById("summaryLeader").textContent =
    leaders.length === 0 ? "—" :
    leaders.length === 1 ? `${leaders[0].name} (${leaders[0].points})` :
    `${leaders.length}-way tie (${leaders[0].points})`;

  document.getElementById("weeklyTitle").textContent = `Week ${week} Standings`;
  document.getElementById("picksTitle").textContent = `Week ${week} Picks`;

  renderOutcome(outcome, data);
  renderWeeklyStandings(standings);
  renderPicks(standings, games);
}

function renderOutcome(outcome, data) {
  const badge = document.getElementById("weeklyOutcomeBadge");
  const text = document.getElementById("weeklyOutcomeText");

  badge.textContent = "";
  text.textContent = "";

  if (!outcome || !outcome.status) return;

  if (outcome.status === "pending") {
    badge.textContent = "Pending";
    text.textContent = "Weekly result is not final yet.";
    return;
  }

  if (outcome.status === "winner") {
    badge.textContent = "Perfect Winner";

    const winners = Array.isArray(outcome.perfectWinners)
      ? outcome.perfectWinners
      : [];

    if (winners.length === 1) {
      text.textContent = `${winners[0]} went perfect this week.`;
    } else if (winners.length > 1) {
      text.textContent = `${winners.join(", ")} went perfect and share the weekly win.`;
    }
  }

  if (outcome.status === "rollover") {
    badge.textContent = "Rollover";
    text.textContent = "No perfect card this week. The weekly buy-in rolls into the End of Season Pot.";
  }

  if (PICKEM_CONFIG.display.showWeeklyPot && Number.isFinite(data.weeklyPot)) {
    text.textContent += ` Weekly pot: ${formatMoney(data.weeklyPot)}.`;
  }
}

function renderWeeklyStandings(standings) {
  const body = document.getElementById("weeklyBody");
  body.innerHTML = "";

  if (!standings.length) {
    body.innerHTML =
      '<tr><td colspan="3" class="empty-cell">No picks submitted for this week.</td></tr>';
    return;
  }

  standings.forEach((player) => {
    const row = document.createElement("tr");
    row.append(
      td(player.rank, "rank-cell"),
      td(player.name, "player-cell"),
      td(`${player.points}/${player.completedGames}`)
    );
    body.appendChild(row);
  });
}

function renderPicks(standings, games) {
  const wrap = document.getElementById("picksWrap");

  if (!games.length) {
    wrap.innerHTML = '<div class="empty-block">No games configured for this week.</div>';
    return;
  }

  const table = document.createElement("table");
  table.className = "picks-table";

  const thead = document.createElement("thead");
  const header = document.createElement("tr");

  const playerTh = document.createElement("th");
  playerTh.textContent = "Player";
  playerTh.className = "sticky-col";
  header.appendChild(playerTh);

  games.forEach((game) => {
    const th = document.createElement("th");
    th.textContent = game;
    header.appendChild(th);
  });

  thead.appendChild(header);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  standings.forEach((player) => {
    const row = document.createElement("tr");

    const name = document.createElement("td");
    name.textContent = player.name;
    name.className = "player-cell sticky-col";
    row.appendChild(name);

    games.forEach((game) => {
      const pick = (player.picks || []).find((item) => item.game === game);
      const cell = document.createElement("td");
      cell.className = "pick-cell";

      if (!pick) {
        cell.textContent = "—";
        cell.classList.add("pending");
      } else {
        const team = shortTeamName(pick.pick);

        if (pick.correct === true) {
          cell.textContent = `${team} ✓`;
          cell.classList.add("correct");
        } else if (pick.correct === false) {
          cell.textContent = `${team} ✕`;
          cell.classList.add("wrong");
        } else {
          cell.textContent = team;
          cell.classList.add("pending");
        }
      }

      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  wrap.innerHTML = "";
  wrap.appendChild(table);
}

function renderOverall(data) {
  const body = document.getElementById("overallBody");
  const standings = Array.isArray(data?.standings) ? data.standings : [];

  body.innerHTML = "";

  if (!standings.length) {
    body.innerHTML =
      '<tr><td colspan="4" class="empty-cell">No season standings yet.</td></tr>';
    return;
  }

  standings.forEach((player) => {
    const row = document.createElement("tr");
    row.append(
      td(player.rank, "rank-cell"),
      td(player.name, "player-cell"),
      td(player.points),
      td(player.completedGames)
    );
    body.appendChild(row);
  });
}

function renderOverallError() {
  document.getElementById("overallBody").innerHTML =
    '<tr><td colspan="4" class="empty-cell">Could not load overall standings.</td></tr>';
}

async function fetchApi(baseUrl, action, params = {}) {
  const url = new URL(baseUrl);
  url.searchParams.set("action", action);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString(), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function assertPublicPayload(value, path = "root") {
  const forbidden = new Set([
    "phone", "phonenumber", "phone_number",
    "email", "emailaddress", "email_address",
    "timestamp", "response", "rawresponse", "formresponse",
    "responseid", "privateid", "sheetid", "spreadsheetid"
  ]);

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPublicPayload(item, `${path}[${index}]`));
    return;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      if (forbidden.has(String(key).toLowerCase())) {
        throw new Error(`Sensitive field blocked: ${path}.${key}`);
      }
      assertPublicPayload(child, `${path}.${key}`);
    });
  }
}

function cacheKey(season, part) {
  return `football-pickems:${season}:${part}`;
}

function writeBrowserCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({
      savedAt: Date.now(),
      value
    }));
  } catch (error) {
    console.warn("Browser cache unavailable:", error);
  }
}

function readBrowserCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // Show cached data instantly for up to 24 hours, then refresh from Google.
    if (!parsed.savedAt || Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.value;
  } catch {
    return null;
  }
}

function td(text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text ?? "—";
  if (className) cell.className = className;
  return cell;
}

function shortTeamName(value) {
  const parts = String(value || "").trim().split(/\s+/);
  return parts[parts.length - 1] || "—";
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function showStatus(message) {
  const banner = document.getElementById("statusBanner");
  banner.textContent = message;
  banner.className = "status-banner";
  banner.hidden = false;
}

function showError(message) {
  const banner = document.getElementById("statusBanner");
  banner.textContent = message;
  banner.className = "status-banner error";
  banner.hidden = false;
}

function hideStatus() {
  document.getElementById("statusBanner").hidden = true;
}
