(function () {
  const DATA_URL = "/data/posts.json";
  const MUSIC_LIBRARY_URL = "/data/music-library.json";
  const RECENT_PAGE_SIZE = 4;
  const MUSIC_SAMPLE_SIZE = 10;
  const DAILY_WALLPAPER_URLS = Array.isArray(window.__SITE_DAILY_WALLPAPERS__) && window.__SITE_DAILY_WALLPAPERS__.length
    ? window.__SITE_DAILY_WALLPAPERS__.slice()
    : ["/assets/images/background/wallpaper.jpg"];
  const LEGACY_WALLPAPER_PATTERN = /\/assets\/images\/wallpaper(?:_night)?\.jpg$/i;

  function normalizeAssetUrl(value) {
    return String(value || "").trim();
  }

  function isDailyWallpaperReference(value) {
    const normalized = normalizeAssetUrl(value);
    return Boolean(normalized) && (
      LEGACY_WALLPAPER_PATTERN.test(normalized) ||
      DAILY_WALLPAPER_URLS.includes(normalized)
    );
  }

  function getDailyWallpaperIndex(date = new Date()) {
    const startOfYear = Date.UTC(date.getFullYear(), 0, 1);
    const startOfToday = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const dayOffset = Math.floor((startOfToday - startOfYear) / 86400000);
    return dayOffset % DAILY_WALLPAPER_URLS.length;
  }

  function getDailyWallpaperUrl(date = new Date()) {
    return DAILY_WALLPAPER_URLS[getDailyWallpaperIndex(date)] || DAILY_WALLPAPER_URLS[0] || "";
  }

  function resolveWallpaperByDay(value) {
    const normalized = normalizeAssetUrl(value);
    if (!normalized) {
      return getDailyWallpaperUrl();
    }

    if (isDailyWallpaperReference(normalized)) {
      return getDailyWallpaperUrl();
    }

    return normalized;
  }

  function applyDailyWallpaper() {
    const wallpaperUrl = getDailyWallpaperUrl();
    if (!wallpaperUrl) {
      return;
    }

    document.documentElement.style.setProperty("--site-background-image", `url("${wallpaperUrl}")`);
    document.documentElement.style.setProperty("--music-cover-image", `url("${wallpaperUrl}")`);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseDate(value) {
    if (!value) {
      return 0;
    }
    const time = Date.parse(value);
    return Number.isNaN(time) ? 0 : time;
  }

  function getEntrySortDate(entry) {
    return parseDate(entry && (entry.updatedAt || entry.publishedAt));
  }

  function sortEntriesByUpdatedDate(entries) {
    return entries.slice().sort((left, right) => {
      if (Boolean(left && left.pinned) !== Boolean(right && right.pinned)) {
        return left && left.pinned ? -1 : 1;
      }

      const rightDate = getEntrySortDate(right);
      const leftDate = getEntrySortDate(left);
      if (rightDate !== leftDate) {
        return rightDate - leftDate;
      }

      return String(left && left.title || "").localeCompare(String(right && right.title || ""));
    });
  }

  function createMetaItems(entry) {
    const items = [];

    function createMetaItem(type, value, suffix) {
      const icons = {
        published: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3"></path><path d="M17 3v3"></path><path d="M4 9h16"></path><rect x="4" y="5" width="16" height="15" rx="2"></rect></svg>',
        updated: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 3"></path><circle cx="12" cy="12" r="9"></circle></svg>',
        words: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4Z"></path><path d="m12 8 4 4"></path><path d="M14 6l2-2 4 4-2 2"></path></svg>',
        reading: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10"></path><path d="M9 4v4l3 3 3-3V4"></path><path d="M17 20H7"></path><path d="M15 20v-4l-3-3-3 3v4"></path></svg>'
      };

      return [
        `<span class="entry-meta-item entry-meta-item-${type}">`,
        `  <span class="entry-meta-icon">${icons[type] || ""}</span>`,
        `  <span class="entry-meta-value">${escapeHtml(value)}${suffix ? ` ${escapeHtml(suffix)}` : ""}</span>`,
        "</span>"
      ].join("");
    }

    if (entry.publishedAt) {
      items.push(createMetaItem("published", entry.publishedAt, ""));
    }
    if (entry.updatedAt && entry.updatedAt !== entry.publishedAt) {
      items.push(createMetaItem("updated", `Updated ${entry.updatedAt}`, ""));
    }
    if (entry.wordCount) {
      items.push(createMetaItem("words", entry.wordCount, "words"));
    }
    if (entry.readingTime) {
      items.push(createMetaItem("reading", entry.readingTime, ""));
    }

    return items.join("");
  }

  function createTags(tags) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return "";
    }

    return [
      '<div class="entry-tags">',
      ...tags.map((tag) => `<span class="entry-chip">${escapeHtml(tag)}</span>`),
      "</div>"
    ].join("");
  }

  function createPostCard(entry, index) {
    const summary = entry.summary || entry.description || "";
    const styleParts = [`--card-index:${index};`];
    const resolvedBackground = resolveWallpaperByDay(entry.background);
    const resolvedCover = resolveWallpaperByDay(entry.cover || entry.background);
    if (resolvedBackground) {
      styleParts.push(`--card-background-image: url('${escapeHtml(resolvedBackground)}');`);
    }
    if (resolvedCover) {
      styleParts.push(`--card-cover-image: url('${escapeHtml(resolvedCover)}');`);
    }
    const cardStyle = styleParts.length ? ` style="${styleParts.join("")}"` : "";
    const metaItems = createMetaItems(entry);
    const tags = createTags(entry.tags);
    const route = entry.external ? (entry.route || "#") : `/post/?slug=${encodeURIComponent(entry.slug || "")}`;
    const safeRoute = escapeHtml(route);
    const routeAttrs = entry.external ? ' target="_blank" rel="noreferrer"' : "";
    const reverseClass = index % 2 === 1 ? " is-reversed" : "";

    return [
      `<article class="entry-card${reverseClass}"${cardStyle}>`,
      `  <a class="entry-card-link" href="${safeRoute}"${routeAttrs} aria-label="${escapeHtml(entry.title || "")}"></a>`,
      '  <div class="entry-shell">',
      '    <div class="entry-cover"></div>',
      '    <div class="entry-panel">',
      '      <div class="entry-content">',
      '        <div class="entry-header">',
      '          <div class="entry-header-top">',
      '            <div class="entry-labels">',
      entry.pinned ? '            <span class="entry-badge">Pinned</span>' : "",
      `            <span class="entry-tag">${escapeHtml(entry.tag || "")}</span>`,
      '            </div>',
      '          </div>',
      metaItems ? `          <div class="entry-meta">${metaItems}</div>` : "",
      '        </div>',
      `        <h3>${escapeHtml(entry.title || "")}</h3>`,
      `        <p class="entry-summary">${escapeHtml(summary)}</p>`,
      tags ? `        <div class="entry-footer">${tags}</div>` : "",
      '      </div>',
      '    </div>',
      '  </div>',
      '</article>'
    ].join("\n");
  }

  function setPlayButtonIcon(button, isPlaying) {
    if (!button) {
      return;
    }

    button.innerHTML = isPlaying
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" data-icon="pause"><path d="M9 5v14"></path><path d="M15 5v14"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" data-icon="play"><path d="m8 5 11 7-11 7V5Z"></path></svg>';
    button.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    button.setAttribute("title", isPlaying ? "Pause" : "Play");
  }

  function setPlaylistExpanded(card, toggle, isExpanded) {
    if (card) {
      card.classList.toggle("is-expanded", Boolean(isExpanded));
    }
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(Boolean(isExpanded)));
      toggle.setAttribute("aria-label", isExpanded ? "Hide playlist" : "Show playlist");
      toggle.setAttribute("title", isExpanded ? "Hide playlist" : "Show playlist");
    }
  }

  function bindHomepagePlayer(site, musicLibrary) {
    const musicNodes = {
      card: document.getElementById("music-card"),
      cover: document.getElementById("music-cover"),
      title: document.getElementById("music-title"),
      subtitle: document.getElementById("music-subtitle"),
      position: document.getElementById("music-position"),
      progress: document.getElementById("music-progress-bar"),
      playToggle: document.getElementById("music-play-toggle"),
      buttonToggle: document.getElementById("music-toggle"),
      prev: document.getElementById("music-prev"),
      next: document.getElementById("music-next"),
      loop: document.getElementById("music-loop"),
      listToggle: document.getElementById("music-list-toggle"),
      playlistInner: document.getElementById("music-playlist-inner")
    };

    if (!musicNodes.card) {
      return function () {};
    }

    const player = window.SiteApp.musicPlayer;
    const normalizedLibrary = Array.isArray(musicLibrary)
      ? musicLibrary
      : (musicLibrary && Array.isArray(musicLibrary.tracks) ? musicLibrary.tracks : []);
    player.boot({
      fallbackCover: site.musicCover || site.profileAvatar || "",
      tracks: window.SiteApp.musicUtils.buildRandomMusicPlaylist(
        normalizedLibrary,
        Number(site.musicSampleSize) || MUSIC_SAMPLE_SIZE
      )
    });

    const render = (snapshot) => {
      if (musicNodes.title) {
        musicNodes.title.textContent = snapshot.currentTrack ? snapshot.currentTrack.title : "No track loaded";
      }
      if (musicNodes.subtitle) {
        musicNodes.subtitle.textContent = snapshot.currentTrack
          ? (snapshot.currentTrack.subtitle || "Local MP3")
          : "Open a playlist to start music.";
      }
      if (musicNodes.position) {
        musicNodes.position.textContent = snapshot.hasTracks
          ? `${snapshot.currentIndex + 1} / ${snapshot.tracks.length}`
          : "0 / 0";
      }
      if (musicNodes.progress) {
        const percent = snapshot.duration
          ? Math.min(100, (snapshot.currentTime / snapshot.duration) * 100)
          : 0;
        musicNodes.progress.style.width = `${percent}%`;
      }
      if (musicNodes.cover) {
        document.documentElement.style.setProperty(
          "--music-cover-image",
          snapshot.coverUrl ? `url("${snapshot.coverUrl}")` : "none"
        );
        musicNodes.cover.classList.toggle("playing", snapshot.isPlaying);
      }
      if (musicNodes.playToggle) {
        musicNodes.playToggle.disabled = !snapshot.hasTracks;
        musicNodes.playToggle.setAttribute("aria-label", snapshot.isPlaying ? "Pause music" : "Play music");
        musicNodes.playToggle.setAttribute("title", snapshot.isPlaying ? "Pause music" : "Play music");
      }
      if (musicNodes.buttonToggle) {
        musicNodes.buttonToggle.disabled = !snapshot.hasTracks;
        setPlayButtonIcon(musicNodes.buttonToggle, snapshot.isPlaying);
      }
      if (musicNodes.prev) {
        musicNodes.prev.disabled = !snapshot.hasTracks;
      }
      if (musicNodes.next) {
        musicNodes.next.disabled = !snapshot.hasTracks;
      }
      if (musicNodes.loop) {
        musicNodes.loop.disabled = !snapshot.hasTracks;
        musicNodes.loop.classList.toggle("is-active", snapshot.hasTracks && snapshot.loopCurrent);
      }
      if (musicNodes.listToggle) {
        musicNodes.listToggle.disabled = !snapshot.hasTracks;
      }
      setPlaylistExpanded(musicNodes.card, musicNodes.listToggle, snapshot.isExpanded);

      if (musicNodes.playlistInner) {
        if (!snapshot.hasTracks) {
          musicNodes.playlistInner.innerHTML = '<p class="music-track-subtitle">No tracks configured.</p>';
        } else {
          musicNodes.playlistInner.innerHTML = snapshot.tracks
            .map((track, index) => [
              `<button class="music-track${index === snapshot.currentIndex ? " is-active" : ""}" type="button" data-track-index="${index}">`,
              `  <span class="music-track-title">${escapeHtml(track.title)}</span>`,
              `  <span class="music-track-subtitle">${escapeHtml(track.subtitle || "Local MP3")}</span>`,
              "</button>"
            ].join("\n"))
            .join("\n");
        }
      }
    };

    const unsubscribe = player.subscribe(render);
    const handleTogglePlayback = () => player.togglePlayback();
    const handlePrev = () => player.playPrevious();
    const handleNext = () => player.playNext();
    const handleLoop = () => player.toggleLoopCurrent();
    const handleListToggle = () => {
      const snapshot = player.getSnapshot();
      player.setExpanded(!snapshot.isExpanded);
    };
    const handlePlaylistClick = (event) => {
      const button = event.target.closest("[data-track-index]");
      if (!button) {
        return;
      }
      const index = Number(button.getAttribute("data-track-index"));
      if (Number.isInteger(index)) {
        player.playTrack(index);
      }
    };

    if (musicNodes.playToggle) {
      musicNodes.playToggle.addEventListener("click", handleTogglePlayback);
    }
    if (musicNodes.buttonToggle) {
      musicNodes.buttonToggle.addEventListener("click", handleTogglePlayback);
    }
    if (musicNodes.prev) {
      musicNodes.prev.addEventListener("click", handlePrev);
    }
    if (musicNodes.next) {
      musicNodes.next.addEventListener("click", handleNext);
    }
    if (musicNodes.loop) {
      musicNodes.loop.addEventListener("click", handleLoop);
    }
    if (musicNodes.listToggle) {
      musicNodes.listToggle.addEventListener("click", handleListToggle);
    }
    if (musicNodes.playlistInner) {
      musicNodes.playlistInner.addEventListener("click", handlePlaylistClick);
    }

    return function () {
      unsubscribe();
      if (musicNodes.playToggle) {
        musicNodes.playToggle.removeEventListener("click", handleTogglePlayback);
      }
      if (musicNodes.buttonToggle) {
        musicNodes.buttonToggle.removeEventListener("click", handleTogglePlayback);
      }
      if (musicNodes.prev) {
        musicNodes.prev.removeEventListener("click", handlePrev);
      }
      if (musicNodes.next) {
        musicNodes.next.removeEventListener("click", handleNext);
      }
      if (musicNodes.loop) {
        musicNodes.loop.removeEventListener("click", handleLoop);
      }
      if (musicNodes.listToggle) {
        musicNodes.listToggle.removeEventListener("click", handleListToggle);
      }
      if (musicNodes.playlistInner) {
        musicNodes.playlistInner.removeEventListener("click", handlePlaylistClick);
      }
    };
  }

  async function fetchViewCounts(site, posts) {
    const baseUrl = String(site.viewsApiBaseUrl || site.viewsApi || "").trim();
    if (!baseUrl) {
      return {};
    }

    const slugs = Object.values(posts)
      .filter((entry) => entry && entry.slug && !entry.external)
      .map((entry) => entry.slug)
      .filter((slug, index, list) => list.indexOf(slug) === index);
    if (!slugs.length) {
      return {};
    }

    const endpoint = /\/views\/?$/i.test(baseUrl)
      ? new URL(baseUrl)
      : new URL("views", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    endpoint.searchParams.set("slugs", slugs.join(","));

    try {
      const response = await fetch(endpoint.toString(), { cache: "no-store" });
      if (!response.ok) {
        return {};
      }
      const data = await response.json();
      return data && data.counts && typeof data.counts === "object" ? data.counts : {};
    } catch (error) {
      return {};
    }
  }

  function handleRouting() {
    let hash = window.location.hash.replace("#", "");
    if (!hash || hash === "top") {
      hash = "recent";
    }

    ["recent", "writeup", "tools", "blog", "malware"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.classList.toggle("is-active", id === hash);
      }
    });

    document.querySelectorAll(".profile-link").forEach((link) => {
      const href = link.getAttribute("href") || "";
      const linkHash = href.replace("#", "");
      const isActive = linkHash === hash || (hash === "recent" && linkHash === "top");
      link.classList.toggle("is-active", isActive);
    });
  }

  function bindRailTerminal(site) {
    const terminal = document.querySelector(".section-rail-terminal");
    const form = document.getElementById("terminal-form");
    const input = document.getElementById("terminal-input");
    const mirror = document.getElementById("terminal-mirror");
    const output = document.getElementById("terminal-output");
    const prompt = form ? form.querySelector(".terminal-prompt") : null;
    if (!terminal || !form || !input || !mirror || !output || !prompt) {
      return function () {};
    }

    const aliases = ["SonVH"];
    const owner = String(site && site.owner || "").trim();
    if (owner && !aliases.some((value) => value.toLowerCase() === owner.toLowerCase())) {
      aliases.push(owner);
    }
    const createSvgDataUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    const decodeTerminalText = (token) => {
      const bytes = Uint8Array.from(
        atob(token.split("").reverse().join("")),
        (char) => char.charCodeAt(0)
      );
      const scrambled = new TextDecoder().decode(bytes);
      return Array.from(scrambled, (char) => String.fromCharCode(char.charCodeAt(0) ^ 11)).join("");
    };
    const terminalText = {
      cmd36: decodeTerminalText("=0DO"),
      cmdHehe: decodeTerminalText("==gbj52Y"),
      cmdMmb: decodeTerminalText("pZmZ"),
      cmdVc: decodeTerminalText("=gWf"),
      cmdDm: decodeTerminalText("=Y2b"),
      help: decodeTerminalText("==gZklXbr8mb553fl5Wfvp2KiZmakNGf"),
      callme: decodeTerminalText("=sibmtyZnpGS"),
      msg36: decodeTerminalText("0MGYrk3P9tyYoJ2Y/tiZ"),
      su: decodeTerminalText("==gf4tCZ/tibsp2erUGfktSe+Rmcr4GYqZ2KngGar4He"),
      hehe: decodeTerminalText("iISMr42YltCaotibj52Y"),
      mmb: decodeTerminalText("=Y2KuZ2KsVmaptSZqx2Kk5Wa"),
      vcDm: decodeTerminalText("==ANrO8Ki97wj93KvVmamZGZotivDz2KIub4aS8KCub4jh2Kyl6waS8Kkt6w9tiZ"),
      unknown: decodeTerminalText("==QJps3ZuNWKrIXeftSJvVmamZGZotSZ8RWZgVmX"),
      bof: decodeTerminalText("=IiIxsib552Yrwman12KkV2K/5Xar0EZJtiboJWZ"),
      fmt: decodeTerminalText("l8mbgpmbntCblJ2Y/RWZr8nfptyJv52f/R2e4tCblJWe/h3K/pmZ5RWb"),
      path: decodeTerminalText("=Uic593KuhmYltyJv5mYl52brcma4lnb9pWe/tyY/p2e"),
      xss: decodeTerminalText("=UCeu1nY9lnf4tibsp2er42Y/tSJv5Weu93Zi12K4h3c"),
      sqli: decodeTerminalText("l4HZytSek12K7ZmfvtCZltSJv52fo52fu92KvpGZnJna7tiYnpHe")
    };
    const whoamiValue = `${terminalText.callme}${aliases.join("/")}`;
    const flagAssets = {
      vn: createSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><rect width="64" height="48" rx="6" fill="#da251d"/><path d="m32 10.5 4.2 12.6h13.2l-10.7 7.8 4.1 12.6L32 35.7l-10.8 7.8 4.1-12.6-10.7-7.8H27.8Z" fill="#ffde00"/></svg>'),
      sg: createSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><rect width="64" height="24" rx="6" fill="#ef3340"/><rect y="24" width="64" height="24" rx="6" fill="#ffffff"/><path d="M17.8 10.2a9.3 9.3 0 1 0 0 17.6 10 10 0 1 1 0-17.6Z" fill="#ffffff"/><g fill="#ffffff"><circle cx="25.5" cy="13.6" r="1.4"/><circle cx="29.4" cy="17.1" r="1.4"/><circle cx="27.9" cy="22" r="1.4"/><circle cx="23.1" cy="22" r="1.4"/><circle cx="21.6" cy="17.1" r="1.4"/></g></svg>'),
      cn: createSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><rect width="64" height="48" rx="6" fill="#de2910"/><path d="m14 9 2.3 6.8h7.2l-5.8 4.2 2.2 6.8-5.9-4.3-5.8 4.3 2.2-6.8-5.8-4.2h7.2Z" fill="#ffde00"/><g fill="#ffde00"><circle cx="28.5" cy="9.5" r="2.1"/><circle cx="34" cy="15.2" r="2.1"/><circle cx="33.2" cy="23.4" r="2.1"/><circle cx="26.6" cy="28.2" r="2.1"/></g></svg>'),
      kr: createSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><rect width="64" height="48" rx="6" fill="#ffffff"/><g transform="translate(32 24)"><path d="M0-8a8 8 0 0 1 0 16 8 8 0 0 1 0-16Z" fill="#cd2e3a"/><path d="M0 8a8 8 0 0 1 0-16 4 4 0 0 1 0 8 4 4 0 0 0 0 8Z" fill="#0047a0"/></g><g fill="#111111"><rect x="10" y="11" width="9" height="2" rx="1" transform="rotate(-28 14.5 12)"/><rect x="10" y="15" width="9" height="2" rx="1" transform="rotate(-28 14.5 16)"/><rect x="10" y="19" width="9" height="2" rx="1" transform="rotate(-28 14.5 20)"/><rect x="45" y="27" width="9" height="2" rx="1" transform="rotate(-28 49.5 28)"/><rect x="45" y="31" width="9" height="2" rx="1" transform="rotate(-28 49.5 32)"/><rect x="45" y="35" width="9" height="2" rx="1" transform="rotate(-28 49.5 36)"/><rect x="45" y="11" width="9" height="2" rx="1" transform="rotate(28 49.5 12)"/><rect x="45" y="15" width="9" height="2" rx="1" transform="rotate(28 49.5 16)"/><rect x="10" y="27" width="9" height="2" rx="1" transform="rotate(28 14.5 28)"/><rect x="10" y="35" width="9" height="2" rx="1" transform="rotate(28 14.5 36)"/></g></svg>')
    };
    const promptCycle = [">", "#", "$"];
    const spamThreshold = 8;
    let resetTimer = 0;
    let promptRollTimer = 0;
    let promptShuffleTimer = 0;
    let promptSettleTimer = 0;
    let commandCount = 0;
    let shouldRefocus = false;

    const commandMap = {
      help() {
        return {
          mode: "text",
          value: terminalText.help
        };
      },
      whoami() {
        return {
          mode: "text",
          value: whoamiValue,
          highlight: true
        };
      },
      from() {
        return {
          mode: "logos",
          items: [
            { src: "/assets/images/vnpt.jpg", alt: "VNPT" },
            { src: "/assets/images/kcsc.jpg", alt: "KCSC" }
          ]
        };
      },
      adventured() {
        return {
          mode: "flags",
          items: [
            { src: flagAssets.vn, alt: "Vietnam" },
            { src: flagAssets.sg, alt: "Singapore" },
            { src: flagAssets.cn, alt: "China" },
            { src: flagAssets.kr, alt: "Korea" }
          ]
        };
      },
      "36"() {
        return {
          mode: "text",
          value: terminalText.msg36
        };
      },
      su() {
        return {
          mode: "text",
          value: terminalText.su
        };
      },
      hehe() {
        return {
          mode: "text",
          value: terminalText.hehe
        };
      },
      mmb() {
        return {
          mode: "text",
          value: terminalText.mmb
        };
      },
      clear() {
        return {
          mode: "clear"
        };
      }
    };
    const easterEggMatchers = [
      {
        test(value) {
          return /^A{8,}$/i.test(value);
        },
        value: terminalText.bof
      },
      {
        test(value) {
          return /(%x){2,}|%p|%n/i.test(value);
        },
        value: terminalText.fmt
      },
      {
        test(value) {
          return /\.\.\//.test(value) || /\.\.\\/.test(value);
        },
        value: terminalText.path
      },
      {
        test(value) {
          return /<script|onerror=|alert\s*\(/i.test(value);
        },
        value: terminalText.xss
      },
      {
        test(value) {
          return /('|")?\s*or\s+1=1|union\s+select|select\*from|--/i.test(value);
        },
        value: terminalText.sqli
      }
    ];

    const resetPrompt = () => {
      window.clearTimeout(resetTimer);
      form.classList.remove("is-showing-result", "is-error");
      output.className = "terminal-output";
      output.textContent = "";
      input.value = "";
      mirror.textContent = "";
      if (shouldRefocus && document.visibilityState === "visible") {
        shouldRefocus = false;
        window.requestAnimationFrame(() => {
          input.focus({ preventScroll: true });
        });
      }
    };
    const syncMirror = () => {
      mirror.textContent = input.value;
    };
    const rollPrompt = () => {
      window.clearInterval(promptShuffleTimer);
      window.clearTimeout(promptSettleTimer);

      let shuffleIndex = 0;
      promptShuffleTimer = window.setInterval(() => {
        prompt.textContent = promptCycle[shuffleIndex % promptCycle.length];
        shuffleIndex += 1;
      }, 90);

      promptSettleTimer = window.setTimeout(() => {
        window.clearInterval(promptShuffleTimer);
        prompt.textContent = promptCycle[Math.floor(Math.random() * promptCycle.length)];
      }, 1000);
    };

    const scheduleReset = (delay) => {
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        resetPrompt();
      }, delay);
    };

    const showResult = (payload, isError) => {
      output.className = "terminal-output";
      output.innerHTML = "";

      if (payload.highlight) {
        output.classList.add("is-bright");
      }

      if (payload.mode === "logos") {
        output.classList.add("is-list");
        payload.items.forEach((item) => {
          const image = document.createElement("img");
          image.className = "terminal-logo";
          image.src = item.src;
          image.alt = item.alt;
          output.appendChild(image);
        });
      } else if (payload.mode === "flags") {
        output.classList.add("is-list");
        payload.items.forEach((item) => {
          const flag = document.createElement("img");
          flag.className = "terminal-flag";
          flag.src = item.src;
          flag.alt = item.alt;
          flag.title = item.alt;
          output.appendChild(flag);
        });
      } else {
        output.textContent = payload.value || "";
      }

      form.classList.toggle("is-error", Boolean(isError));
      form.classList.add("is-showing-result");
      input.blur();
      scheduleReset(payload.mode === "logos" || payload.mode === "flags" ? 2600 : 2200);
    };

    const executeCommand = (rawValue) => {
      const commandLine = String(rawValue || "").trim();
      if (!commandLine) {
        return;
      }
      commandCount += 1;
      if (commandCount > spamThreshold) {
        showResult({
          mode: "text",
          value: terminalText.vcDm
        }, false);
        return;
      }

      const command = commandLine.split(/\s+/)[0].toLowerCase();
      const compactCommand = commandLine.replace(/\s+/g, "").toLowerCase();
      let normalizedCommand = command === "adventure" ? "adventured" : command;
      if (!commandMap[normalizedCommand]) {
        const fuzzyCommands = [terminalText.cmd36, terminalText.cmdHehe, terminalText.cmdMmb];
        const matchedFuzzyCommand = fuzzyCommands.find((token) => compactCommand.includes(token));
        if (matchedFuzzyCommand) {
          normalizedCommand = matchedFuzzyCommand;
        }
      }
      const handler = commandMap[normalizedCommand];
      if (!handler) {
        if (compactCommand.includes(terminalText.cmdVc) || compactCommand.includes(terminalText.cmdDm)) {
          showResult({
            mode: "text",
            value: terminalText.vcDm
          }, false);
          return;
        }
        const matchedEasterEgg = easterEggMatchers.find((entry) => entry.test(commandLine));
        if (matchedEasterEgg) {
          showResult({
            mode: "text",
            value: matchedEasterEgg.value
          }, false);
          return;
        }
        showResult({
          mode: "text",
          value: terminalText.unknown
        }, true);
        return;
      }

      const payload = handler(commandLine);
      if (payload.mode === "clear") {
        resetPrompt();
        return;
      }
      showResult(payload, false);
    };

    const handleSubmit = (event) => {
      event.preventDefault();
      const value = input.value;
      shouldRefocus = true;
      executeCommand(value);
      input.value = "";
      syncMirror();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        input.value = "";
        syncMirror();
        resetPrompt();
      }
    };
    const handleInput = () => {
      syncMirror();
    };
    const handleTerminalClick = (event) => {
      if (event.target !== input) {
        if (form.classList.contains("is-showing-result")) {
          resetPrompt();
        }
        shouldRefocus = true;
        input.focus();
      }
    };
    const handleDocumentPointerDown = (event) => {
      if (!terminal.contains(event.target)) {
        shouldRefocus = false;
      }
    };
    const handleArticleLinkClick = (event) => {
      const link = event.target.closest(".entry-card-link");
      if (!link) {
        return;
      }
      commandCount = 0;
      shouldRefocus = false;
    };

    form.addEventListener("submit", handleSubmit);
    input.addEventListener("keydown", handleKeyDown);
    input.addEventListener("input", handleInput);
    terminal.addEventListener("click", handleTerminalClick);
    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    document.addEventListener("click", handleArticleLinkClick, true);
    rollPrompt();
    promptRollTimer = window.setInterval(rollPrompt, 2000);

    return function () {
      commandCount = 0;
      shouldRefocus = false;
      resetPrompt();
      form.removeEventListener("submit", handleSubmit);
      input.removeEventListener("keydown", handleKeyDown);
      input.removeEventListener("input", handleInput);
      terminal.removeEventListener("click", handleTerminalClick);
      document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
      document.removeEventListener("click", handleArticleLinkClick, true);
      window.clearInterval(promptRollTimer);
      window.clearInterval(promptShuffleTimer);
      window.clearTimeout(promptSettleTimer);
      prompt.textContent = ">";
    };
  }

  window.SiteApp.registerPage("home", async function () {
    const recentList = document.getElementById("recent-list");
    if (!recentList) {
      return null;
    }

    const prefersReducedMotion = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

    handleRouting();

    const [data, musicLibrary] = await Promise.all([
      window.SiteApp.getJson(DATA_URL),
      window.SiteApp.getJson(MUSIC_LIBRARY_URL).catch(() => [])
    ]);

    const site = data.site || {};
    const posts = data.posts || {};
    const sections = data.sections || {};
    const viewCounts = await fetchViewCounts(site, posts);

    Object.values(posts).forEach((entry) => {
      if (entry && entry.slug && Object.prototype.hasOwnProperty.call(viewCounts, entry.slug)) {
        entry.viewCount = Number(viewCounts[entry.slug]) || 0;
      }
    });

    applyDailyWallpaper();

    if (site.homeBackground) {
      document.documentElement.style.setProperty(
        "--site-background-image",
        `url("${resolveWallpaperByDay(site.homeBackground)}")`
      );
    }
    if (site.profileAvatar) {
      document.documentElement.style.setProperty("--profile-avatar-image", `url("${site.profileAvatar}")`);
    }
    if (site.musicCover) {
      document.documentElement.style.setProperty(
        "--music-cover-image",
        `url("${resolveWallpaperByDay(site.musicCover)}")`
      );
    }

    const owner = site.owner || "Site";
    const heroTitle = document.getElementById("hero-title");
    const heroSubtitle = document.getElementById("hero-subtitle");
    const profileName = document.getElementById("profile-name");
    const profileBio = document.getElementById("profile-bio");
    if (heroTitle) heroTitle.textContent = site.heroTitle || owner;
    if (heroSubtitle) heroSubtitle.textContent = site.heroSubtitle || "";
    if (profileName) profileName.textContent = owner;
    if (profileBio) profileBio.textContent = site.profileBio || "";

    const allPosts = Object.values(posts).filter((entry) => !entry.external && !entry.private);
    const tagSet = new Set();
    allPosts.forEach((entry) => {
      (entry.tags || []).forEach((tag) => tagSet.add(tag));
    });
    const statPosts = document.getElementById("stat-posts");
    const statSections = document.getElementById("stat-sections");
    const statTags = document.getElementById("stat-tags");
    if (statPosts) statPosts.textContent = String(allPosts.length);
    if (statSections) statSections.textContent = String(Object.keys(sections).length);
    if (statTags) statTags.textContent = String(tagSet.size);

    const ctfCount = allPosts.filter((p) => (p.tag || "").toLowerCase().includes("writeup") || (p.tags || []).some((t) => t.toLowerCase().includes("ctf"))).length;
    const malCount = allPosts.filter((p) => (p.tag || "").toLowerCase().includes("malware") || (p.tags || []).some((t) => t.toLowerCase().includes("malware") || t.toLowerCase().includes("ida") || t.toLowerCase().includes("deobfuscate"))).length;
    const sortedDates = allPosts.map(getEntrySortDate).filter(Boolean).sort((a, b) => b - a);
    const latestDateStr = sortedDates.length ? new Date(sortedDates[0]).toISOString().split("T")[0] : "2026-07-21";

    const heroPosts = document.getElementById("hero-stat-posts");
    const heroCtf = document.getElementById("hero-stat-ctf");
    const heroMalware = document.getElementById("hero-stat-malware");
    if (heroPosts) heroPosts.textContent = String(allPosts.length);
    if (heroCtf) heroCtf.textContent = String(ctfCount);
    if (heroMalware) heroMalware.textContent = String(malCount);

    const ovTotal = document.getElementById("overview-stat-total");
    const ovCtf = document.getElementById("overview-stat-ctf");
    const ovMalware = document.getElementById("overview-stat-malware");
    const ovLatest = document.getElementById("overview-stat-latest");
    if (ovTotal) ovTotal.textContent = String(allPosts.length);
    if (ovCtf) ovCtf.textContent = String(ctfCount);
    if (ovMalware) ovMalware.textContent = String(malCount);
    if (ovLatest) ovLatest.textContent = latestDateStr;

    const recentTitle = document.getElementById("recent-title");
    const recentDescription = document.getElementById("recent-description");
    const recentPrev = document.getElementById("recent-prev");
    const recentNext = document.getElementById("recent-next");
    const recentPage = document.getElementById("recent-page");
    const recentPosts = Object.values(posts)
      .filter((entry) => entry && !entry.external && !entry.private)
      .sort((left, right) => {
        if (Boolean(left && left.pinned) !== Boolean(right && right.pinned)) {
          return left && left.pinned ? -1 : 1;
        }

        const rightDate = getEntrySortDate(right);
        const leftDate = getEntrySortDate(left);
        if (rightDate !== leftDate) {
          return rightDate - leftDate;
        }
        return String(left.title || "").localeCompare(String(right.title || ""));
      });

    if (recentTitle) {
      recentTitle.textContent = "Recent";
    }
    if (recentDescription) {
      recentDescription.textContent = "Latest updated posts.";
    }

    let currentPage = 0;
    const totalPages = Math.max(1, Math.ceil(recentPosts.length / RECENT_PAGE_SIZE));
    const scrollRecentListToTop = () => {
      const top = Math.max(0, window.scrollY + recentList.getBoundingClientRect().top - 20);
      window.scrollTo({
        top,
        behavior: prefersReducedMotion ? "auto" : "smooth"
      });
    };

    const renderRecentPage = () => {
      const start = currentPage * RECENT_PAGE_SIZE;
      recentList.innerHTML = recentPosts
        .slice(start, start + RECENT_PAGE_SIZE)
        .map((entry, index) => createPostCard(entry, index))
        .join("\n") || "<p>No posts to display.</p>";

      if (recentPage) {
        recentPage.textContent = `${recentPosts.length ? currentPage + 1 : 0} / ${recentPosts.length ? totalPages : 0}`;
      }
      if (recentPrev) {
        recentPrev.disabled = currentPage === 0;
      }
      if (recentNext) {
        recentNext.disabled = currentPage >= totalPages - 1;
      }
    };

    const siteSearchInput = document.getElementById("site-search-input");
    const searchStatusBar = document.getElementById("search-status-bar");
    const searchStatusText = document.getElementById("search-status-text");
    const searchClearBtn = document.getElementById("search-clear-btn");

    function updateSearchFilter() {
      const query = String(siteSearchInput ? siteSearchInput.value : "").trim().toLowerCase();
      if (!query) {
        if (searchStatusBar) searchStatusBar.style.display = "none";
        renderRecentPage();
        return;
      }

      const filtered = allPosts.filter((entry) => {
        const titleMatch = String(entry.title || "").toLowerCase().includes(query);
        const summaryMatch = String(entry.summary || entry.description || "").toLowerCase().includes(query);
        const tagMatch = (entry.tags || []).some((t) => String(t).toLowerCase().includes(query));
        const categoryMatch = String(entry.tag || "").toLowerCase().includes(query);
        return titleMatch || summaryMatch || tagMatch || categoryMatch;
      });

      if (searchStatusBar) {
        searchStatusBar.style.display = "flex";
        if (searchStatusText) {
          searchStatusText.textContent = `Hiển thị ${filtered.length} bài viết phù hợp với "${query}"`;
        }
      }

      recentList.innerHTML = filtered.length
        ? filtered.map((entry, index) => createPostCard(entry, index)).join("\n")
        : '<p style="padding: 24px; color: var(--muted); text-align: center;">Không tìm thấy bài viết nào phù hợp.</p>';

      if (recentPage) recentPage.textContent = `1 / 1`;
      if (recentPrev) recentPrev.disabled = true;
      if (recentNext) recentNext.disabled = true;
    }

    if (siteSearchInput) {
      siteSearchInput.addEventListener("input", updateSearchFilter);
    }
    if (searchClearBtn) {
      searchClearBtn.addEventListener("click", () => {
        if (siteSearchInput) siteSearchInput.value = "";
        updateSearchFilter();
      });
    }

    const handleRecentPrev = () => {
      if (currentPage > 0) {
        currentPage -= 1;
        renderRecentPage();
        scrollRecentListToTop();
      }
    };
    const handleRecentNext = () => {
      if (currentPage < totalPages - 1) {
        currentPage += 1;
        renderRecentPage();
        scrollRecentListToTop();
      }
    };
    if (recentPrev) {
      recentPrev.addEventListener("click", handleRecentPrev);
    }
    if (recentNext) {
      recentNext.addEventListener("click", handleRecentNext);
    }
    renderRecentPage();

    const sectionMap = {
      writeup: {
        title: document.getElementById("writeup-title"),
        description: document.getElementById("writeup-description"),
        list: document.getElementById("writeup-list")
      },
      tools: {
        title: document.getElementById("tools-title"),
        description: document.getElementById("tools-description"),
        list: document.getElementById("tools-list")
      },
      blog: {
        title: document.getElementById("blog-title"),
        description: document.getElementById("blog-description"),
        list: document.getElementById("blog-list")
      },
      malware: {
        title: document.getElementById("malware-title"),
        description: document.getElementById("malware-description"),
        list: document.getElementById("malware-list")
      }
    };

    Object.entries(sectionMap).forEach(([key, nodes]) => {
      const section = sections[key];
      if (!section || !nodes.list) {
        return;
      }

      if (nodes.title) {
        nodes.title.textContent = section.title || key;
      }
      if (nodes.description) {
        nodes.description.textContent = section.description || "";
      }

      const entries = sortEntriesByUpdatedDate(
        (section.items || [])
          .map((slug) => posts[slug])
          .filter(Boolean)
      );
      nodes.list.innerHTML = entries.map((entry, index) => createPostCard(entry, index)).join("\n") || "<p>No posts in this category yet.</p>";
    });

    const handleHashChange = () => {
      handleRouting();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("hashchange", handleHashChange);
    handleRouting();

    const cleanupTerminal = bindRailTerminal(site);
    const cleanupPlayer = bindHomepagePlayer(site, musicLibrary);

    return function () {
      cleanupTerminal();
      cleanupPlayer();
      window.removeEventListener("hashchange", handleHashChange);
      if (recentPrev) {
        recentPrev.removeEventListener("click", handleRecentPrev);
      }
      if (recentNext) {
        recentNext.removeEventListener("click", handleRecentNext);
      }
    };
  });
})();
