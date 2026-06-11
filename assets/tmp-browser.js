(function () {
  const MANIFEST_URL = "/assets/tmp/manifest.json";

  const browserTitleNode = document.getElementById("tmp-browser-title");
  const browserDescriptionNode = document.getElementById("tmp-browser-description");
  const homeNode = document.getElementById("tmp-home");
  const articleNode = document.getElementById("tmp-article");
  const articleTitleNode = document.getElementById("tmp-article-title");
  const articleDescriptionNode = document.getElementById("tmp-article-description");
  const articleMetaNode = document.getElementById("tmp-article-meta");
  const articleOpenNode = document.getElementById("tmp-article-open");
  const articleBackNode = document.getElementById("tmp-article-back");
  const articleBodyNode = document.getElementById("tmp-article-body");
  const articleLayoutNode = document.getElementById("tmp-article-layout");
  const tocShellNode = document.getElementById("tmp-toc-shell");
  const tocNavNode = document.getElementById("tmp-toc-nav");
  const tocDescriptionNode = document.getElementById("tmp-toc-description");

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getItemKey(groupId, itemId) {
    return `${groupId}/${itemId}`;
  }

  function getRequestedItemKey() {
    const params = new URLSearchParams(window.location.search);
    return params.get("item") || "";
  }

  function setRequestedItemKey(value) {
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set("item", value);
    } else {
      url.searchParams.delete("item");
    }
    window.history.replaceState({}, "", url.toString());
  }

  function showHomeMode() {
    document.body.classList.remove("is-article-view");
    homeNode.hidden = false;
    articleNode.hidden = true;
  }

  function showArticleMode() {
    document.body.classList.add("is-article-view");
    homeNode.hidden = true;
    articleNode.hidden = false;
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

  function renderMarkdown(markdownText) {
    if (!window.marked) {
      return `<pre>${escapeHtml(markdownText)}</pre>`;
    }

    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false
    });

    return marked.parse(markdownText);
  }

  async function hydrateMermaid(container) {
    if (!window.mermaid || !container) {
      return;
    }

    const blocks = Array.from(container.querySelectorAll("pre code.language-mermaid, pre code.lang-mermaid"));
    if (!blocks.length) {
      return;
    }

    blocks.forEach((codeNode, index) => {
      const preNode = codeNode.closest("pre");
      const wrapper = document.createElement("div");
      wrapper.className = "mermaid";
      wrapper.textContent = codeNode.textContent || "";
      wrapper.id = `tmp-mermaid-${index + 1}`;
      if (preNode && preNode.parentNode) {
        preNode.parentNode.replaceChild(wrapper, preNode);
      }
    });

    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose"
      });
      await window.mermaid.run({
        nodes: Array.from(container.querySelectorAll(".mermaid"))
      });
    } catch (error) {
      console.error("Mermaid render failed", error);
    }
  }

  async function loadManifest() {
    const response = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load tmp manifest");
    }
    return response.json();
  }

  async function fetchMarkdown(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load markdown");
    }
    return response.text();
  }

  function layoutTocRail() {
    if (!tocShellNode || !articleLayoutNode) {
      return;
    }

    if (window.innerWidth <= 1320) {
      tocShellNode.style.left = "";
      tocShellNode.style.top = "";
      tocShellNode.style.width = "";
      return;
    }

    const layoutRect = articleLayoutNode.getBoundingClientRect();
    const left = layoutRect.right + 22;
    const availableWidth = window.innerWidth - left - 22;

    if (availableWidth < 210) {
      tocShellNode.style.left = "";
      tocShellNode.style.top = "";
      tocShellNode.style.width = "";
      return;
    }

    const width = Math.min(290, availableWidth);
    tocShellNode.style.left = `${left}px`;
    tocShellNode.style.top = "86px";
    tocShellNode.style.width = `${width}px`;
  }

  function removeInlineToc(container) {
    if (!container) {
      return;
    }

    const tocHeading = Array.from(container.querySelectorAll("h1, h2, h3")).find((heading) => {
      const slug = slugify(heading.textContent);
      return slug === "muc-luc" || slug === "table-of-contents";
    });

    if (!tocHeading) {
      return;
    }

    const removable = [tocHeading];
    let cursor = tocHeading.nextElementSibling;

    while (cursor) {
      const tagName = cursor.tagName;
      if (/^H[1-6]$/.test(tagName)) {
        break;
      }
      if (tagName === "OL" || tagName === "UL" || tagName === "P" || tagName === "HR") {
        removable.push(cursor);
        cursor = cursor.nextElementSibling;
        continue;
      }
      break;
    }

    removable.forEach((node) => node.remove());
  }

  function rewriteInlineTocLinks(container, headingMap) {
    if (!container) {
      return;
    }

    container.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      const rawHref = anchor.getAttribute("href") || "";
      if (!rawHref || rawHref === "#") {
        return;
      }

      const decodedHash = decodeURIComponent(rawHref.slice(1));
      const targetId = slugify(decodedHash);
      if (!targetId) {
        return;
      }

      if (headingMap.has(targetId)) {
        anchor.setAttribute("href", `#${targetId}`);
      }
    });
  }

  function buildArticleToc(container) {
    if (!container || !tocNavNode) {
      return;
    }

    const headings = Array.from(container.querySelectorAll("h2, h3, h4"));
    if (!headings.length) {
      tocNavNode.innerHTML = '<p class="tmp-empty tmp-toc-empty">Muc luc se hien khi bai viet co heading.</p>';
      if (tocDescriptionNode) {
        tocDescriptionNode.textContent = "Khong tim thay dau muc de lap overview cho bai viet nay.";
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

    const headingMap = new Map(items.map((item) => [item.id, item]));
    rewriteInlineTocLinks(container, headingMap);

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
      const className = isRoot ? "tmp-toc-list tmp-toc-list-root" : "tmp-toc-child";
      return [
        `<ol class="${className}">`,
        ...nodes.map((node) => [
          `<li class="tmp-toc-item tmp-toc-level-${node.level}" data-toc-item="${node.id}">`,
          `  <a class="tmp-toc-link" href="#${node.id}" data-toc-link="${node.id}"><span class="tmp-toc-text">${escapeHtml(node.text)}</span></a>`,
          node.children.length ? renderTocList(node.children, false) : "",
          "</li>"
        ].join("\n")),
        "</ol>"
      ].join("\n");
    }

    tocNavNode.innerHTML = renderTocList(treeRoot, true);

    if (tocDescriptionNode) {
      tocDescriptionNode.textContent = `${items.length} dau muc de ban nhay nhanh trong bai viet.`;
    }

    const itemNodes = Array.from(tocNavNode.querySelectorAll("[data-toc-item]"));
    const linkNodes = Array.from(tocNavNode.querySelectorAll("[data-toc-link]"));
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

    updateActiveLink();
    window.addEventListener("scroll", updateActiveLink, { passive: true });
  }

  function createHomeCard(group, item) {
    const href = `/tmp/?item=${encodeURIComponent(getItemKey(group.id, item.id))}`;
    return [
      `<a class="tmp-item-card" href="${href}">`,
      `  <span class="tmp-item-meta">${escapeHtml(item.type)}</span>`,
      `  <h3 class="tmp-item-title">${escapeHtml(item.title)}</h3>`,
      `  <p class="tmp-item-description">${escapeHtml(item.description || "")}</p>`,
      `  <span class="tmp-item-cta">${item.type === "html" ? "Open full page" : "Read document"}</span>`,
      `</a>`
    ].join("\n");
  }

  function renderHome(manifest) {
    const groups = Array.isArray(manifest.groups) ? manifest.groups : [];
    browserTitleNode.textContent = manifest.title || "Tmp Browser";
    browserDescriptionNode.textContent = manifest.description || "";

    homeNode.innerHTML = groups.map((group) => [
      '<section class="tmp-group">',
      `  <div class="tmp-group-head">`,
      `    <h2 class="tmp-group-title">${escapeHtml(group.title || group.id || "Group")}</h2>`,
      `    <p class="tmp-group-description">${escapeHtml(group.description || "")}</p>`,
      "  </div>",
      '  <div class="tmp-card-grid">',
      ...(group.items || []).map((item) => createHomeCard(group, item)),
      "  </div>",
      "</section>"
    ].join("\n")).join("\n");
  }

  function buildLookup(manifest) {
    const itemLookup = new Map();
    (manifest.groups || []).forEach((group) => {
      (group.items || []).forEach((item) => {
        itemLookup.set(getItemKey(group.id, item.id), {
          groupId: group.id,
          groupTitle: group.title,
          id: item.id,
          title: item.title,
          type: item.type,
          path: item.path,
          description: item.description
        });
      });
    });
    return itemLookup;
  }

  async function renderArticle(entry) {
    articleTitleNode.textContent = entry.title || "Untitled";
    articleDescriptionNode.textContent = entry.description || entry.path || "";
    articleMetaNode.textContent = `${entry.groupTitle || "Tmp"} · ${entry.type}`;
    articleOpenNode.href = entry.path;
    articleOpenNode.textContent = entry.type === "html" ? "Open file" : "Open raw";
    articleBackNode.href = "/tmp/";

    if (entry.type === "html") {
      window.location.href = entry.path;
      return;
    }

    if (entry.type !== "markdown") {
      articleBodyNode.innerHTML = '<div class="tmp-empty">Loai file nay chua duoc ho tro.</div>';
      return;
    }

    articleBodyNode.innerHTML = '<div class="tmp-empty">Dang tai markdown...</div>';

    try {
      const markdownText = await fetchMarkdown(entry.path);
      articleBodyNode.innerHTML = `<article class="tmp-article-content">${renderMarkdown(markdownText)}</article>`;
      const contentNode = articleBodyNode.querySelector(".tmp-article-content");
      removeInlineToc(contentNode);
      await hydrateMermaid(articleBodyNode);
      buildArticleToc(contentNode);
      layoutTocRail();
    } catch (error) {
      articleBodyNode.innerHTML = '<div class="tmp-empty">Khong tai duoc file markdown nay.</div>';
    }
  }

  loadManifest()
    .then(async (manifest) => {
      renderHome(manifest);
      const itemLookup = buildLookup(manifest);
      const requestedItemKey = getRequestedItemKey();

      if (!requestedItemKey) {
        showHomeMode();
        return;
      }

      const entry = itemLookup.get(requestedItemKey);
      if (!entry) {
        showHomeMode();
        return;
      }

      setRequestedItemKey(requestedItemKey);
      showArticleMode();
      await renderArticle(entry);
    })
    .catch(() => {
      browserTitleNode.textContent = "Tmp Browser";
      browserDescriptionNode.textContent = "Khong tai duoc manifest cho khu vuc tmp.";
      homeNode.innerHTML = '<div class="tmp-empty">Manifest hien khong doc duoc.</div>';
      showHomeMode();
    });

  window.addEventListener("resize", layoutTocRail);
})();
