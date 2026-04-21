(function () {
  const DATA_URL = "/data/posts.json";
  const key = getPostKey();

  const titleNode = document.getElementById("post-title");
  const tagNode = document.getElementById("post-tag");
  const descNode = document.getElementById("post-description");
  const sourceNode = document.getElementById("post-source");
  const statusNode = document.getElementById("post-status");
  const contentNode = document.getElementById("post-content");
  const pageTitleNode = document.getElementById("page-title");
  const tocNode = document.getElementById("post-toc");
  const tocDescriptionNode = document.getElementById("toc-description");
  const tocShellNode = document.querySelector(".toc-shell");

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
      return;
    }

    const contentRect = contentNode.getBoundingClientRect();
    const shellLeft = contentRect.right + 22;
    const maxWidth = Math.max(240, Math.min(290, window.innerWidth - shellLeft - 16));

    tocShellNode.style.left = `${shellLeft}px`;
    tocShellNode.style.top = "86px";
    tocShellNode.style.width = `${maxWidth}px`;
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
      if (tocDescriptionNode) {
        tocDescriptionNode.textContent = "Could not find clear headings in this post.";
      }
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
      .map((item) => `<a class="toc-link depth-${item.depth}" href="#${item.id}">${item.text}</a>`)
      .join("");

    if (tocDescriptionNode) {
      tocDescriptionNode.textContent = `${items.length} sections for quick navigation.`;
    }

    const links = Array.from(tocNode.querySelectorAll(".toc-link"));
    const headingMap = new Map(items.map((item, index) => [item.id, { item, link: links[index] }]));

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

    container.querySelectorAll("a[href]").forEach((anchor) => {
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href)) {
        return;
      }
      anchor.href = new URL(href, sourceBase).toString();
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
    });

    container.querySelectorAll("img[src]").forEach((image) => {
      const src = image.getAttribute("src");
      if (!src || /^[a-z]+:/i.test(src) || src.startsWith("data:")) {
        return;
      }
      image.src = new URL(src, loadedBase).toString();
    });
  }

  async function fetchFirstAvailable(candidates) {
    for (const url of candidates) {
      try {
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
        contentNode.innerHTML = [
          "<p>Failed to load the markdown file for this post.</p>",
          "<p>Please check the branch, file name, or <code>candidates</code> array in <code>data/posts.json</code>.</p>"
        ].join("");
        setStatus("Failed to load markdown from GitHub for this post.", "error");
        return;
      }

      setStatus("Content loaded from " + new URL(fetched.url).hostname + ".");

      if (window.marked) {
        contentNode.innerHTML = marked.parse(fetched.text);
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
