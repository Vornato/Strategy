const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const OUT_DIR = path.join(__dirname, "output", "web-game", "verify-lan-shared-start");
const HOST_URL = "http://127.0.0.1:4173";
const PORT = 4173;

function scoreLanAddress(address) {
  if (/^192\.168\./.test(address)) return 0;
  if (/^10\./.test(address)) return 1;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) return 2;
  if (/^25\./.test(address)) return 3;
  if (/^169\.254\./.test(address)) return 8;
  return 4;
}

function getExpectedLanBase() {
  const candidates = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (!entries) continue;
    for (const entry of entries) {
      if (!entry || entry.internal || entry.family !== "IPv4") continue;
      candidates.push({
        name,
        address: entry.address,
        score: scoreLanAddress(entry.address),
      });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name) || a.address.localeCompare(b.address));
  return `http://${candidates[0].address}:${PORT}`;
}

async function getState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function waitForState(page, predicate, timeoutMs = 8000) {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await getState(page);
    if (predicate(lastState)) return lastState;
    await page.waitForTimeout(120);
  }
  throw new Error(`Timed out waiting for state. Last state: ${JSON.stringify(lastState)}`);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const guestContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await hostPage.goto(HOST_URL, { waitUntil: "domcontentloaded" });
  await hostPage.click("#host-lan-btn");
  await hostPage.waitForFunction(() => {
    const linkInput = document.getElementById("lan-link-input");
    return linkInput && linkInput.value.includes("?room=");
  });

  const shareLink = await hostPage.locator("#lan-link-input").inputValue();
  const roomCode = await hostPage.locator("#lan-code-input").inputValue();
  const expectedLanBase = getExpectedLanBase();
  if (!shareLink) throw new Error("Host did not receive a generated LAN share link.");
  if (expectedLanBase && !shareLink.startsWith(expectedLanBase)) {
    throw new Error(`Expected share link to use ${expectedLanBase}, received ${shareLink}`);
  }

  const hostLobbyState = await getState(hostPage);

  await guestPage.goto(shareLink, { waitUntil: "domcontentloaded" });
  await guestPage.waitForFunction(() => {
    const startButton = document.getElementById("start-btn");
    return startButton && /Start Shared LAN/.test(startButton.textContent || "");
  });
  const guestLobbyState = await getState(guestPage);

  await guestPage.click("#start-btn");

  const hostPlayingState = await waitForState(
    hostPage,
    (state) => state.mode === "playing" && state.matchType === "lan" && state.lan && state.lan.started,
  );
  const guestPlayingState = await waitForState(
    guestPage,
    (state) => state.mode === "playing" && state.matchType === "lan" && state.lan && state.lan.started,
  );

  await guestPage.waitForFunction(() => {
    const status = document.getElementById("lan-status");
    return status && /Connected as Player 2|live battle/i.test(status.textContent || "");
  });
  await hostPage.waitForTimeout(300);
  await guestPage.waitForTimeout(600);

  const hostFinalState = await getState(hostPage);
  const guestFinalState = await getState(guestPage);

  const hostStatus = await hostPage.locator("#lan-status").textContent();
  const guestStatus = await guestPage.locator("#lan-status").textContent();
  const hostStartLabel = await hostPage.locator("#start-btn").textContent();
  const guestStartLabel = await guestPage.locator("#start-btn").textContent();

  await hostPage.screenshot({ path: path.join(OUT_DIR, "host-room-live.png"), fullPage: true });
  await guestPage.screenshot({ path: path.join(OUT_DIR, "guest-room-live.png"), fullPage: true });

  const summary = {
    expectedLanBase,
    shareLink,
    roomCode,
    hostLobbyLan: hostLobbyState.lan,
    guestLobbyLan: guestLobbyState.lan,
    hostPlaying: {
      mode: hostFinalState.mode,
      matchType: hostFinalState.matchType,
      lan: hostFinalState.lan,
      players: hostFinalState.players.map((player) => ({
        owner: player.owner,
        coins: player.resources.coins,
      })),
    },
    guestPlaying: {
      mode: guestFinalState.mode,
      matchType: guestFinalState.matchType,
      lan: guestFinalState.lan,
      players: guestFinalState.players.map((player) => ({
        owner: player.owner,
        coins: player.resources.coins,
      })),
    },
    hostStatus,
    guestStatus,
    hostStartLabel,
    guestStartLabel,
  };

  await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
