// DeepFry County press kit: clip previews that play while on screen, the lightbox, copy buttons, the
// trailer that loads YouTube only on click, and the nav's current section.
(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Clip previews: muted loops that play while on screen, each with a pause button (or on demand when motion is
  // reduced). A clip the visitor paused stays paused.
  const videos = document.querySelectorAll("video[data-autoplay]");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    videos.forEach((v) => { v.controls = true; });
  } else {
    const watcher = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const video = entry.target;
        if (entry.isIntersecting && !video.dataset.held) {
          if (video.preload === "none") video.preload = "auto";
          video.play().catch(() => { video.controls = true; });
        } else if (!entry.isIntersecting) {
          video.pause();
        }
      }
    }, { threshold: 0.5 });
    videos.forEach((video) => {
      watcher.observe(video);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "clip-toggle";
      const label = () => {
        const paused = !!video.dataset.held;
        button.classList.toggle("is-paused", paused);
        button.setAttribute("aria-label", paused ? "Play the clip" : "Pause the clip");
      };
      const toggle = () => {
        if (video.dataset.held) {
          delete video.dataset.held;
          if (video.preload === "none") video.preload = "auto";
          video.play().catch(() => {});
        } else {
          video.dataset.held = "1";
          video.pause();
        }
        label();
      };
      button.addEventListener("click", toggle);
      video.addEventListener("click", toggle);
      label();
      video.after(button);
    });
  }

  // Lightbox for the screenshots and the art: arrows move within the group of the picture that was opened.
  const box = document.getElementById("lightbox");
  const links = [...document.querySelectorAll("[data-lightbox]")];
  if (box && links.length && typeof box.showModal === "function") {
    const img = box.querySelector("img");
    const caption = box.querySelector(".lightbox-caption");
    const meta = box.querySelector(".lightbox-meta");
    const download = box.querySelector("a.dl");
    let group = [];
    let current = 0;

    const show = (index) => {
      current = (index + group.length) % group.length;
      const link = group[current];
      img.src = link.dataset.view || link.href;
      img.alt = link.dataset.caption;
      img.classList.toggle("is-transparent", "transparent" in link.dataset);
      caption.textContent = link.dataset.caption;
      meta.textContent = link.dataset.meta;
      download.href = link.href;
      download.setAttribute("download", link.dataset.filename || "");
    };

    links.forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      group = links.filter((l) => l.dataset.lightbox === link.dataset.lightbox);
      show(group.indexOf(link));
      box.querySelectorAll(".lightbox-nav").forEach((b) => { b.hidden = group.length < 2; });
      box.showModal();
    }));
    box.querySelector(".prev").addEventListener("click", () => show(current - 1));
    box.querySelector(".next").addEventListener("click", () => show(current + 1));
    box.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") show(current - 1);
      if (event.key === "ArrowRight") show(current + 1);
    });
    // A click on the dark area around the picture closes it.
    box.addEventListener("click", (event) => {
      if (event.target === box || event.target.tagName === "FIGURE") box.close();
    });
    box.addEventListener("close", () => { img.removeAttribute("src"); });
  }

  // Short description: the language menu (shown only with scripts on) swaps the text the copy button takes.
  const shortMenu = document.getElementById("short-language");
  if (shortMenu) {
    const showShort = () => {
      document.querySelectorAll(".quote .short").forEach((text) => { text.hidden = text.lang !== shortMenu.value; });
    };
    shortMenu.closest(".short-head").hidden = false;
    shortMenu.addEventListener("change", showShort);
    showShort();  // a reload may keep the last choice
  }

  // Copy buttons: data-copy holds a selector of the element whose text is copied.
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const source = document.querySelector(button.dataset.copy);
      if (!source) return;
      const text = source.textContent.replace(/\s+/g, " ").trim();
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied";
        button.classList.add("is-done");
      } catch {
        const range = document.createRange();
        range.selectNodeContents(source);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        button.textContent = "Selected";
      }
      setTimeout(() => { button.textContent = "Copy"; button.classList.remove("is-done"); }, 1800);
    });
  });

  // Trailer: YouTube loads only when the visitor asks for it.
  document.querySelectorAll("[data-youtube]").forEach((button) => {
    button.addEventListener("click", () => {
      const frame = document.createElement("iframe");
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(button.dataset.youtube)}?autoplay=1&rel=0`;
      frame.title = "DeepFry County trailer";
      frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      frame.allowFullscreen = true;
      const holder = document.createElement("div");
      holder.className = "trailer-frame";
      holder.appendChild(frame);
      button.replaceWith(holder);
    });
  });

  // Nav: mark the section being read. The factsheet is left out: beside the text it stays on screen all the time.
  const navLinks = [...document.querySelectorAll(".nav a")];
  const sections = navLinks.map((a) => document.querySelector(a.getAttribute("href")))
    .filter((s) => s && s.tagName === "SECTION");
  // The current section is the last one whose heading has passed a line a third of the way down the window.
  if (sections.length) {
    let queued = false;
    let shown = null;
    const mark = () => {
      queued = false;
      const line = window.innerHeight / 3;
      let current = null;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) current = section;
      }
      if (current === shown) return;
      shown = current;
      navLinks.forEach((a) => a.classList.toggle("is-current", !!current && a.getAttribute("href") === `#${current.id}`));
      // On a narrow screen the nav scrolls sideways: bring the current link into it.
      const link = current && navLinks.find((a) => a.getAttribute("href") === `#${current.id}`);
      const strip = link && link.parentElement;
      if (strip && strip.scrollWidth > strip.clientWidth) {
        const left = link.offsetLeft; // the strip is positioned, so this is the link's place in it
        if (left < strip.scrollLeft || left + link.offsetWidth > strip.scrollLeft + strip.clientWidth) {
          strip.scrollTo({ left: Math.max(0, left - 16), behavior: reducedMotion ? "auto" : "smooth" });
        }
      }
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(mark); } };
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    mark();
  }
})();
