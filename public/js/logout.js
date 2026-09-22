// logout.js — globalna obsługa wylogowania
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'logoutBtn') {
    e.preventDefault();

    // usuwamy token
    localStorage.removeItem('token');

    // pobieramy język
    const lang = localStorage.getItem("lang") || "pl";

    // przekierowanie zależne od języka
    if (lang === "en") {
      window.location.href = "/en/login.html";
    } else {
      window.location.href = "/login.html";
    }
  }
});
