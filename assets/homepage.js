(function () {
  const DATA_URL = "/data/posts.json";
  const RECENT_PAGE_SIZE = 4;

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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function createMetaItems(entry) {
    const items = [];

    if (entry.publishedAt) {
      items.push(`<span class="entry-meta-item">🗓 <span>${escapeHtml(entry.publishedAt)}</span></span>`);
    }
    if (entry.updatedAt) {
      items.push(`<span class="entry-meta-item">🕘 <span>${escapeHtml(entry.updatedAt)}</span></span>`);
    }
    if (entry.wordCount) {
      items.push(`<span class="entry-meta-item">✎ <span>${escapeHtml(entry.wordCount)} chữ</span></span>`);
    }
    if (entry.readingTime) {
      items.push(`<span class="entry-meta-item">⌛ <span>${escapeHtml(entry.readingTime)}</span></span>`);
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
    const cardBackground = entry.background ? `--card-background-image: url('${escapeAttr(entry.background)}');` : "";
    const coverImage = (entry.cover || entry.background)
      ? `--card-cover-image: url('${escapeAttr(entry.cover || entry.background)}');`
      : "";
    const cardStyle = cardBackground || coverImage ? ` style="${cardBackground}${coverImage}"` : "";
    const metaItems = createMetaItems(entry);
    const tags = createTags(entry.tags);
    const route = entry.external ? (entry.route || "#") : `/post/?slug=${encodeURIComponent(entry.slug || "")}`;
    const routeAttrs = entry.external ? ' target="_blank" rel="noreferrer"' : "";
    const reverseClass = index % 2 === 1 ? " is-reversed" : "";

    return [
      `<article class="entry-card${reverseClass}"${cardStyle}>`,
      `  <a class="entry-card-link" href="${escapeAttr(route)}"${routeAttrs} aria-label="${escapeAttr(entry.title || "")}"></a>`,
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

  function setupRecentPosts(posts) {
    if (!recentNodes.list) {
      return;
    }

    const recentPosts = Object.values(posts)
      .filter((entry) => entry && !entry.external)
      .sort((left, right) => {
        const rightDate = parseDate(right.updatedAt || right.publishedAt);
        const leftDate = parseDate(left.updatedAt || left.publishedAt);
        if (rightDate !== leftDate) {
          return rightDate - leftDate;
        }
        return String(left.title || "").localeCompare(String(right.title || ""));
      });

    if (recentNodes.title) {
      recentNodes.title.textContent = "Recent";
    }

    if (recentNodes.description) {
      recentNodes.description.textContent = "Danh sach cac bai moi cap nhat, 4 bai moi trang.";
    }

    if (!recentPosts.length) {
      recentNodes.list.innerHTML = "<p>Chua co bai viet nao de hien thi.</p>";
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

  function applySiteData(data) {
    const site = data.site || {};
    const posts = data.posts || {};
    const sections = data.sections || {};

    if (site.homeBackground) {
      document.documentElement.style.setProperty("--site-background-image", `url("${site.homeBackground}")`);
    }

    if (site.profileAvatar) {
      document.documentElement.style.setProperty("--profile-avatar-image", `url("${site.profileAvatar}")`);
    }

    const owner = site.owner || "Site";
    const heroTitle = document.getElementById("hero-title");
    const heroSubtitle = document.getElementById("hero-subtitle");
    const siteBrand = document.getElementById("site-brand");
    const profileName = document.getElementById("profile-name");
    const profileBio = document.getElementById("profile-bio");
    const musicTitle = document.getElementById("music-title");
    const musicSubtitle = document.getElementById("music-subtitle");

    if (heroTitle) heroTitle.textContent = owner;
    if (heroSubtitle) heroSubtitle.textContent = site.heroSubtitle || "";
    if (siteBrand) siteBrand.textContent = owner;
    if (profileName) profileName.textContent = owner;
    if (profileBio) profileBio.textContent = site.profileBio || "";
    if (musicTitle) musicTitle.textContent = site.musicTitle || "Now playing";
    if (musicSubtitle) musicSubtitle.textContent = site.musicSubtitle || "";

    const allPosts = Object.values(posts).filter((entry) => !entry.external);
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
  }

  async function loadHomepageData() {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load posts.json");
    }

    const data = await response.json();
    const posts = data.posts || {};
    const sections = data.sections || {};

    applySiteData(data);
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

      const items = (section.items || [])
        .map((slug) => posts[slug])
        .filter(Boolean)
        .map((entry, index) => createPostCard(entry, index))
        .join("\n");

      nodes.list.innerHTML = items || "<p>Chưa có bài nào trong mục này.</p>";
    });
  }

  loadHomepageData().catch(() => {
    Object.values(sectionNodes).forEach((nodes) => {
      if (nodes.list) {
        nodes.list.innerHTML = "<p>Chưa tải được dữ liệu bài viết từ file JSON.</p>";
      }
    });
  });
})();
