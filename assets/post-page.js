(function () {
  const DATA_URL = "/data/posts.json";
  const MUSIC_STATE_KEY = "site_music_session_v3";

  function getPostKey() {
    const params = new URLSearchParams(window.location.search);
    const querySlug = params.get("slug");
    if (querySlug) {
      return querySlug;
    }

    const cleanPath = window.location.pathname.replace(/\/+$/, "");
    const match = cleanPath.match(/\/post\/([^/]+)$/);
    if (match && match[1] && match[1] !== "post") {
      return decodeURIComponent(match[1]);
    }

    return document.body.dataset.postKey || "";
  }

  const key = getPostKey();

  const titleNode = document.getElementById("post-title");
  const tagNode = document.getElementById("post-tag");
  const descNode = document.getElementById("post-description");
  const sourceNode = document.getElementById("post-source");
  const statusNode = document.getElementById("post-status");
  const contentNode = document.getElementById("post-content");
  const pageTitleNode = document.getElementById("page-title");
  const tocNode = document.getElementById("post-toc");
  const postMusicNodes = {
    card: document.getElementById("post-music-card"),
    title: document.getElementById("post-music-title"),
    subtitle: document.getElementById("post-music-subtitle"),
    position: document.getElementById("post-music-position"),
    progress: document.getElementById("post-music-progress-bar"),
    prev: document.getElementById("post-music-prev"),
    play: document.getElementById("post-music-play"),
    next: document.getElementById("post-music-next"),
    loop: document.getElementById("post-music-loop"),
    listToggle: document.getElementById("post-music-list-toggle"),
    playlistInner: document.getElementById("post-music-playlist-inner")
  };

  const tocShellNode = document.querySelector(".toc-shell");
  const postMusicShellNode = document.querySelector(".post-music-shell");

  const patSubmit = document.getElementById("pat-submit");
  const patClear = document.getElementById("pat-clear");
  const patInput = document.getElementById("pat-input");
  
  if (patSubmit) {
    patSubmit.addEventListener("click", () => {
      if (patInput && patInput.value.trim()) {
        localStorage.setItem("github_pat", patInput.value.trim());
        window.location.reload();
      }
    });
  }
  if (patClear) {
    patClear.addEventListener("click", () => {
      localStorage.removeItem("github_pat");
      window.location.reload();
    });
  }
  
  const tocToggle = document.getElementById("toc-toggle");
  const tocCard = document.getElementById("toc-card");
  if (tocToggle && tocCard) {
    tocToggle.addEventListener("click", () => {
      tocCard.classList.toggle("is-collapsed");
    });
  }

  function restoreMusicState() {
    try {
      const raw = sessionStorage.getItem(MUSIC_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function persistMusicState(state, audio) {
    try {
      sessionStorage.setItem(MUSIC_STATE_KEY, JSON.stringify({
        tracks: state.tracks || [],
        currentIndex: state.currentIndex || 0,
        currentTime: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
        isPaused: audio ? audio.paused : true,
        isExpanded: Boolean(state.isExpanded),
        loopCurrent: Boolean(state.loopCurrent)
      }));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function resolveMusicUrl(value) {
    if (!value) {
      return "";
    }

    try {
      return new URL(value, window.location.href).toString();
    } catch (error) {
      return "";
    }
  }

  function setPostMusicPlayIcon(isPlaying) {
    if (!postMusicNodes.play) {
      return;
    }

    postMusicNodes.play.innerHTML = isPlaying
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14"></path><path d="M15 5v14"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"></path></svg>';
    postMusicNodes.play.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    postMusicNodes.play.setAttribute("title", isPlaying ? "Pause" : "Play");
  }

  function setPostMusicLoopState(isActive) {
    if (!postMusicNodes.loop) {
      return;
    }

    postMusicNodes.loop.classList.toggle("is-active", Boolean(isActive));
    postMusicNodes.loop.setAttribute("aria-label", isActive ? "Disable loop current track" : "Loop current track");
    postMusicNodes.loop.setAttribute("title", isActive ? "Disable loop current track" : "Loop current track");
  }

  function setPostMusicExpanded(isExpanded) {
    if (postMusicNodes.card) {
      postMusicNodes.card.classList.toggle("is-expanded", Boolean(isExpanded));
    }
    if (postMusicNodes.listToggle) {
      postMusicNodes.listToggle.setAttribute("aria-expanded", String(Boolean(isExpanded)));
      postMusicNodes.listToggle.setAttribute("aria-label", isExpanded ? "Hide playlist" : "Show playlist");
      postMusicNodes.listToggle.setAttribute("title", isExpanded ? "Hide playlist" : "Show playlist");
    }
  }

  function renderPostMusicPlaylist(state) {
    if (!postMusicNodes.playlistInner) {
      return;
    }

    if (!state || !Array.isArray(state.tracks) || !state.tracks.length) {
      postMusicNodes.playlistInner.innerHTML = '<p class="toc-empty">No active playlist.</p>';
      return;
    }

    postMusicNodes.playlistInner.innerHTML = state.tracks
      .map((track, index) => [
        `<button class="post-music-track${index === state.currentIndex ? " is-active" : ""}" type="button" data-track-index="${index}">`,
        `  <span class="post-music-track-title">${String(track.title || "Untitled").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>`,
        `  <span class="post-music-track-subtitle">${String(track.subtitle || "Local MP3").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>`,
        "</button>"
      ].join("\n"))
      .join("\n");
  }

  function resumeBackgroundMusic() {
    const state = restoreMusicState();
    if (!postMusicNodes.card) {
      return;
    }

    if (!state || !Array.isArray(state.tracks) || !state.tracks.length) {
      setPostMusicExpanded(false);
      renderPostMusicPlaylist(null);
      return;
    }

    const audio = new Audio();
    const clampIndex = Math.max(0, Math.min(Number(state.currentIndex) || 0, state.tracks.length - 1));
    state.currentIndex = clampIndex;
    audio.preload = "metadata";
    audio.loop = Boolean(state.loopCurrent);

    const updateUi = () => {
      const track = state.tracks[state.currentIndex];
      const hasTracks = state.tracks.length > 0;
      const isPlaying = hasTracks && !audio.paused;

      if (postMusicNodes.title) {
        postMusicNodes.title.textContent = track && track.title ? track.title : "Not playing";
      }
      if (postMusicNodes.subtitle) {
        postMusicNodes.subtitle.textContent = track && track.subtitle ? track.subtitle : "Open the main page to start a playlist.";
      }
      if (postMusicNodes.position) {
        postMusicNodes.position.textContent = hasTracks ? `${state.currentIndex + 1} / ${state.tracks.length}` : "0 / 0";
      }
      if (postMusicNodes.progress) {
        const percent = audio.duration ? Math.min(100, (audio.currentTime / audio.duration) * 100) : 0;
        postMusicNodes.progress.style.width = `${percent}%`;
      }
      if (postMusicNodes.prev) {
        postMusicNodes.prev.disabled = !hasTracks;
      }
      if (postMusicNodes.play) {
        postMusicNodes.play.disabled = !hasTracks;
      }
      if (postMusicNodes.next) {
        postMusicNodes.next.disabled = !hasTracks;
      }
      if (postMusicNodes.loop) {
        postMusicNodes.loop.disabled = !hasTracks;
      }
      if (postMusicNodes.listToggle) {
        postMusicNodes.listToggle.disabled = !hasTracks;
      }
      setPostMusicPlayIcon(isPlaying);
      setPostMusicLoopState(hasTracks && state.loopCurrent);
      setPostMusicExpanded(Boolean(state.isExpanded));
      renderPostMusicPlaylist(state);
    };

    const playTrack = (index, startTime, shouldAutoplay) => {
      state.currentIndex = (index + state.tracks.length) % state.tracks.length;
      const track = state.tracks[state.currentIndex];
      const audioUrl = resolveMusicUrl(track && track.audioUrl);
      if (!audioUrl) {
        return;
      }

      audio.src = audioUrl;
      const resumeTime = Math.max(0, Number(startTime) || 0);
      audio.addEventListener("loadedmetadata", () => {
        if (resumeTime > 0) {
          try {
            audio.currentTime = resumeTime;
          } catch (error) {
            audio.currentTime = 0;
          }
        }
      }, { once: true });

      persistMusicState(state, audio);
      updateUi();

      if (shouldAutoplay) {
        audio.play().catch(() => {
          persistMusicState({ ...state, isPaused: true }, audio);
          updateUi();
        });
      }
    };

    const togglePlayback = () => {
      if (!state.tracks.length || !audio.src) {
        return;
      }

      if (audio.paused) {
        audio.play().catch(() => {
          persistMusicState({ ...state, isPaused: true }, audio);
          updateUi();
        });
      } else {
        audio.pause();
      }
    };

    const toggleLoop = () => {
      state.loopCurrent = !state.loopCurrent;
      audio.loop = state.loopCurrent;
      persistMusicState(state, audio);
      updateUi();
    };

    if (postMusicNodes.prev) {
      postMusicNodes.prev.addEventListener("click", () => playTrack(state.currentIndex - 1, 0, true));
    }
    if (postMusicNodes.play) {
      postMusicNodes.play.addEventListener("click", togglePlayback);
    }
    if (postMusicNodes.next) {
      postMusicNodes.next.addEventListener("click", () => playTrack(state.currentIndex + 1, 0, true));
    }
    if (postMusicNodes.loop) {
      postMusicNodes.loop.addEventListener("click", toggleLoop);
    }
    if (postMusicNodes.listToggle) {
      postMusicNodes.listToggle.addEventListener("click", () => {
        state.isExpanded = !state.isExpanded;
        persistMusicState(state, audio);
        updateUi();
      });
    }
    if (postMusicNodes.playlistInner) {
      postMusicNodes.playlistInner.addEventListener("click", (event) => {
        const button = event.target.closest("[data-track-index]");
        if (!button) {
          return;
        }
        const index = Number(button.getAttribute("data-track-index"));
        if (Number.isInteger(index)) {
          playTrack(index, 0, true);
        }
      });
    }

    audio.addEventListener("play", () => {
      persistMusicState(state, audio);
      updateUi();
    });
    audio.addEventListener("pause", () => {
      persistMusicState(state, audio);
      updateUi();
    });
    audio.addEventListener("timeupdate", () => {
      persistMusicState(state, audio);
      updateUi();
    });
    audio.addEventListener("loadedmetadata", () => {
      persistMusicState(state, audio);
      updateUi();
    });
    audio.addEventListener("ended", () => {
      if (audio.loop || !state.tracks.length) {
        return;
      }
      playTrack(state.currentIndex + 1, 0, true);
    });
    window.addEventListener("pagehide", () => persistMusicState(state, audio));

    updateUi();
    playTrack(state.currentIndex, Number(state.currentTime) || 0, !Boolean(state.isPaused));
  }

  function setupScrollNav() {
    const nav = document.querySelector(".nav");
    if (!nav) {
      return;
    }

    let lastY = window.scrollY;

    window.addEventListener("scroll", () => {
      const currentY = window.scrollY;
      const delta = currentY - lastY;

      if (currentY <= 16) {
        nav.classList.remove("is-hidden");
        lastY = currentY;
        return;
      }

      if (delta > 8) {
        nav.classList.add("is-hidden");
      } else if (delta < -8) {
        nav.classList.remove("is-hidden");
      }

      lastY = currentY;
    }, { passive: true });
  }

  function layoutTocRail() {
    if (!tocShellNode || !contentNode) {
      return;
    }

    if (window.innerWidth <= 1320) {
      tocShellNode.style.left = "";
      tocShellNode.style.top = "";
      tocShellNode.style.width = "";
      if (postMusicShellNode) {
        postMusicShellNode.style.left = "";
        postMusicShellNode.style.top = "";
        postMusicShellNode.style.width = "";
      }
      return;
    }

    const contentRect = contentNode.getBoundingClientRect();
    const shellLeft = contentRect.right + 22;
    const maxWidth = Math.max(240, Math.min(480, window.innerWidth - shellLeft - 22));

    tocShellNode.style.left = `${shellLeft}px`;
    tocShellNode.style.top = "86px";
    tocShellNode.style.width = `${maxWidth}px`;

    if (!postMusicShellNode) {
      return;
    }

    const musicWidth = Math.max(240, Math.min(360, contentRect.left - 44));
    const musicLeft = Math.max(22, contentRect.left - musicWidth - 22);

    postMusicShellNode.style.left = `${musicLeft}px`;
    postMusicShellNode.style.top = "86px";
    postMusicShellNode.style.width = `${musicWidth}px`;
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  function buildTableOfContents(container) {
    if (!tocNode) {
      return;
    }

    const headings = Array.from(container.querySelectorAll("h2, h3, h4"));
    if (!headings.length) {
      tocNode.innerHTML = '<p class="toc-empty">This post has no headings for a table of contents.</p>';
      return;
    }

    const usedIds = new Set();
    const items = headings.map((heading, index) => {
      const baseId = slugify(heading.textContent) || `section-${index + 1}`;
      let finalId = baseId;
      let suffix = 2;

      while (usedIds.has(finalId) || document.getElementById(finalId)) {
        finalId = `${baseId}-${suffix}`;
        suffix += 1;
      }

      usedIds.add(finalId);
      heading.id = finalId;

      return {
        id: finalId,
        text: heading.textContent || `Section ${index + 1}`,
        depth: Number(heading.tagName.slice(1))
      };
    });

    tocNode.innerHTML = items
      .map((item) => {
        const safeText = item.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return `<a class="toc-link depth-${item.depth}" href="#${item.id}">${safeText}</a>`;
      })
      .join("");

    const links = Array.from(tocNode.querySelectorAll(".toc-link"));

    const updateActiveLink = () => {
      let activeId = items[0].id;
      const offset = 120;

      headings.forEach((heading) => {
        if (heading.getBoundingClientRect().top - offset <= 0) {
          activeId = heading.id;
        }
      });

      links.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${activeId}`);
      });
    };

    updateActiveLink();
    window.addEventListener("scroll", updateActiveLink, { passive: true });
  }

  function setStatus(message, type) {
    statusNode.textContent = message || "";
    statusNode.className = "status";
    if (!message) {
      statusNode.classList.add("is-hidden");
      return;
    }
    if (type === "error") {
      statusNode.classList.add("is-error");
    }
  }

  function applyPostBackground(url, fallback) {
    const imageUrl = url || fallback;
    if (!imageUrl) {
      return;
    }
    document.documentElement.style.setProperty("--page-background-image", `url("${imageUrl}")`);
  }

  function rewriteRelativeUrls(container, loadedUrl, sourceUrl) {
    const sourceBase = sourceUrl.endsWith("/") ? sourceUrl : sourceUrl + "/";
    const loadedBase = loadedUrl.slice(0, loadedUrl.lastIndexOf("/") + 1);
    const pat = localStorage.getItem("github_pat");

    container.querySelectorAll("a[href]").forEach((anchor) => {
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href)) {
        return;
      }
      anchor.href = new URL(href, sourceBase).toString();
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
    });

    const imgObserver = window.IntersectionObserver ? new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          observer.unobserve(img);
          const apiUrl = img.dataset.apiUrl;
          const absoluteUrl = img.dataset.absoluteUrl;
          if (!apiUrl) return;

          fetch(apiUrl, {
            headers: {
              'Authorization': `Bearer ${pat}`,
              'Accept': 'application/vnd.github.v3.raw'
            }
          }).then(res => {
            if (res.ok) return res.blob();
            throw new Error('Image fetch failed');
          }).then(blob => {
            img.src = URL.createObjectURL(blob);
          }).catch(e => {
            console.warn("Failed to load private image, falling back:", absoluteUrl);
            img.src = absoluteUrl;
          });
        }
      });
    }, { rootMargin: "800px" }) : null;

    container.querySelectorAll("img[src]").forEach((image) => {
      const src = image.getAttribute("src");
      if (!src || src.startsWith("data:")) return;

      let absoluteUrl;
      try {
        absoluteUrl = new URL(src, loadedBase).toString();
      } catch(e) { return; }

      if (pat && absoluteUrl.includes("raw.githubusercontent.com")) {
        const match = absoluteUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
        if (match) {
          const [, owner, repo, ref, filePath] = match;
          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${ref}`;

          if (imgObserver) {
            image.dataset.apiUrl = apiUrl;
            image.dataset.absoluteUrl = absoluteUrl;
            // 1x1 transparent SVG placeholder to avoid broken icon while waiting
            image.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
            imgObserver.observe(image);
          } else {
            // Setup fallback for very old browsers
            fetch(apiUrl, {
              headers: {
                'Authorization': `Bearer ${pat}`,
                'Accept': 'application/vnd.github.v3.raw'
              }
            }).then(res => {
              if (res.ok) return res.blob();
              throw new Error();
            }).then(blob => image.src = URL.createObjectURL(blob)).catch(() => image.src = absoluteUrl);
          }
          return;
        }
      }

      image.loading = "lazy";
      image.src = absoluteUrl;
    });
  }

  async function fetchWithPAT(url, pat) {
    const match = url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
    if (!match) return null;
    const [, owner, repo, ref, filePath] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${ref}`;
    
    try {
      const res = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github.v3.raw'
        },
        cache: "no-store"
      });
      if (res.ok) {
        const text = await res.text();
        return { url, text };
      }
    } catch (e) {
      console.warn("API load error:", url, e);
    }
    return null;
  }

  async function fetchFirstAvailable(candidates) {
    const pat = localStorage.getItem("github_pat");
    for (const url of candidates) {
      try {
        if (pat && url.includes("raw.githubusercontent.com")) {
          const apiResult = await fetchWithPAT(url, pat);
          if (apiResult) return apiResult;
        }

        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          continue;
        }
        const text = await response.text();
        if (!text.trim()) {
          continue;
        }
        return { text, url };
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  async function loadPostData() {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load posts.json");
    }
    return response.json();
  }

  function findPostEntry(posts, postKey) {
    if (!posts || !postKey) {
      return null;
    }

    if (posts[postKey]) {
      return posts[postKey];
    }

    return Object.values(posts).find((entry) => entry && entry.slug === postKey) || null;
  }

  if (window.marked) {
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false
    });
  }

  setupScrollNav();
  resumeBackgroundMusic();
  layoutTocRail();
  window.addEventListener("resize", layoutTocRail);

  loadPostData()
    .then((data) => {
      const site = data.site || {};
      const entry = findPostEntry(data.posts || {}, key);

      applyPostBackground(site.defaultPostBackground || site.homeBackground);

      if (!entry) {
        pageTitleNode.textContent = "Post Not Found";
        titleNode.textContent = "Post Not Found";
        descNode.textContent = "This slug is not declared in data/posts.json.";
        sourceNode.removeAttribute("href");
        contentNode.innerHTML = "<p>Please check the slug or data in <code>data/posts.json</code>.</p>";
        setStatus("Configuration for this post not found.", "error");
        return null;
      }

      pageTitleNode.textContent = entry.title + " | " + (site.owner || "Site");
      tagNode.textContent = entry.tag || "Post";
      titleNode.textContent = entry.title || "";
      descNode.textContent = entry.description || "";
      sourceNode.href = entry.source || "#";

      setStatus("Loading content from GitHub...");
      return { entry, site };
    })
    .then(async (result) => {
      if (!result) {
        return;
      }

      const fetched = await fetchFirstAvailable(result.entry.candidates || []);
      if (!fetched) {
        const hasGithubRaw = (result.entry.candidates || []).some(url => url.includes("raw.githubusercontent.com"));
        if (hasGithubRaw) {
          const authForm = document.getElementById("private-auth-form");
          if (authForm) {
            authForm.style.display = "block";
            const clearBtn = document.getElementById("pat-clear");
            if (localStorage.getItem("github_pat") && clearBtn) {
              clearBtn.style.display = "block";
            }
          }
          contentNode.innerHTML = "";
          setStatus("Authentication Required: This post may be in a private repository.", "error");
        } else {
          contentNode.innerHTML = [
            "<p>Failed to load the markdown file for this post.</p>",
            "<p>Please check the branch, file name, or <code>candidates</code> array in <code>data/posts.json</code>.</p>"
          ].join("");
          setStatus("Failed to load markdown from GitHub for this post.", "error");
        }
        return;
      }

      setStatus("Load success.");

      if (window.marked) {
        const rawHtml = marked.parse(fetched.text);
        contentNode.innerHTML = window.DOMPurify
          ? DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } })
          : rawHtml;
        if (window.hljs) {
          contentNode.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
          });
        }
      } else {
        contentNode.textContent = fetched.text;
      }

      rewriteRelativeUrls(contentNode, fetched.url, result.entry.source || "");
      buildTableOfContents(contentNode);
      layoutTocRail();
    })
    .catch(() => {
      contentNode.innerHTML = "<p>Failed to load post configuration from JSON.</p>";
      setStatus("Could not read data/posts.json.", "error");
      if (tocNode) {
        tocNode.innerHTML = '<p class="toc-empty">Table of contents could not be generated as the post is not fully loaded.</p>';
      }
    });
})();
