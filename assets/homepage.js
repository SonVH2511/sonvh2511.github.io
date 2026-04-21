(function () {
  const DATA_URL = "/data/posts.json";
  const MUSIC_LIBRARY_URL = "/data/music-library.json";
  const RECENT_PAGE_SIZE = 4;
  const MUSIC_SAMPLE_SIZE = 10;
  const MUSIC_STATE_KEY = "homepage_music_state_v2";
  const musicCoverCache = new Map();

  const sectionNodes = {
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

  const recentNodes = {
    title: document.getElementById("recent-title"),
    description: document.getElementById("recent-description"),
    list: document.getElementById("recent-list"),
    prev: document.getElementById("recent-prev"),
    next: document.getElementById("recent-next"),
    page: document.getElementById("recent-page")
  };

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
    listToggle: document.getElementById("music-list-toggle"),
    playlist: document.getElementById("music-playlist"),
    playlistInner: document.getElementById("music-playlist-inner"),
    audio: document.getElementById("bg-audio")
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function createMetaItems(entry) {
    const items = [];

    if (entry.publishedAt) {
      items.push(`<span class="entry-meta-item">Published <span>${escapeHtml(entry.publishedAt)}</span></span>`);
    }
    if (entry.updatedAt) {
      items.push(`<span class="entry-meta-item">Updated <span>${escapeHtml(entry.updatedAt)}</span></span>`);
    }
    if (entry.wordCount) {
      items.push(`<span class="entry-meta-item">Words <span>${escapeHtml(entry.wordCount)}</span></span>`);
    }
    if (entry.readingTime) {
      items.push(`<span class="entry-meta-item">Read <span>${escapeHtml(entry.readingTime)}</span></span>`);
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
    const cardBackground = entry.background ? `--card-background-image: url('${escapeHtml(entry.background)}');` : "";
    const coverImage = (entry.cover || entry.background)
      ? `--card-cover-image: url('${escapeHtml(entry.cover || entry.background)}');`
      : "";
    const cardStyle = cardBackground || coverImage ? ` style="${cardBackground}${coverImage}"` : "";
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
      '          <div class="entry-labels">',
      entry.pinned ? '            <span class="entry-badge">Pinned</span>' : "",
      `            <span class="entry-tag">${escapeHtml(entry.tag || "")}</span>`,
      '          </div>',
      metaItems ? `          <div class="entry-meta">${metaItems}</div>` : "",
      '        </div>',
      `        <h3>${escapeHtml(entry.title || "")}</h3>`,
      `        <p class="entry-summary">${escapeHtml(summary)}</p>`,
      `        <div class="entry-footer">${tags || '<div class="entry-tags entry-tags-empty"></div>'}</div>`,
      '      </div>',
      '    </div>',
      '  </div>',
      '</article>'
    ].join("\n");
  }

  function parseDate(value) {
    if (!value) {
      return 0;
    }
    const time = Date.parse(value);
    return Number.isNaN(time) ? 0 : time;
  }

  function sortEntriesByPublishedDate(entries) {
    return entries.slice().sort((left, right) => {
      if (Boolean(left && left.pinned) !== Boolean(right && right.pinned)) {
        return left && left.pinned ? -1 : 1;
      }

      const rightDate = parseDate(right && (right.publishedAt || right.updatedAt));
      const leftDate = parseDate(left && (left.publishedAt || left.updatedAt));
      if (rightDate !== leftDate) {
        return rightDate - leftDate;
      }

      return String(left && left.title || "").localeCompare(String(right && right.title || ""));
    });
  }

  function setupRecentPosts(posts) {
    if (!recentNodes.list) {
      return;
    }

    const recentPosts = Object.values(posts)
      .filter((entry) => entry && !entry.external && !entry.private)
      .sort((left, right) => {
        if (Boolean(left && left.pinned) !== Boolean(right && right.pinned)) {
          return left && left.pinned ? -1 : 1;
        }

        const rightDate = parseDate(right.publishedAt || right.updatedAt);
        const leftDate = parseDate(left.publishedAt || left.updatedAt);
        if (rightDate !== leftDate) {
          return rightDate - leftDate;
        }
        return String(left.title || "").localeCompare(String(right.title || ""));
      });

    if (recentNodes.title) {
      recentNodes.title.textContent = "Recent";
    }

    if (recentNodes.description) {
      recentNodes.description.textContent = "Latest published posts, 4 posts per page.";
    }

    if (!recentPosts.length) {
      recentNodes.list.innerHTML = "<p>No posts to display.</p>";
      if (recentNodes.page) recentNodes.page.textContent = "0 / 0";
      if (recentNodes.prev) recentNodes.prev.disabled = true;
      if (recentNodes.next) recentNodes.next.disabled = true;
      return;
    }

    const totalPages = Math.ceil(recentPosts.length / RECENT_PAGE_SIZE);
    let currentPage = 0;

    const renderPage = () => {
      const start = currentPage * RECENT_PAGE_SIZE;
      const pageItems = recentPosts
        .slice(start, start + RECENT_PAGE_SIZE)
        .map((entry, index) => createPostCard(entry, index))
        .join("\n");

      recentNodes.list.innerHTML = pageItems;

      if (recentNodes.page) {
        recentNodes.page.textContent = `${currentPage + 1} / ${totalPages}`;
      }
      if (recentNodes.prev) {
        recentNodes.prev.disabled = currentPage === 0;
      }
      if (recentNodes.next) {
        recentNodes.next.disabled = currentPage >= totalPages - 1;
      }
    };

    if (recentNodes.prev) {
      recentNodes.prev.onclick = () => {
        if (currentPage === 0) {
          return;
        }
        currentPage -= 1;
        renderPage();
      };
    }

    if (recentNodes.next) {
      recentNodes.next.onclick = () => {
        if (currentPage >= totalPages - 1) {
          return;
        }
        currentPage += 1;
        renderPage();
      };
    }

    renderPage();
  }

  function getTrackNameFromUrl(value) {
    const fallback = "Untitled Track";
    if (!value) {
      return fallback;
    }

    const segments = String(value).split("/");
    const name = segments[segments.length - 1] || "";
    const decoded = decodeURIComponent(name).replace(/\.[^.]+$/, "");
    return decoded || fallback;
  }

  function normalizeMusicEntry(entry, index) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const audioUrl = entry.audioUrl || entry.url || entry.src || "";
    if (!audioUrl) {
      return null;
    }

    return {
      id: entry.id || `track-${index + 1}`,
      title: entry.title || entry.name || getTrackNameFromUrl(audioUrl),
      subtitle: entry.artist || entry.subtitle || entry.description || "",
      audioUrl,
      cover: entry.cover || ""
    };
  }

  function shuffleArray(list) {
    const result = list.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const temp = result[index];
      result[index] = result[swapIndex];
      result[swapIndex] = temp;
    }
    return result;
  }

  function buildRandomMusicPlaylist(library, sampleSize) {
    if (!Array.isArray(library) || !library.length) {
      return [];
    }

    const normalized = library
      .map(normalizeMusicEntry)
      .filter(Boolean);

    if (!normalized.length) {
      return [];
    }

    const shuffled = shuffleArray(normalized);
    return shuffled.slice(0, Math.min(sampleSize, shuffled.length));
  }

  function resolveUrl(value) {
    if (!value) {
      return "";
    }

    try {
      return new URL(value, window.location.href).toString();
    } catch (error) {
      return "";
    }
  }

  function persistMusicState(state) {
    try {
      localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify({
        isExpanded: state.isExpanded
      }));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function restoreMusicState() {
    try {
      const raw = localStorage.getItem(MUSIC_STATE_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function renderMusicPlaylist(state) {
    if (!musicNodes.playlistInner) {
      return;
    }

    if (!state.tracks.length) {
      musicNodes.playlistInner.innerHTML = '<p class="music-track-subtitle">No tracks configured.</p>';
      return;
    }

    musicNodes.playlistInner.innerHTML = state.tracks
      .map((track, index) => [
        `<button class="music-track${index === state.currentIndex ? " is-active" : ""}" type="button" data-track-index="${index}">`,
        `  <span class="music-track-title">${escapeHtml(track.title)}</span>`,
        `  <span class="music-track-subtitle">${escapeHtml(track.subtitle || "Local MP3")}</span>`,
        "</button>"
      ].join("\n"))
      .join("\n");
  }

  function setPlayButtonIcon(isPlaying) {
    if (!musicNodes.buttonToggle) {
      return;
    }

    musicNodes.buttonToggle.innerHTML = isPlaying
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" data-icon="pause"><path d="M9 5v14"></path><path d="M15 5v14"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" data-icon="play"><path d="m8 5 11 7-11 7V5Z"></path></svg>';
    musicNodes.buttonToggle.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    musicNodes.buttonToggle.setAttribute("title", isPlaying ? "Pause" : "Play");
  }

  function setMusicExpanded(state, expanded) {
    state.isExpanded = Boolean(expanded);
    if (musicNodes.card) {
      musicNodes.card.classList.toggle("is-expanded", state.isExpanded);
    }
    if (musicNodes.listToggle) {
      musicNodes.listToggle.setAttribute("aria-expanded", String(state.isExpanded));
      musicNodes.listToggle.setAttribute("aria-label", state.isExpanded ? "Hide playlist" : "Show playlist");
      musicNodes.listToggle.setAttribute("title", state.isExpanded ? "Hide playlist" : "Show playlist");
    }
    persistMusicState(state);
  }

  function setMusicCover(url) {
    const image = url || "";
    document.documentElement.style.setProperty("--music-cover-image", image ? `url("${image}")` : "none");
  }

  function readSynchsafeInteger(view, offset) {
    return (
      ((view.getUint8(offset) & 0x7f) << 21) |
      ((view.getUint8(offset + 1) & 0x7f) << 14) |
      ((view.getUint8(offset + 2) & 0x7f) << 7) |
      (view.getUint8(offset + 3) & 0x7f)
    );
  }

  function readUint32BE(view, offset) {
    return (
      (view.getUint8(offset) << 24) |
      (view.getUint8(offset + 1) << 16) |
      (view.getUint8(offset + 2) << 8) |
      view.getUint8(offset + 3)
    ) >>> 0;
  }

  function findTerminator(bytes, start, encoding) {
    const useWide = encoding === 1 || encoding === 2;
    if (!useWide) {
      for (let index = start; index < bytes.length; index += 1) {
        if (bytes[index] === 0) {
          return index;
        }
      }
      return bytes.length;
    }

    for (let index = start; index + 1 < bytes.length; index += 2) {
      if (bytes[index] === 0 && bytes[index + 1] === 0) {
        return index;
      }
    }
    return bytes.length;
  }

  function extractApicImage(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    if (view.byteLength < 10) {
      return null;
    }

    if (
      view.getUint8(0) !== 0x49 ||
      view.getUint8(1) !== 0x44 ||
      view.getUint8(2) !== 0x33
    ) {
      return null;
    }

    const version = view.getUint8(3);
    const tagSize = readSynchsafeInteger(view, 6);
    let offset = 10;
    const limit = Math.min(view.byteLength, 10 + tagSize);

    while (offset + 10 <= limit) {
      if (
        view.getUint8(offset) === 0 &&
        view.getUint8(offset + 1) === 0 &&
        view.getUint8(offset + 2) === 0 &&
        view.getUint8(offset + 3) === 0
      ) {
        break;
      }

      const frameId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      const frameSize = version === 4
        ? readSynchsafeInteger(view, offset + 4)
        : readUint32BE(view, offset + 4);

      if (!frameSize || offset + 10 + frameSize > limit) {
        break;
      }

      if (frameId === "APIC") {
        const frameBytes = new Uint8Array(arrayBuffer, offset + 10, frameSize);
        const encoding = frameBytes[0];
        let cursor = 1;
        let mimeEnd = cursor;

        while (mimeEnd < frameBytes.length && frameBytes[mimeEnd] !== 0) {
          mimeEnd += 1;
        }

        const mimeType = new TextDecoder("latin1").decode(frameBytes.slice(cursor, mimeEnd)) || "image/jpeg";
        cursor = mimeEnd + 1;

        if (cursor >= frameBytes.length) {
          return null;
        }

        cursor += 1;
        const descriptionEnd = findTerminator(frameBytes, cursor, encoding);
        cursor = descriptionEnd + ((encoding === 1 || encoding === 2) ? 2 : 1);

        if (cursor >= frameBytes.length) {
          return null;
        }

        return new Blob([frameBytes.slice(cursor)], { type: mimeType });
      }

      offset += 10 + frameSize;
    }

    return null;
  }

  function readEmbeddedCover(audioUrl) {
    if (!audioUrl) {
      return Promise.resolve(null);
    }

    if (musicCoverCache.has(audioUrl)) {
      return musicCoverCache.get(audioUrl);
    }

    const pending = fetch(audioUrl, { headers: { Range: 'bytes=0-262143' }, cache: "force-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load MP3: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => {
        const blob = extractApicImage(arrayBuffer);
        return blob ? URL.createObjectURL(blob) : null;
      })
      .catch(() => null);

    musicCoverCache.set(audioUrl, pending);
    return pending;
  }

  function initializeMusicPlayer(site, musicList) {
    if (!musicNodes.audio || !musicNodes.card) {
      return;
    }

    const restored = restoreMusicState();
    const state = {
      tracks: musicList,
      currentIndex: 0,
      isExpanded: Boolean(restored && restored.isExpanded),
      fallbackCover: resolveUrl(site.musicCover || site.profileAvatar || ""),
      coverToken: 0
    };

    const audio = musicNodes.audio;
    audio.loop = false;
    audio.preload = "metadata";

    function updatePlaybackButtons() {
      const hasTracks = state.tracks.length > 0;
      const isPlaying = hasTracks && !audio.paused;

      if (musicNodes.buttonToggle) {
        musicNodes.buttonToggle.disabled = !hasTracks;
      }
      setPlayButtonIcon(isPlaying);
      if (musicNodes.playToggle) {
        musicNodes.playToggle.disabled = !hasTracks;
        musicNodes.playToggle.setAttribute("aria-label", isPlaying ? "Pause music" : "Play music");
        musicNodes.playToggle.setAttribute("title", isPlaying ? "Pause music" : "Play music");
      }
      if (musicNodes.prev) {
        musicNodes.prev.disabled = !hasTracks;
      }
      if (musicNodes.next) {
        musicNodes.next.disabled = !hasTracks;
      }
      if (musicNodes.listToggle) {
        musicNodes.listToggle.disabled = !hasTracks;
      }
      if (musicNodes.cover) {
        musicNodes.cover.classList.toggle("playing", isPlaying);
      }
    }

    function updateProgress() {
      if (!musicNodes.progress) {
        return;
      }

      const percent = audio.duration ? Math.min(100, (audio.currentTime / audio.duration) * 100) : 0;
      musicNodes.progress.style.width = `${percent}%`;
    }

    function updateTrackDetails() {
      const track = state.tracks[state.currentIndex];
      if (!track) {
        if (musicNodes.title) musicNodes.title.textContent = "No track loaded";
        if (musicNodes.subtitle) musicNodes.subtitle.textContent = "Add entries to data/posts.json -> music";
        if (musicNodes.position) musicNodes.position.textContent = "0 / 0";
        updateProgress();
        updatePlaybackButtons();
        setMusicCover(state.fallbackCover);
        renderMusicPlaylist(state);
        return;
      }

      if (musicNodes.title) {
        musicNodes.title.textContent = track.title;
      }
      if (musicNodes.subtitle) {
        musicNodes.subtitle.textContent = track.subtitle || "Local MP3";
      }
      if (musicNodes.position) {
        musicNodes.position.textContent = `${state.currentIndex + 1} / ${state.tracks.length}`;
      }

      renderMusicPlaylist(state);
      updateProgress();
      updatePlaybackButtons();
    }

    function loadTrackCover(track) {
      const explicitCover = resolveUrl(track.cover);
      const immediateCover = explicitCover || state.fallbackCover;
      const token = ++state.coverToken;

      setMusicCover(immediateCover);

      const resolvedAudioUrl = resolveUrl(track.audioUrl);
      if (!resolvedAudioUrl) {
        return;
      }

      readEmbeddedCover(resolvedAudioUrl).then((embeddedCover) => {
        if (token !== state.coverToken) {
          return;
        }

        setMusicCover(embeddedCover || explicitCover || state.fallbackCover);
      });
    }

    function selectTrack(index, shouldAutoplay) {
      if (!state.tracks.length) {
        updateTrackDetails();
        return;
      }

      const normalizedIndex = (index + state.tracks.length) % state.tracks.length;
      const track = state.tracks[normalizedIndex];
      const audioUrl = resolveUrl(track.audioUrl);

      state.currentIndex = normalizedIndex;
      persistMusicState(state);

      if (audioUrl && audio.src !== audioUrl) {
        audio.src = audioUrl;
      }

      audio.currentTime = 0;
      updateTrackDetails();
      loadTrackCover(track);

      if (shouldAutoplay && audio.src) {
        audio.play().catch((error) => {
          console.warn("Audio play failed:", error);
          updatePlaybackButtons();
        });
      }
    }

    function togglePlayback() {
      if (!state.tracks.length || !audio.src) {
        return;
      }

      if (audio.paused) {
        audio.play().catch((error) => {
          console.warn("Audio play failed:", error);
          updatePlaybackButtons();
        });
      } else {
        audio.pause();
      }
    }

    if (musicNodes.playToggle) {
      musicNodes.playToggle.addEventListener("click", togglePlayback);
    }
    if (musicNodes.buttonToggle) {
      musicNodes.buttonToggle.addEventListener("click", togglePlayback);
    }
    if (musicNodes.prev) {
      musicNodes.prev.addEventListener("click", () => {
        selectTrack(state.currentIndex - 1, true);
      });
    }
    if (musicNodes.next) {
      musicNodes.next.addEventListener("click", () => {
        selectTrack(state.currentIndex + 1, true);
      });
    }
    if (musicNodes.listToggle) {
      musicNodes.listToggle.addEventListener("click", () => {
        setMusicExpanded(state, !state.isExpanded);
      });
    }
    if (musicNodes.playlistInner) {
      musicNodes.playlistInner.addEventListener("click", (event) => {
        const button = event.target.closest("[data-track-index]");
        if (!button) {
          return;
        }

        const index = Number(button.getAttribute("data-track-index"));
        if (Number.isInteger(index)) {
          selectTrack(index, true);
        }
      });
    }

    audio.addEventListener("play", updatePlaybackButtons);
    audio.addEventListener("pause", updatePlaybackButtons);
    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateProgress);
    audio.addEventListener("ended", () => {
      if (!state.tracks.length) {
        return;
      }
      selectTrack(state.currentIndex + 1, true);
    });

    setMusicExpanded(state, state.isExpanded);
    updateTrackDetails();

    if (state.tracks.length) {
      selectTrack(state.currentIndex, false);
    }
  }

  function applySiteData(data, musicLibrary) {
    const site = data.site || {};
    const posts = data.posts || {};
    const sections = data.sections || {};

    if (site.homeBackground) {
      document.documentElement.style.setProperty("--site-background-image", `url("${site.homeBackground}")`);
    }

    if (site.profileAvatar) {
      document.documentElement.style.setProperty("--profile-avatar-image", `url("${site.profileAvatar}")`);
    }

    if (site.musicCover) {
      document.documentElement.style.setProperty("--music-cover-image", `url("${site.musicCover}")`);
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

    initializeMusicPlayer(site, buildRandomMusicPlaylist(musicLibrary, Number(site.musicSampleSize) || MUSIC_SAMPLE_SIZE));
  }

  async function loadMusicLibrary() {
    const response = await fetch(MUSIC_LIBRARY_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load music-library.json");
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      return data;
    }
    if (Array.isArray(data.tracks)) {
      return data.tracks;
    }
    return [];
  }

  async function loadHomepageData() {
    const [data, musicLibrary] = await Promise.all([
      fetch(DATA_URL, { cache: "no-store" }).then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load posts.json");
        }
        return response.json();
      }),
      loadMusicLibrary()
    ]);
    const posts = data.posts || {};
    const sections = data.sections || {};

    applySiteData(data, musicLibrary);
    setupRecentPosts(posts);

    Object.entries(sectionNodes).forEach(([key, nodes]) => {
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

      const entries = sortEntriesByPublishedDate(
        (section.items || [])
          .map((slug) => posts[slug])
          .filter(Boolean)
      );

      const items = entries
        .map((entry, index) => createPostCard(entry, index))
        .join("\n");

      nodes.list.innerHTML = items || "<p>No posts in this category yet.</p>";
    });
  }

  loadHomepageData().catch(() => {
    Object.values(sectionNodes).forEach((nodes) => {
      if (nodes.list) {
        nodes.list.innerHTML = "<p>Failed to load posts data from JSON.</p>";
      }
    });
  });

  function handleRouting() {
    let hash = window.location.hash.replace("#", "");
    if (!hash || hash === "top") {
      hash = "recent";
    }

    const allSections = ["recent", "writeup", "tools", "blog", "malware"];

    allSections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = (id === hash) ? "" : "none";
      }
    });

    document.querySelectorAll(".profile-link").forEach((link) => {
      const href = link.getAttribute("href") || "";
      const linkHash = href.replace("#", "");
      const isActive = linkHash === hash || (hash === "recent" && linkHash === "top");
      link.classList.toggle("is-active", isActive);
    });
  }

  window.addEventListener("hashchange", () => {
    handleRouting();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  handleRouting();
})();
