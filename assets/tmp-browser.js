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
      await hydrateMermaid(articleBodyNode);
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
})();
