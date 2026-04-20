(function () {
  const library = window.POST_LIBRARY || {};
  const key = document.body.dataset.postKey;
  const entry = library[key];

  const titleNode = document.getElementById("post-title");
  const tagNode = document.getElementById("post-tag");
  const descNode = document.getElementById("post-description");
  const sourceNode = document.getElementById("post-source");
  const statusNode = document.getElementById("post-status");
  const contentNode = document.getElementById("post-content");
  const pageTitleNode = document.getElementById("page-title");

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

  if (!entry) {
    pageTitleNode.textContent = "Không tìm thấy bài";
    titleNode.textContent = "Không tìm thấy bài";
    descNode.textContent = "Slug này chưa được khai báo trong POST_LIBRARY.";
    sourceNode.removeAttribute("href");
    contentNode.innerHTML = "<p>Hãy kiểm tra lại route hoặc khai báo bài viết trong <code>assets/post-data.js</code>.</p>";
    setStatus("Không tìm thấy cấu hình cho bài viết này.", "error");
    return;
  }

  if (window.marked) {
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false
    });
  }

  pageTitleNode.textContent = entry.title + " | Sơn Vũ";
  tagNode.textContent = entry.tag;
  titleNode.textContent = entry.title;
  descNode.textContent = entry.description;
  sourceNode.href = entry.source;

  setStatus("Đang tải nội dung từ GitHub...");

  fetchFirstAvailable(entry.candidates).then((result) => {
    if (!result) {
      contentNode.innerHTML = [
        "<p>Chưa tải được file markdown cho bài này.</p>",
        "<p>Hãy kiểm tra branch hoặc tên file trong <code>assets/post-data.js</code>.</p>"
      ].join("");
      setStatus("Không tải được markdown từ GitHub cho bài này.", "error");
      return;
    }

    setStatus("Đã tải nội dung từ " + new URL(result.url).hostname + ".");

    if (window.marked) {
      contentNode.innerHTML = marked.parse(result.text);
    } else {
      contentNode.textContent = result.text;
    }

    rewriteRelativeUrls(contentNode, result.url, entry.source);
  });
})();
