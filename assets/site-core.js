(function () {
  const PAGE_SHELL_SELECTOR = "#site-shell";
  const PAGE_ASSET_SELECTOR = "[data-page-asset]";
  const MUSIC_STATE_KEY = "site_music_session_v3";
  const documentCache = new Map();
  const jsonCache = new Map();
  const controllers = new Map();
  let currentCleanup = null;
  let booted = false;
  let navigationToken = 0;
  let pageInitToken = 0;
  let loaderEl = null;
  let loaderShownAt = 0;
  let loaderHideTimer = 0;
  let loaderBodyOverflow = "";

  function resolveUrl(value, baseUrl) {
    if (!value) {
      return "";
    }

    try {
      return new URL(value, baseUrl || window.location.href).toString();
    } catch (error) {
      return "";
    }
  }

  function ensureLoader() {
    if (loaderEl) {
      return loaderEl;
    }

    if (!document.getElementById("site-loader-style")) {
      const style = document.createElement("style");
      style.id = "site-loader-style";
      style.textContent = `
        #site-loader {
          position: fixed;
          inset: 0;
          z-index: 3000;
          pointer-events: none;
        }
        #site-loader .site-loading-bg {
          position: fixed;
          top: 0;
          width: 50%;
          height: 100%;
          background: rgba(8, 17, 28, 0.92);
          transition: transform 0.8s ease;
        }
        #site-loader .site-loading-left {
          left: 0;
        }
        #site-loader .site-loading-right {
          right: 0;
        }
        #site-loader .site-spinner-box {
          position: fixed;
          inset: 0;
          z-index: 3001;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 1;
          visibility: visible;
          transition: opacity 0.45s ease, visibility 0.45s ease;
        }
        #site-loader .site-spinner-core {
          display: grid;
          justify-items: center;
          gap: 18px;
        }
        #site-loader .site-loading-disc {
          width: 112px;
          height: 112px;
          border-radius: 50%;
          position: relative;
          background:
            radial-gradient(circle at 34% 28%, rgba(255, 255, 255, 0.34) 0 10%, transparent 11% 100%),
            radial-gradient(circle at center, transparent 0 26%, rgba(255, 255, 255, 0.1) 26.5% 27.5%, transparent 28% 35%, rgba(255, 255, 255, 0.06) 35.5% 36.5%, transparent 37% 44%, rgba(255, 255, 255, 0.05) 44.5% 45.5%, transparent 46% 56%, rgba(255, 255, 255, 0.04) 56.5% 57.5%, transparent 58% 100%),
            radial-gradient(circle at center, rgba(6, 13, 24, 0.96) 0 18%, transparent 19%),
            linear-gradient(135deg, rgba(8, 17, 28, 0.12), rgba(8, 17, 28, 0.34)),
            var(--site-background-image, linear-gradient(135deg, rgba(143, 211, 255, 0.9), rgba(255, 211, 138, 0.9))) center center / cover no-repeat;
          box-shadow:
            0 10px 32px rgba(0, 0, 0, 0.28),
            inset 0 0 0 2px rgba(255, 255, 255, 0.08),
            inset 0 -16px 28px rgba(0, 0, 0, 0.26);
          animation: site-loader-spin 1.9s linear infinite;
          overflow: hidden;
        }
        #site-loader .site-loading-disc::before {
          content: "";
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          background:
            conic-gradient(from 120deg, transparent 0 24%, rgba(255, 255, 255, 0.18) 30%, transparent 38% 100%),
            radial-gradient(circle at 50% 115%, rgba(0, 0, 0, 0.34) 0 34%, transparent 58%),
            radial-gradient(circle at 50% -10%, rgba(255, 255, 255, 0.24) 0 18%, transparent 42%);
          mix-blend-mode: screen;
          opacity: 0.72;
        }
        #site-loader .site-loading-disc::after {
          content: "";
          position: absolute;
          inset: 37px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 34% 30%, rgba(255, 255, 255, 0.26) 0 10%, transparent 11% 100%),
            radial-gradient(circle at center, rgba(32, 45, 70, 0.95) 0 28%, rgba(10, 18, 30, 0.98) 29% 100%);
          box-shadow:
            inset 0 0 0 2px rgba(255, 255, 255, 0.08),
            inset 0 -4px 10px rgba(0, 0, 0, 0.35);
        }
        #site-loader .site-loading-word {
          color: #d8ecff;
          font: 700 0.95rem "JetBrains Mono", Consolas, monospace;
          letter-spacing: 0.24em;
          text-transform: uppercase;
        }
        #site-loader.is-hidden .site-loading-left {
          transform: translateX(-100%);
        }
        #site-loader.is-hidden .site-loading-right {
          transform: translateX(100%);
        }
        #site-loader.is-hidden .site-spinner-box {
          opacity: 0;
          visibility: hidden;
        }
        @keyframes site-loader-spin {
          100% {
            transform: rotate(360deg);
          }
        }
      `;
      document.head.appendChild(style);
    }

    loaderEl = document.createElement("div");
    loaderEl.id = "site-loader";
    loaderEl.className = "is-hidden";
    loaderEl.innerHTML = `
      <div class="site-loading-left site-loading-bg"></div>
      <div class="site-loading-right site-loading-bg"></div>
      <div class="site-spinner-box" aria-hidden="true">
        <div class="site-spinner-core">
          <div class="site-loading-disc"></div>
          <div class="site-loading-word">Loading</div>
        </div>
      </div>
    `;
    document.body.appendChild(loaderEl);
    return loaderEl;
  }

  function startLoading() {
    const element = ensureLoader();
    if (loaderHideTimer) {
      window.clearTimeout(loaderHideTimer);
      loaderHideTimer = 0;
    }
    if (element.classList.contains("is-hidden")) {
      loaderBodyOverflow = document.body.style.overflow;
    }
    loaderShownAt = Date.now();
    document.body.style.overflow = "hidden";
    element.classList.remove("is-hidden");
  }

  function finishLoading() {
    const element = ensureLoader();
    document.body.style.overflow = loaderBodyOverflow;
    loaderBodyOverflow = "";
    element.classList.add("is-hidden");
  }

  function endLoading() {
    const elapsed = loaderShownAt ? Date.now() - loaderShownAt : 600;
    const delay = Math.max(0, 500 - elapsed);
    if (loaderHideTimer) {
      window.clearTimeout(loaderHideTimer);
      loaderHideTimer = 0;
    }
    loaderHideTimer = window.setTimeout(() => {
      loaderHideTimer = 0;
      loaderShownAt = 0;
      finishLoading();
    }, delay);
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

  function restoreMusicState() {
    try {
      const raw = sessionStorage.getItem(MUSIC_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function createMusicPlayer() {
    const audio = new Audio();
    const subscribers = new Set();
    const coverCache = new Map();
    const createdCoverUrls = new Set();
    const state = {
      audio,
      tracks: [],
      currentIndex: 0,
      isExpanded: false,
      loopCurrent: false,
      fallbackCover: "",
      currentCover: "",
      coverToken: 0,
      initialized: false,
      awaitingUserGesture: false
    };

    audio.preload = "metadata";

    function persist() {
      try {
        sessionStorage.setItem(MUSIC_STATE_KEY, JSON.stringify({
          tracks: state.tracks,
          currentIndex: state.currentIndex,
          currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
          isPaused: audio.paused,
          isExpanded: state.isExpanded,
          loopCurrent: state.loopCurrent
        }));
      } catch (error) {
        // Ignore storage failures.
      }
    }

    function getSnapshot() {
      const currentTrack = state.tracks[state.currentIndex] || null;
      return {
        tracks: state.tracks.slice(),
        currentIndex: state.currentIndex,
        currentTrack,
        isExpanded: state.isExpanded,
        loopCurrent: state.loopCurrent,
        isPlaying: Boolean(currentTrack && !audio.paused),
        awaitingUserGesture: state.awaitingUserGesture,
        currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        coverUrl: state.currentCover || state.fallbackCover || "",
        hasTracks: state.tracks.length > 0
      };
    }

    function notify() {
      const snapshot = getSnapshot();
      subscribers.forEach((listener) => {
        listener(snapshot);
      });
    }

    function revokeCachedCoverUrls() {
      createdCoverUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      createdCoverUrls.clear();
      coverCache.clear();
    }

    function tryPlay() {
      if (!audio.src) {
        return Promise.resolve();
      }

      return audio.play()
        .then(() => {
          state.awaitingUserGesture = false;
          persist();
          notify();
        })
        .catch(() => {
          state.awaitingUserGesture = true;
          persist();
          notify();
        });
    }

    function setExpanded(isExpanded) {
      state.isExpanded = Boolean(isExpanded);
      persist();
      notify();
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

      if (coverCache.has(audioUrl)) {
        return coverCache.get(audioUrl);
      }

      const pending = fetch(audioUrl, { headers: { Range: "bytes=0-262143" }, cache: "force-cache" })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load MP3: ${response.status}`);
          }
          return response.arrayBuffer();
        })
        .then((arrayBuffer) => {
          const blob = extractApicImage(arrayBuffer);
          if (!blob) {
            return null;
          }
          const objectUrl = URL.createObjectURL(blob);
          createdCoverUrls.add(objectUrl);
          return objectUrl;
        })
        .catch(() => null);

      coverCache.set(audioUrl, pending);
      return pending;
    }

    function updateCover(track) {
      const explicitCover = resolveUrl(track && track.cover);
      const immediateCover = explicitCover || state.fallbackCover || "";
      const token = ++state.coverToken;
      state.currentCover = immediateCover;
      notify();

      const audioUrl = resolveUrl(track && track.audioUrl);
      if (!audioUrl) {
        return;
      }

      readEmbeddedCover(audioUrl).then((embeddedCover) => {
        if (token !== state.coverToken) {
          return;
        }

        state.currentCover = embeddedCover || explicitCover || state.fallbackCover || "";
        notify();
      });
    }

    function applyStartTime(startTime) {
      const safeTime = Math.max(0, Number(startTime) || 0);
      try {
        audio.currentTime = safeTime;
      } catch (error) {
        audio.currentTime = 0;
      }
    }

    function selectTrack(index, options) {
      if (!state.tracks.length) {
        notify();
        return;
      }

      const normalizedIndex = (index + state.tracks.length) % state.tracks.length;
      const track = state.tracks[normalizedIndex];
      const audioUrl = resolveUrl(track.audioUrl);
      const startTime = options && options.startTime ? options.startTime : 0;
      const shouldAutoplay = options ? options.autoplay === true : false;

      state.currentIndex = normalizedIndex;
      persist();

      if (audioUrl && audio.src !== audioUrl) {
        audio.src = audioUrl;
      }

      if (audio.readyState >= 1) {
        applyStartTime(startTime);
      } else {
        audio.addEventListener("loadedmetadata", () => applyStartTime(startTime), { once: true });
      }

      updateCover(track);
      notify();

      if (shouldAutoplay && audio.src) {
        tryPlay();
      }
    }

    function ensureInitialized(options) {
      const restored = restoreMusicState();
      const restoredTracks = Array.isArray(restored && restored.tracks)
        ? restored.tracks.map(normalizeMusicEntry).filter(Boolean)
        : [];
      const incomingTracks = Array.isArray(options && options.tracks)
        ? options.tracks.map(normalizeMusicEntry).filter(Boolean)
        : [];

      if (options && options.fallbackCover) {
        state.fallbackCover = resolveUrl(options.fallbackCover);
      }

      if (!state.initialized) {
        state.tracks = restoredTracks.length ? restoredTracks : incomingTracks;
        state.currentIndex = Math.max(
          0,
          Math.min(Number(restored && restored.currentIndex) || 0, Math.max(state.tracks.length - 1, 0))
        );
        state.isExpanded = Boolean(restored && restored.isExpanded);
        state.loopCurrent = Boolean(restored && restored.loopCurrent);
        audio.loop = state.loopCurrent;

        audio.addEventListener("play", () => {
          state.awaitingUserGesture = false;
          persist();
          notify();
        });
        audio.addEventListener("pause", () => {
          persist();
          notify();
        });
        audio.addEventListener("timeupdate", () => {
          persist();
          notify();
        });
        audio.addEventListener("loadedmetadata", () => {
          persist();
          notify();
        });
        audio.addEventListener("ended", () => {
          if (!audio.loop && state.tracks.length) {
            selectTrack(state.currentIndex + 1, { autoplay: true });
          }
        });
        window.addEventListener("pagehide", persist);
        window.addEventListener("pagehide", revokeCachedCoverUrls);
        state.initialized = true;

        if (state.tracks.length) {
          const resumeTime = Number(restored && restored.currentTime) || 0;
          selectTrack(state.currentIndex, { autoplay: false, startTime: resumeTime });
        } else {
          notify();
        }
        return;
      }

      if (!state.tracks.length && incomingTracks.length) {
        state.tracks = incomingTracks;
        state.currentIndex = 0;
        notify();
        selectTrack(0, { autoplay: false });
        return;
      }

      notify();
    }

    return {
      boot(options) {
        ensureInitialized(options || {});
      },
      subscribe(listener) {
        if (typeof listener !== "function") {
          return function () {};
        }

        subscribers.add(listener);
        listener(getSnapshot());
        return function () {
          subscribers.delete(listener);
        };
      },
      togglePlayback() {
        if (!state.tracks.length || !audio.src) {
          return;
        }

        if (audio.paused) {
          tryPlay();
        } else {
          audio.pause();
        }
      },
      playPrevious() {
        if (!state.tracks.length) {
          return;
        }
        selectTrack(state.currentIndex - 1, { autoplay: true });
      },
      playNext() {
        if (!state.tracks.length) {
          return;
        }
        selectTrack(state.currentIndex + 1, { autoplay: true });
      },
      playTrack(index) {
        if (!state.tracks.length) {
          return;
        }
        selectTrack(index, { autoplay: true });
      },
      toggleLoopCurrent() {
        state.loopCurrent = !state.loopCurrent;
        audio.loop = state.loopCurrent;
        persist();
        notify();
      },
      setExpanded,
      getSnapshot,
      resumeAfterGesture() {
        if (!state.awaitingUserGesture || !audio.paused) {
          return Promise.resolve();
        }
        return tryPlay();
      },
      getAudio() {
        return audio;
      }
    };
  }

  const SiteApp = window.SiteApp = window.SiteApp || {};
  SiteApp.musicUtils = {
    normalizeMusicEntry,
    buildRandomMusicPlaylist
  };
  SiteApp.musicPlayer = SiteApp.musicPlayer || createMusicPlayer();

  SiteApp.registerPage = function (name, init) {
    controllers.set(name, init);
    if (booted) {
      const shell = getCurrentShell();
      const currentPage = shell && shell.dataset ? shell.dataset.page : "";
      if (currentPage === name) {
        initCurrentPage();
      }
    }
  };

  SiteApp.getJson = function (url, options) {
    const absoluteUrl = resolveUrl(url);
    const force = Boolean(options && options.force);
    if (!force && jsonCache.has(absoluteUrl)) {
      return jsonCache.get(absoluteUrl);
    }

    const pending = fetch(absoluteUrl, { cache: force ? "no-store" : "default" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${absoluteUrl}`);
        }
        return response.json();
      })
      .catch((error) => {
        jsonCache.delete(absoluteUrl);
        throw error;
      });
    jsonCache.set(absoluteUrl, pending);
    return pending;
  };

  function cleanupCurrentPage() {
    if (typeof currentCleanup === "function") {
      currentCleanup();
      currentCleanup = null;
    }
  }

  function getCurrentShell() {
    return document.querySelector(PAGE_SHELL_SELECTOR);
  }

  function getPageAssetKey(node) {
    return node && node.getAttribute ? node.getAttribute("data-page-asset") || "" : "";
  }

  function isEquivalentPageAsset(currentNode, nextNode) {
    if (!currentNode || !nextNode || currentNode.tagName !== nextNode.tagName) {
      return false;
    }

    const currentHref = currentNode.getAttribute && currentNode.getAttribute("href");
    const nextHref = nextNode.getAttribute && nextNode.getAttribute("href");
    if (currentHref || nextHref) {
      return resolveUrl(currentHref) === resolveUrl(nextHref);
    }

    return currentNode.textContent === nextNode.textContent;
  }

  function waitForPageAsset(node) {
    if (!node || node.tagName !== "LINK") {
      return Promise.resolve();
    }

    const rel = String(node.getAttribute("rel") || "").toLowerCase();
    if (rel !== "stylesheet" || node.sheet) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) {
          return;
        }
        settled = true;
        node.removeEventListener("load", done);
        node.removeEventListener("error", done);
        resolve();
      };

      node.addEventListener("load", done, { once: true });
      node.addEventListener("error", done, { once: true });
      window.setTimeout(done, 3000);
    });
  }

  async function swapPageAssets(nextDocument) {
    const currentNodes = Array.from(document.querySelectorAll(PAGE_ASSET_SELECTOR));
    const currentByKey = new Map(
      currentNodes.map((node) => [getPageAssetKey(node), node])
    );
    const nodesToRemove = [];
    const waiters = [];

    nextDocument.querySelectorAll(PAGE_ASSET_SELECTOR).forEach((nextNode) => {
      const key = getPageAssetKey(nextNode);
      const currentNode = currentByKey.get(key);

      if (currentNode && isEquivalentPageAsset(currentNode, nextNode)) {
        currentByKey.delete(key);
        return;
      }

      const clone = nextNode.cloneNode(true);
      document.head.appendChild(clone);
      waiters.push(waitForPageAsset(clone));

      if (currentNode) {
        nodesToRemove.push(currentNode);
        currentByKey.delete(key);
      }
    });

    currentByKey.forEach((node) => {
      nodesToRemove.push(node);
    });

    await Promise.all(waiters);
    nodesToRemove.forEach((node) => node.remove());
  }

  function parseHtml(text) {
    return new DOMParser().parseFromString(text, "text/html");
  }

  function fetchDocument(url, options) {
    const absoluteUrl = resolveUrl(url);
    const force = Boolean(options && options.force);
    if (!force && documentCache.has(absoluteUrl)) {
      return documentCache.get(absoluteUrl);
    }

    const pending = fetch(absoluteUrl, {
      credentials: "same-origin",
      cache: force ? "no-store" : "default"
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${absoluteUrl}`);
        }
        return response.text();
      })
      .catch((error) => {
        documentCache.delete(absoluteUrl);
        throw error;
      });
    documentCache.set(absoluteUrl, pending);
    return pending;
  }

  function scrollToTargetFromUrl(url) {
    const targetUrl = new URL(url, window.location.href);
    if (targetUrl.hash) {
      const targetNode = document.getElementById(decodeURIComponent(targetUrl.hash.slice(1)));
      if (targetNode) {
        targetNode.scrollIntoView();
        return;
      }
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function initCurrentPage() {
    const initToken = ++pageInitToken;
    const shell = getCurrentShell();
    const pageName = shell && shell.dataset ? shell.dataset.page : "";
    const controller = controllers.get(pageName);
    cleanupCurrentPage();

    if (!controller) {
      return;
    }

    const result = await controller({
      shell,
      app: SiteApp
    });
    if (initToken !== pageInitToken || shell !== getCurrentShell()) {
      if (typeof result === "function") {
        result();
      }
      return;
    }
    currentCleanup = typeof result === "function" ? result : null;
    document.dispatchEvent(new CustomEvent("site:page-ready", {
      detail: { page: pageName }
    }));
  }

  function isInternalNavigation(url) {
    const nextUrl = new URL(url, window.location.href);
    return nextUrl.origin === window.location.origin;
  }

  function isHashOnlyNavigation(url) {
    const nextUrl = new URL(url, window.location.href);
    return (
      nextUrl.origin === window.location.origin &&
      nextUrl.pathname === window.location.pathname &&
      nextUrl.search === window.location.search &&
      nextUrl.hash !== window.location.hash
    );
  }

  function shouldHandleAnchor(anchor, event) {
    if (!anchor || !anchor.href) {
      return false;
    }
    if (anchor.target && anchor.target !== "_self") {
      return false;
    }
    if (anchor.hasAttribute("download") || anchor.dataset.pjax === "false") {
      return false;
    }
    if (event && (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) {
      return false;
    }

    const nextUrl = new URL(anchor.href, window.location.href);
    if (nextUrl.origin !== window.location.origin) {
      return false;
    }
    if (/^(mailto|tel|javascript):/i.test(nextUrl.protocol)) {
      return false;
    }
    if (isHashOnlyNavigation(nextUrl.href)) {
      return false;
    }
    return true;
  }

  async function navigate(url, options) {
    const nextUrl = new URL(url, window.location.href);
    if (!isInternalNavigation(nextUrl.href)) {
      window.location.href = nextUrl.href;
      return false;
    }

    if (isHashOnlyNavigation(nextUrl.href)) {
      if (!options || !options.fromPopState) {
        history[options && options.replace ? "replaceState" : "pushState"]({}, "", nextUrl.href);
      }
      scrollToTargetFromUrl(nextUrl.href);
      return false;
    }

    const requestToken = ++navigationToken;
    startLoading();

    try {
      const html = await fetchDocument(nextUrl.href, options);
      if (requestToken !== navigationToken) {
        endLoading();
        return false;
      }

      const nextDocument = parseHtml(html);
      const nextShell = nextDocument.querySelector(PAGE_SHELL_SELECTOR);
      if (!nextShell) {
        endLoading();
        window.location.href = nextUrl.href;
        return false;
      }

      cleanupCurrentPage();

      await swapPageAssets(nextDocument);
      const currentShell = getCurrentShell();
      currentShell.replaceWith(document.importNode(nextShell, true));
      document.title = nextDocument.title || document.title;
      if (nextDocument.documentElement.lang) {
        document.documentElement.lang = nextDocument.documentElement.lang;
      }
      if (nextShell.dataset && nextShell.dataset.page) {
        document.body.dataset.page = nextShell.dataset.page;
      }

      if (!options || !options.fromPopState) {
        history[options && options.replace ? "replaceState" : "pushState"]({}, "", nextUrl.href);
      }

      await initCurrentPage();

      if (!options || options.scroll !== false) {
        scrollToTargetFromUrl(nextUrl.href);
      }
      endLoading();
      return true;
    } catch (error) {
      endLoading();
      window.location.href = nextUrl.href;
      return false;
    }
  }

  function prefetch(url) {
    if (!isInternalNavigation(url) || isHashOnlyNavigation(url)) {
      return;
    }
    fetchDocument(url, { force: false }).catch(() => {});
  }

  function handleDocumentClick(event) {
    const anchor = event.target.closest("a[href]");
    if (!shouldHandleAnchor(anchor, event)) {
      return;
    }

    const nextUrl = new URL(anchor.href, window.location.href);
    if (nextUrl.origin !== window.location.origin) {
      return;
    }

    event.preventDefault();
    navigate(nextUrl.href, { replace: false });
  }

  function handlePrefetchEvent(event) {
    const anchor = event.target.closest("a[href]");
    if (!shouldHandleAnchor(anchor)) {
      return;
    }
    prefetch(anchor.href);
  }

  function handlePopState() {
    navigate(window.location.href, {
      replace: true,
      fromPopState: true
    });
  }

  SiteApp.navigate = navigate;
  SiteApp.prefetch = prefetch;
  SiteApp.reloadCurrentPage = function () {
    documentCache.delete(resolveUrl(window.location.href));
    jsonCache.clear();
    return navigate(window.location.href, {
      replace: true,
      force: true,
      scroll: false
    });
  };

  SiteApp.boot = function () {
    if (booted) {
      return;
    }
    booted = true;
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("mouseenter", handlePrefetchEvent, true);
    document.addEventListener("focusin", handlePrefetchEvent);
    window.addEventListener("popstate", handlePopState);
    ensureLoader();
    initCurrentPage();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", SiteApp.boot, { once: true });
  } else {
    SiteApp.boot();
  }
})();
