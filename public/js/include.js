// === include.js ===
// Bezpieczne ładowanie partiali bez duplikowania

document.addEventListener("DOMContentLoaded", () => {
  const nodes = document.querySelectorAll("[data-include]");

  nodes.forEach(async (el) => {
    // Zabezpieczenie przed wielokrotnym wykonaniem
    if (el.dataset.loaded === "true") return;
    el.dataset.loaded = "true";

    const url = el.getAttribute("data-include");
    if (!url) return;

    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      const html = await res.text();

      // nie outerHTML – tylko innerHTML!
      el.innerHTML = html;

      // event aby header.js lub session-check mogły zareagować
      document.dispatchEvent(
        new CustomEvent("include:loaded", { detail: url })
      );

      // jeśli załadowano header – uruchom logikę sesji
      if (url.includes("header.html")) {
        setTimeout(() => {
          if (typeof checkLoginStatus === "function") checkLoginStatus();
          if (typeof attachLogoutHandler === "function") attachLogoutHandler();
        }, 300);
      }
    } catch (e) {
      console.error("include.js: cannot load", url, e);
      el.innerHTML = `<div style="color:red">Error loading ${url}</div>`;
    }
  });

  // aktualizacja roku
  const updateYear = () => {
    const yearNodes = document.querySelectorAll(".js-year");
    if (!yearNodes.length) return;
    const y = new Date().getFullYear();
    yearNodes.forEach((n) => (n.textContent = y));
  };
  updateYear();
});
