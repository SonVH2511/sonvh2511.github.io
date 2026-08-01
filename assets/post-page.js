(function () {
  const DATA_URL = "/data/posts.json";
  const DAILY_WALLPAPER_URLS = Array.isArray(window.__SITE_DAILY_WALLPAPERS__) && window.__SITE_DAILY_WALLPAPERS__.length
    ? window.__SITE_DAILY_WALLPAPERS__.slice()
    : ["/assets/images/background/wallpaper.jpg"];
  const LEGACY_WALLPAPER_PATTERN = /\/assets\/images\/wallpaper(?:_night)?\.jpg$/i;

  function normalizeAssetUrl(value) {
    return String(value || "").trim();
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

  function isDailyWallpaperReference(value) {
    const normalized = normalizeAssetUrl(value);
    return Boolean(normalized) && (
      LEGACY_WALLPAPER_PATTERN.test(normalized) ||
      DAILY_WALLPAPER_URLS.includes(normalized)
    );
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

  function setPlayButtonIcon(button, isPlaying) {
    if (!button) {
      return;
    }

    button.innerHTML = isPlaying
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14"></path><path d="M15 5v14"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"></path></svg>';
    button.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    button.setAttribute("title", isPlaying ? "Pause" : "Play");
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function bindPostPlayer(site) {
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

    if (!postMusicNodes.card) {
      return function () {};
    }

    const player = window.SiteApp.musicPlayer;
    player.boot({
      fallbackCover: resolveWallpaperByDay(site.musicCover || site.profileAvatar || "")
    });

    const render = (snapshot) => {
      if (postMusicNodes.title) {
        postMusicNodes.title.textContent = snapshot.currentTrack ? snapshot.currentTrack.title : "Not playing";
      }
      if (postMusicNodes.subtitle) {
        postMusicNodes.subtitle.textContent = snapshot.currentTrack
          ? (snapshot.currentTrack.subtitle || "Local MP3")
          : "Open the main page to start a playlist.";
      }
      if (postMusicNodes.position) {
        postMusicNodes.position.textContent = snapshot.hasTracks
          ? `${snapshot.currentIndex + 1} / ${snapshot.tracks.length}`
          : "0 / 0";
      }
      if (postMusicNodes.progress) {
        const percent = snapshot.duration
          ? Math.min(100, (snapshot.currentTime / snapshot.duration) * 100)
          : 0;
        postMusicNodes.progress.style.width = `${percent}%`;
      }
      if (postMusicNodes.prev) {
        postMusicNodes.prev.disabled = !snapshot.hasTracks;
      }
      if (postMusicNodes.play) {
        postMusicNodes.play.disabled = !snapshot.hasTracks;
        setPlayButtonIcon(postMusicNodes.play, snapshot.isPlaying);
      }
      if (postMusicNodes.next) {
        postMusicNodes.next.disabled = !snapshot.hasTracks;
      }
      if (postMusicNodes.loop) {
        postMusicNodes.loop.disabled = !snapshot.hasTracks;
        postMusicNodes.loop.classList.toggle("is-active", snapshot.hasTracks && snapshot.loopCurrent);
      }
      if (postMusicNodes.listToggle) {
        postMusicNodes.listToggle.disabled = !snapshot.hasTracks;
        postMusicNodes.listToggle.setAttribute("aria-expanded", String(Boolean(snapshot.isExpanded)));
      }
      if (postMusicNodes.card) {
        postMusicNodes.card.classList.toggle("is-expanded", Boolean(snapshot.isExpanded));
      }

      if (postMusicNodes.playlistInner) {
        if (!snapshot.hasTracks) {
          postMusicNodes.playlistInner.innerHTML = '<p class="toc-empty">No active playlist.</p>';
        } else {
          postMusicNodes.playlistInner.innerHTML = snapshot.tracks
            .map((track, index) => [
              `<button class="post-music-track${index === snapshot.currentIndex ? " is-active" : ""}" type="button" data-track-index="${index}">`,
              `  <span class="post-music-track-title">${escapeHtml(track.title)}</span>`,
              `  <span class="post-music-track-subtitle">${escapeHtml(track.subtitle || "Local MP3")}</span>`,
              "</button>"
            ].join("\n"))
            .join("\n");
        }
      }
    };

    const unsubscribe = player.subscribe(render);
    const handlePrev = () => player.playPrevious();
    const handlePlay = () => player.togglePlayback();
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

    if (postMusicNodes.prev) {
      postMusicNodes.prev.addEventListener("click", handlePrev);
    }
    if (postMusicNodes.play) {
      postMusicNodes.play.addEventListener("click", handlePlay);
    }
    if (postMusicNodes.next) {
      postMusicNodes.next.addEventListener("click", handleNext);
    }
    if (postMusicNodes.loop) {
      postMusicNodes.loop.addEventListener("click", handleLoop);
    }
    if (postMusicNodes.listToggle) {
      postMusicNodes.listToggle.addEventListener("click", handleListToggle);
    }
    if (postMusicNodes.playlistInner) {
      postMusicNodes.playlistInner.addEventListener("click", handlePlaylistClick);
    }

    return function () {
      unsubscribe();
      if (postMusicNodes.prev) {
        postMusicNodes.prev.removeEventListener("click", handlePrev);
      }
      if (postMusicNodes.play) {
        postMusicNodes.play.removeEventListener("click", handlePlay);
      }
      if (postMusicNodes.next) {
        postMusicNodes.next.removeEventListener("click", handleNext);
      }
      if (postMusicNodes.loop) {
        postMusicNodes.loop.removeEventListener("click", handleLoop);
      }
      if (postMusicNodes.listToggle) {
        postMusicNodes.listToggle.removeEventListener("click", handleListToggle);
      }
      if (postMusicNodes.playlistInner) {
        postMusicNodes.playlistInner.removeEventListener("click", handlePlaylistClick);
      }
    };
  }

  function rewriteRelativeUrls(container, loadedUrl, sourceUrl) {
    const sourceBase = sourceUrl.endsWith("/") ? sourceUrl : sourceUrl + "/";
    const loadedBase = loadedUrl.slice(0, loadedUrl.lastIndexOf("/") + 1);
    const pat = localStorage.getItem("github_pat");
    const applyMediaSource = (node, src) => {
      node.setAttribute("src", src);
      if ("src" in node) {
        node.src = src;
      }

      const media = node.matches("video, audio")
        ? node
        : node.closest("video, audio");
      if (media && typeof media.load === "function") {
        media.load();
      }
    };
    const resolveGitHubMedia = (node, absoluteUrl, failureMessage) => {
      const match = absoluteUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
      if (!match) {
        applyMediaSource(node, absoluteUrl);
        return;
      }

      const owner = match[1];
      const repo = match[2];
      const ref = match[3];
      const filePath = match[4];
      const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${ref}`;

      fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: "application/vnd.github.v3.raw"
        }
      }).then((response) => {
        if (!response.ok) {
          throw new Error(failureMessage);
        }
        return response.blob();
      }).then((blob) => {
        applyMediaSource(node, URL.createObjectURL(blob));
      }).catch(() => {
        applyMediaSource(node, absoluteUrl);
      });
    };

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
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const img = entry.target;
        observer.unobserve(img);
        const apiUrl = img.dataset.apiUrl;
        const absoluteUrl = img.dataset.absoluteUrl;
        if (!apiUrl) {
          return;
        }

        fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${pat}`,
            Accept: "application/vnd.github.v3.raw"
          }
        }).then((response) => {
          if (!response.ok) {
            throw new Error("Image fetch failed");
          }
          return response.blob();
        }).then((blob) => {
          img.src = URL.createObjectURL(blob);
        }).catch(() => {
          img.src = absoluteUrl;
        });
      });
    }, { rootMargin: "800px" }) : null;

    container.querySelectorAll("img[src]").forEach((image) => {
      const src = image.getAttribute("src");
      if (!src || src.startsWith("data:")) {
        return;
      }

      let absoluteUrl = "";
      try {
        absoluteUrl = new URL(src, loadedBase).toString();
      } catch (error) {
        return;
      }

      if (pat && absoluteUrl.includes("raw.githubusercontent.com")) {
        const match = absoluteUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
        if (match) {
          const owner = match[1];
          const repo = match[2];
          const ref = match[3];
          const filePath = match[4];
          const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${ref}`;

          if (imgObserver) {
            image.dataset.apiUrl = apiUrl;
            image.dataset.absoluteUrl = absoluteUrl;
            image.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
            imgObserver.observe(image);
          } else {
            fetch(apiUrl, {
              headers: {
                Authorization: `Bearer ${pat}`,
                Accept: "application/vnd.github.v3.raw"
              }
            }).then((response) => {
              if (!response.ok) {
                throw new Error("Image fetch failed");
              }
              return response.blob();
            }).then((blob) => {
              image.src = URL.createObjectURL(blob);
            }).catch(() => {
              image.src = absoluteUrl;
            });
          }
          return;
        }
      }

      image.loading = "lazy";
      image.src = absoluteUrl;
    });

    container.querySelectorAll("video[src], audio[src], source[src]").forEach((mediaNode) => {
      const src = mediaNode.getAttribute("src");
      if (!src || src.startsWith("data:")) {
        return;
      }

      let absoluteUrl = "";
      try {
        absoluteUrl = new URL(src, loadedBase).toString();
      } catch (error) {
        return;
      }

      if (pat && absoluteUrl.includes("raw.githubusercontent.com")) {
        resolveGitHubMedia(mediaNode, absoluteUrl, "Media fetch failed");
        return;
      }

      applyMediaSource(mediaNode, absoluteUrl);
    });
  }

  async function fetchWithPAT(url, pat) {
    const match = url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
    if (!match) {
      return null;
    }

    const owner = match[1];
    const repo = match[2];
    const ref = match[3];
    const filePath = match[4];
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${ref}`;

    try {
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: "application/vnd.github.v3.raw"
        },
        cache: "no-store"
      });
      if (!response.ok) {
        return null;
      }
      const text = await response.text();
      return { url, text };
    } catch (error) {
      return null;
    }
  }

  async function fetchFirstAvailable(candidates) {
    const pat = localStorage.getItem("github_pat");
    for (const url of candidates) {
      try {
        if (pat && url.includes("raw.githubusercontent.com")) {
          const apiResult = await fetchWithPAT(url, pat);
          if (apiResult) {
            return apiResult;
          }
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

  window.SiteApp.registerPage("post", async function () {
    const titleNode = document.getElementById("post-title");
    if (!titleNode) {
      return null;
    }

    const tagNode = document.getElementById("post-tag");
    const descNode = document.getElementById("post-description");
    const sourceNode = document.getElementById("post-source");
    const statusNode = document.getElementById("post-status");
    const contentNode = document.getElementById("post-content");
    const tocNode = document.getElementById("post-toc");
    const tocShellNode = document.querySelector(".toc-shell");
    const postMusicShellNode = document.querySelector(".post-music-shell");
    const tocToggle = document.getElementById("toc-toggle");
    const tocCard = document.getElementById("toc-card");
    const tocTitleNode = document.getElementById("toc-title");
    const patSubmit = document.getElementById("pat-submit");
    const patClear = document.getElementById("pat-clear");
    const patInput = document.getElementById("pat-input");
    const key = getPostKey();
    const cleanups = [];

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

    function setPageTitle(value) {
      document.title = value || "Post | SonVH";
    }

    function applyPostBackground(url, fallback) {
      const imageUrl = resolveWallpaperByDay(url || fallback);
      if (imageUrl) {
        document.documentElement.style.setProperty("--page-background-image", `url("${imageUrl}")`);
      }
    }

    function layoutTocRail() {
      if (!tocShellNode || !contentNode) {
        return;
      }

      const contentRect = contentNode.getBoundingClientRect();
      const wide = window.innerWidth > 1320;
      const leftGutter = contentRect.left;
      const rightGutter = window.innerWidth - contentRect.right;
      // A side rail only docks when its gutter can hold it without covering
      // the content column (240px card + 22px gap on each side).
      const DOCK_MIN = 284;

      // TOC rail -> right gutter
      if (wide && rightGutter >= DOCK_MIN) {
        tocShellNode.style.position = "fixed";
        tocShellNode.style.left = `${contentRect.right + 22}px`;
        tocShellNode.style.top = "86px";
        tocShellNode.style.width = `${Math.min(360, rightGutter - 44)}px`;
      } else {
        tocShellNode.style.position = "static";
        tocShellNode.style.left = "";
        tocShellNode.style.top = "";
        tocShellNode.style.width = "";
      }

      // Music rail -> left gutter
      if (postMusicShellNode) {
        if (wide && leftGutter >= DOCK_MIN) {
          const musicWidth = Math.min(360, leftGutter - 44);
          postMusicShellNode.style.position = "fixed";
          postMusicShellNode.style.left = `${Math.max(22, leftGutter - musicWidth - 22)}px`;
          postMusicShellNode.style.top = "86px";
          postMusicShellNode.style.width = `${musicWidth}px`;
        } else {
          postMusicShellNode.style.position = "static";
          postMusicShellNode.style.left = "";
          postMusicShellNode.style.top = "";
          postMusicShellNode.style.width = "";
        }
      }
    }

    function buildTableOfContents(container) {
      if (!tocNode) {
        return function () {};
      }

      const headings = Array.from(container.querySelectorAll("h2, h3, h4"));
      if (!headings.length) {
        if (tocTitleNode) {
          tocTitleNode.textContent = "Contents";
        }
        tocNode.innerHTML = '<p class="toc-empty">This post has no headings for a table of contents.</p>';
        return function () {};
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

      const minDepth = items.reduce((currentMin, item) => Math.min(currentMin, item.depth), items[0].depth);
      const treeRoot = [];
      const stack = [{ children: treeRoot, level: 0 }];

      items.forEach((item) => {
        const level = Math.max(1, item.depth - minDepth + 1);
        const node = {
          id: item.id,
          text: item.text,
          level,
          children: []
        };

        while (stack.length > 1 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        const parent = stack[stack.length - 1];
        parent.children.push(node);
        stack.push(node);
      });

      function renderTocList(nodes, isRoot) {
        const className = isRoot ? "toc-list toc-list-root" : "toc-child";
        return [
          `<ol class="${className}">`,
          ...nodes.map((node) => [
            `<li class="toc-item toc-level-${node.level}" data-toc-item="${node.id}">`,
            `  <a class="toc-link" href="#${node.id}" data-toc-link="${node.id}"><span class="toc-text">${escapeHtml(node.text)}</span></a>`,
            node.children.length ? renderTocList(node.children, false) : "",
            "</li>"
          ].join("\n")),
          "</ol>"
        ].join("\n");
      }

      if (tocTitleNode) {
        tocTitleNode.textContent = "Contents";
      }
      tocNode.innerHTML = renderTocList(treeRoot, true);

      const itemNodes = Array.from(tocNode.querySelectorAll("[data-toc-item]"));
      const linkNodes = Array.from(tocNode.querySelectorAll("[data-toc-link]"));
      const itemById = new Map(itemNodes.map((node) => [node.getAttribute("data-toc-item"), node]));

      const applyActiveState = (activeId) => {
        itemNodes.forEach((itemNode) => itemNode.classList.remove("is-current"));
        linkNodes.forEach((linkNode) => {
          linkNode.classList.toggle("is-active", linkNode.getAttribute("data-toc-link") === activeId);
        });

        let currentNode = itemById.get(activeId) || null;
        while (currentNode) {
          currentNode.classList.add("is-current");
          currentNode = currentNode.parentElement ? currentNode.parentElement.closest("[data-toc-item]") : null;
        }
      };

      const updateActiveLink = () => {
        let activeId = items[0].id;
        const offset = 120;

        headings.forEach((heading) => {
          if (heading.getBoundingClientRect().top - offset <= 0) {
            activeId = heading.id;
          }
        });

        applyActiveState(activeId);
      };

      const handleTocClick = (event) => {
        const link = event.target.closest("[data-toc-link]");
        if (!link) {
          return;
        }

        const targetId = link.getAttribute("data-toc-link");
        const targetHeading = targetId ? document.getElementById(targetId) : null;
        if (!targetHeading) {
          return;
        }

        event.preventDefault();
        applyActiveState(targetId);

        const targetUrl = new URL(window.location.href);
        targetUrl.hash = targetId;
        history.replaceState(history.state, "", targetUrl.toString());

        const top = Math.max(0, window.scrollY + targetHeading.getBoundingClientRect().top - 96);
        window.scrollTo({
          top,
          behavior: "smooth"
        });
      };

      updateActiveLink();
      tocNode.addEventListener("click", handleTocClick);
      window.addEventListener("scroll", updateActiveLink, { passive: true });
      return function () {
        tocNode.removeEventListener("click", handleTocClick);
        window.removeEventListener("scroll", updateActiveLink);
      };
    }

    function setupScrollNav() {
      const nav = document.querySelector(".nav");
      if (!nav) {
        return function () {};
      }

      let lastY = window.scrollY;
      const handleScroll = () => {
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
      };

      window.addEventListener("scroll", handleScroll, { passive: true });
      return function () {
        window.removeEventListener("scroll", handleScroll);
      };
    }

    const cleanupScrollNav = setupScrollNav();
    cleanups.push(cleanupScrollNav);
    layoutTocRail();
    const handleResize = () => layoutTocRail();
    window.addEventListener("resize", handleResize);
    cleanups.push(() => window.removeEventListener("resize", handleResize));

    if (tocToggle && tocCard) {
      const handleTocToggle = () => {
        tocCard.classList.toggle("is-collapsed");
        tocToggle.setAttribute("aria-expanded", String(!tocCard.classList.contains("is-collapsed")));
      };
      tocToggle.addEventListener("click", handleTocToggle);
      cleanups.push(() => tocToggle.removeEventListener("click", handleTocToggle));
    }

    if (patSubmit && patInput) {
      const handlePatSubmit = () => {
        if (patInput.value.trim()) {
          localStorage.setItem("github_pat", patInput.value.trim());
          window.SiteApp.reloadCurrentPage();
        }
      };
      patSubmit.addEventListener("click", handlePatSubmit);
      cleanups.push(() => patSubmit.removeEventListener("click", handlePatSubmit));
    }

    if (patClear) {
      const handlePatClear = () => {
        localStorage.removeItem("github_pat");
        window.SiteApp.reloadCurrentPage();
      };
      patClear.addEventListener("click", handlePatClear);
      cleanups.push(() => patClear.removeEventListener("click", handlePatClear));
    }

    const data = await window.SiteApp.getJson(DATA_URL);
    const site = data.site || {};
    const entry = findPostEntry(data.posts || {}, key);
    const cleanupPlayer = bindPostPlayer(site);
    cleanups.push(cleanupPlayer);

    applyPostBackground(site.defaultPostBackground || site.homeBackground);

    if (!entry) {
      setPageTitle("Post Not Found");
      titleNode.textContent = "Post Not Found";
      descNode.textContent = "This slug is not declared in data/posts.json.";
      sourceNode.removeAttribute("href");
      contentNode.innerHTML = "<p>Please check the slug or data in <code>data/posts.json</code>.</p>";
      setStatus("Configuration for this post not found.", "error");
      return function () {
        cleanups.forEach((cleanup) => cleanup());
      };
    }

    setPageTitle(`${entry.title} | ${site.owner || "Site"}`);
    tagNode.textContent = entry.tag || "Post";
    titleNode.textContent = entry.title || "";
    descNode.textContent = entry.description || "";
    sourceNode.href = entry.source || "#";

    setStatus("Loading content from GitHub...");
    const fetched = await fetchFirstAvailable(entry.candidates || []);
    if (!fetched) {
      const hasGithubRaw = (entry.candidates || []).some((url) => url.includes("raw.githubusercontent.com"));
      if (hasGithubRaw) {
        const authForm = document.getElementById("private-auth-form");
        if (authForm) {
          authForm.style.display = "block";
          if (localStorage.getItem("github_pat") && patClear) {
            patClear.style.display = "block";
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
      return function () {
        cleanups.forEach((cleanup) => cleanup());
      };
    }

    setStatus("Load success.");
    if (window.marked) {
      const rawHtml = marked.parse(fetched.text);
      contentNode.innerHTML = window.DOMPurify
        ? DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } })
        : rawHtml;
      if (window.hljs) {
        contentNode.querySelectorAll("pre code").forEach((block) => {
          hljs.highlightElement(block);
        });
      }
    } else {
      contentNode.textContent = fetched.text;
    }

    rewriteRelativeUrls(contentNode, fetched.url, entry.source || "");
    const cleanupToc = buildTableOfContents(contentNode);
    cleanups.push(cleanupToc);
    layoutTocRail();

    return function () {
      cleanups.forEach((cleanup) => cleanup());
    };
  });
})();
