(function () {
  const DATA_URL = "/data/posts.json";
  const MUSIC_LIBRARY_URL = "/data/music-library.json";
  const RECENT_PAGE_SIZE = 4;
  const MUSIC_SAMPLE_SIZE = 10;

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

  function createMetaItems(entry) {
    const items = [];

    function createMetaItem(type, value, suffix) {
      const icons = {
        published: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3"></path><path d="M17 3v3"></path><path d="M4 9h16"></path><rect x="4" y="5" width="16" height="15" rx="2"></rect></svg>',
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

  window.SiteApp.registerPage("home", async function () {
    const recentList = document.getElementById("recent-list");
    if (!recentList) {
      return null;
    }

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

        const rightDate = parseDate(right.publishedAt || right.updatedAt);
        const leftDate = parseDate(left.publishedAt || left.updatedAt);
        if (rightDate !== leftDate) {
          return rightDate - leftDate;
        }
        return String(left.title || "").localeCompare(String(right.title || ""));
      });

    if (recentTitle) {
      recentTitle.textContent = "Recent";
    }
    if (recentDescription) {
      recentDescription.textContent = "Latest published posts, 4 posts per page.";
    }

    let currentPage = 0;
    const totalPages = Math.max(1, Math.ceil(recentPosts.length / RECENT_PAGE_SIZE));
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

    const handleRecentPrev = () => {
      if (currentPage > 0) {
        currentPage -= 1;
        renderRecentPage();
      }
    };
    const handleRecentNext = () => {
      if (currentPage < totalPages - 1) {
        currentPage += 1;
        renderRecentPage();
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

      const entries = sortEntriesByPublishedDate(
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

    const cleanupPlayer = bindHomepagePlayer(site, musicLibrary);

    return function () {
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
