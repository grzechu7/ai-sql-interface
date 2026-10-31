// === contact.js — zakładka Kontakt: zwykły formularz albo rozmowa z asystentem AI (PL i EN) ===
// Kategorie, token i limity przychodzą z /api/contact/config; serwer sprawdza wszystko ponownie.

(function () {
  const lang = document.documentElement.lang === "en" ? "en" : "pl";
  const root = document.getElementById("contactApp");
  if (!root) return;

  const T = {
    pl: {
      loading: "Ładowanie formularza…",
      closed: "Formularz kontaktowy jest chwilowo niedostępny. Spróbuj ponownie później.",
      tabForm: "Wypełnij formularz",
      tabFormText: "Wybierz kategorię i opisz sprawę samodzielnie.",
      tabAi: "Nie wiesz, co wybrać? Zapytaj AI",
      tabAiText: "Opisz problem w rozmowie — asystent dobierze kategorię i przygotuje zgłoszenie.",
      tablist: "Sposób wysłania zgłoszenia",
      category: "Kategoria zgłoszenia",
      subject: "Temat",
      subjectDefault: "Temat zgłoszenia",
      description: "Opis",
      descriptionReview: "Uwagi o wyglądzie, działaniu i jakości zapytań",
      descriptionDefault: "Opisz, w czym możemy pomóc.",
      overall: "Ocena ogólna",
      quality: "Trafność generowanych zapytań SQL (opcjonalnie)",
      ofFive: (n) => `${n} z 5`,
      email: "Adres e-mail do odpowiedzi (opcjonalnie)",
      privacy: (source) =>
        `Do zgłoszenia dołączymy adres podstrony, z której je wysyłasz${source ? ` (${source})` : ""}, oraz datę i godzinę. ` +
        "Bez adresu e-mail nie będziemy mogli odpowiedzieć. Nie wklejaj haseł, connection stringów ani danych z tabel — wystarczy opis struktury. " +
        "Dane służą wyłącznie do obsługi tego zgłoszenia. Szczegóły: ",
      privacyLink: "Polityka prywatności",
      privacyHref: "/privacy.html",
      send: "Wyślij zgłoszenie",
      sending: "Wysyłanie…",
      retry: "Spróbuj ponownie",
      fixFields: "Popraw zaznaczone pola.",
      network: "Nie udało się połączyć z serwerem. Twoje dane zostały w formularzu — spróbuj ponownie.",
      sentNote: "Przeczytamy je tak szybko, jak to możliwe. Jeśli podałeś adres e-mail, odpowiemy na niego.",
      another: "Wyślij kolejne zgłoszenie",
      trap: "Nie wypełniaj tego pola",
      errCategory: "Wybierz kategorię zgłoszenia.",
      errSubject: (max) => `Temat powinien mieć od 3 do ${max} znaków.`,
      errDescription: (max) => `Opis powinien mieć od 10 do ${max} znaków.`,
      errEmail: "Podaj prawidłowy adres e-mail albo zostaw pole puste.",
      errRating: "Wybierz ocenę ogólną od 1 do 5 gwiazdek.",
      greeting:
        "Cześć! Opisz własnymi słowami, w czym możemy pomóc — np. że wygenerowane zapytanie SQL jest błędne, schemat się nie wczytuje albo masz pomysł na nową funkcję. Dopytam tylko o to, co niezbędne, poproszę o Twój adres e-mail i wyślę zgłoszenie do autora AI-SQL-Chat (kopia trafi do Ciebie).",
      chatNote:
        "Rozmawiasz z asystentem AI. Treść rozmowy jest przetwarzana przez dostawcę modelu (OpenAI), więc nie podawaj haseł, danych logowania do bazy ani danych z tabel. Asystent nie generuje tu zapytań SQL i nie ma dostępu do Twojego konta ani schematów — przygotowuje tylko zgłoszenie i wysyła je, gdy podasz swój adres e-mail.",
      chatLog: "Rozmowa z asystentem AI",
      you: "Ty: ",
      assistant: "Asystent: ",
      typing: "Asystent pisze…",
      yourMessage: "Twoja wiadomość",
      chatSend: "Wyślij",
      useForm: "Wolę zwykły formularz",
      chatLimit: "Limit długości rozmowy został osiągnięty. Przejdź do zwykłego formularza.",
      chatNetwork: "Nie udało się połączyć z asystentem. Spróbuj ponownie albo skorzystaj ze zwykłego formularza.",
      chatSent: "Zgłoszenie zostało wysłane.",
      chatCopied: "Kopię wysłaliśmy na podany adres e-mail. Odpowiemy tą samą drogą.",
      chatNoCopy: "Zgłoszenie trafiło do autora AI-SQL-Chat.",
    },
    en: {
      loading: "Loading the form…",
      closed: "The contact form is temporarily unavailable. Please try again later.",
      tabForm: "Fill in the form",
      tabFormText: "Choose a category and describe the issue yourself.",
      tabAi: "Not sure what to pick? Ask the AI",
      tabAiText: "Describe the problem in a chat — the assistant will pick a category and prepare your message.",
      tablist: "How to send your message",
      category: "Category",
      subject: "Subject",
      subjectDefault: "Message subject",
      description: "Description",
      descriptionReview: "Comments on the look, behaviour and query quality",
      descriptionDefault: "Tell us how we can help.",
      overall: "Overall rating",
      quality: "Accuracy of generated SQL queries (optional)",
      ofFive: (n) => `${n} of 5`,
      email: "Reply-to email address (optional)",
      privacy: (source) =>
        `We will attach the page you are sending this from${source ? ` (${source})` : ""} and the date and time. ` +
        "Without an email address we can't reply. Don't paste passwords, connection strings or table data — a description of the structure is enough. " +
        "Your data is used only to handle this message. Details: ",
      privacyLink: "Privacy Policy",
      privacyHref: "/en/privacy.html",
      send: "Send message",
      sending: "Sending…",
      retry: "Try again",
      fixFields: "Please correct the highlighted fields.",
      network: "We couldn't reach the server. Your text is still in the form — please try again.",
      sentNote: "We'll read it as soon as we can. If you gave an email address, we'll reply to it.",
      another: "Send another message",
      trap: "Leave this field empty",
      errCategory: "Choose a category.",
      errSubject: (max) => `The subject should be 3–${max} characters long.`,
      errDescription: (max) => `The description should be 10–${max} characters long.`,
      errEmail: "Enter a valid email address or leave the field empty.",
      errRating: "Choose an overall rating from 1 to 5 stars.",
      greeting:
        "Hi! Tell us in your own words how we can help — e.g. a generated SQL query is wrong, your schema won't load, or you have an idea for a new feature. I'll only ask what's necessary, ask for your email address and send your message to the author of AI-SQL-Chat (you'll get a copy).",
      chatNote:
        "You're chatting with an AI assistant. The conversation is processed by the model provider (OpenAI), so don't share passwords, database credentials or table data. The assistant doesn't generate SQL here and has no access to your account or schemas — it only prepares your message and sends it once you give your email address.",
      chatLog: "Conversation with the AI assistant",
      you: "You: ",
      assistant: "Assistant: ",
      typing: "The assistant is typing…",
      yourMessage: "Your message",
      chatSend: "Send",
      useForm: "I'd rather use the form",
      chatLimit: "The conversation has reached its length limit. Please switch to the regular form.",
      chatNetwork: "We couldn't reach the assistant. Try again or use the regular form.",
      chatSent: "Your message has been sent.",
      chatCopied: "We've sent a copy to your email address. We'll reply the same way.",
      chatNoCopy: "Your message has reached the author of AI-SQL-Chat.",
    },
  }[lang];

  const EMAIL = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/u;

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) if (child) node.append(child);
    return node;
  }

  /** Podstrona źródłowa: parametr ?z= z linku, a bez niego ścieżka z Referer (tylko z tego serwisu). */
  function sourcePath() {
    const param = new URLSearchParams(location.search).get("z");
    let path = param && param.startsWith("/") && !param.startsWith("//") ? param : null;
    if (!path && document.referrer) {
      try {
        const ref = new URL(document.referrer);
        if (ref.host === location.host) path = ref.pathname;
      } catch {}
    }
    if (!path) return null;
    path = path.split(/[?#]/u)[0];
    return /\/kontakt(\.html)?$/u.test(path) || path.length > 200 ? null : path;
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ ...body, lang }),
    });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  async function start() {
    root.replaceChildren(el("p", { class: "sub", text: T.loading }));
    let config;
    try {
      const res = await fetch(`/api/contact/config?lang=${lang}`, { credentials: "same-origin", cache: "no-store" });
      config = await res.json();
    } catch {
      config = { open: false };
    }
    if (!config.open) {
      root.replaceChildren(el("p", { class: "contact-alert", role: "status", text: T.closed }));
      return;
    }
    render(config, sourcePath());
  }

  function render(config, source) {
    const panel = el("section", { class: "card contact-panel" });
    const formBox = el("div");
    const chatBox = el("div", { hidden: true });
    const form = buildForm(config, source, {});
    formBox.append(form.node);
    let currentForm = form;

    function select(mode) {
      formBox.hidden = mode !== "form";
      chatBox.hidden = mode !== "ai";
      tabForm.setAttribute("aria-selected", String(mode === "form"));
      tabAi?.setAttribute("aria-selected", String(mode === "ai"));
      panel.setAttribute("aria-labelledby", mode === "form" ? "kontakt-tab-form" : "kontakt-tab-ai");
    }

    const tab = (id, title, text, mode) =>
      el(
        "button",
        { id, type: "button", role: "tab", class: "contact-tab", "aria-selected": "false", onclick: () => select(mode) },
        el("span", { class: "contact-tab-title", text: title }),
        el("span", { class: "contact-tab-text", text }),
      );
    const tabForm = tab("kontakt-tab-form", T.tabForm, T.tabFormText, "form");
    const tabAi = config.ai ? tab("kontakt-tab-ai", T.tabAi, T.tabAiText, "ai") : null;

    // Szkic z rozmowy przenosimy do zwykłego formularza, żeby użytkownik nie pisał wszystkiego od nowa.
    function switchToForm(draft) {
      if (draft) {
        const next = buildForm(config, source, draft);
        currentForm.node.replaceWith(next.node);
        currentForm = next;
      }
      select("form");
    }

    if (config.ai) {
      chatBox.append(buildChat(config, source, switchToForm));
      panel.setAttribute("role", "tabpanel");
      root.replaceChildren(el("div", { class: "contact-tabs", role: "tablist", "aria-label": T.tablist }, tabForm, tabAi), panel);
    } else {
      root.replaceChildren(panel);
    }
    panel.append(formBox, chatBox);
    select("form");
  }

  // --- Zwykły formularz -----------------------------------------------------------------------------

  function buildForm(config, source, initial) {
    const values = { category: "", subject: "", description: "", email: "", ratingOverall: "", ratingQuality: "", extras: {}, ...initial };
    const byId = (id) => config.categories.find((c) => c.id === id) ?? null;
    let category = byId(values.category);
    let pending = false;
    const ratings = { ratingOverall: values.ratingOverall, ratingQuality: values.ratingQuality };

    const node = el("form", { class: "contact-form", novalidate: true });
    const alertBox = el("p", { class: "contact-alert", role: "alert", hidden: true });
    const errors = {};
    const fieldError = (key) => (errors[key] ??= el("span", { class: "contact-error", id: `form-${key}-error`, hidden: true }));

    function setError(key, message, input) {
      const box = fieldError(key);
      box.textContent = message ?? "";
      box.hidden = !message;
      if (input) {
        if (message) {
          input.setAttribute("aria-invalid", "true");
          input.setAttribute("aria-describedby", box.id);
        } else {
          input.removeAttribute("aria-invalid");
          input.removeAttribute("aria-describedby");
        }
      }
    }

    // Pułapka na boty: ukryta przed ludźmi i czytnikami ekranu.
    const trap = el("input", { name: "company_website", tabindex: "-1", autocomplete: "off" });
    const trapBox = el("div", { class: "contact-trap", "aria-hidden": "true" }, el("label", {}, T.trap, trap));

    const hint = el("p", { class: "sub" });
    const radios = config.categories.map((item, index) => {
      const input = el("input", {
        type: "radio",
        name: "category",
        value: item.id,
        id: index === 0 ? "form-category" : null,
        class: "sr-only",
        onchange: () => {
          category = item;
          setError("category", null);
          refreshCategory();
        },
      });
      input.checked = item.id === values.category;
      return el("label", { class: "contact-choice" }, input, el("span", { text: item.label }));
    });
    const categoryField = el(
      "fieldset",
      { class: "contact-field", "aria-describedby": "form-category-error" },
      el("legend", { text: T.category }),
      el("div", { class: "contact-choices" }, radios),
      hint,
      fieldError("category"),
    );

    const subject = el("input", { class: "input", id: "form-subject", name: "subject", maxlength: String(config.limits.subjectMax), required: true });
    subject.value = values.subject;
    subject.addEventListener("input", () => setError("subject", null, subject));
    const subjectField = el("label", { class: "contact-field" }, el("span", { text: T.subject }), subject, fieldError("subject"));

    const ratingBox = el("div", { class: "contact-ratings" });
    function starRating(key, label, required) {
      const wrap = el("div", { class: "contact-field", role: "radiogroup", "aria-label": label });
      const count = el("span", { class: "sub" });
      const buttons = [1, 2, 3, 4, 5].map((star) =>
        el("button", {
          type: "button",
          role: "radio",
          id: star === 1 ? `form-${key}` : null,
          class: "contact-star",
          "aria-label": T.ofFive(star),
          onclick: () => {
            const current = Number(ratings[key]) || 0;
            ratings[key] = !required && current === star ? "" : String(star);
            setError(key, null);
            paint();
          },
        }),
      );
      function paint() {
        const current = Number(ratings[key]) || 0;
        buttons.forEach((button, index) => {
          button.textContent = index < current ? "★" : "☆";
          button.classList.toggle("is-on", index < current);
          button.setAttribute("aria-checked", String(current === index + 1));
        });
        count.textContent = current ? T.ofFive(current) : "";
      }
      paint();
      wrap.append(el("span", { "aria-hidden": "true", text: label }), el("div", { class: "contact-stars" }, buttons), count, fieldError(key));
      return wrap;
    }
    ratingBox.append(starRating("ratingOverall", T.overall, true), starRating("ratingQuality", T.quality, false));

    const descriptionLabel = el("span");
    const description = el("textarea", { class: "input", id: "form-description", name: "description", rows: "6", maxlength: String(config.limits.descriptionMax), required: true });
    description.value = values.description;
    description.addEventListener("input", () => setError("description", null, description));
    const descriptionField = el("label", { class: "contact-field" }, descriptionLabel, description, fieldError("description"));

    const extrasBox = el("div", { class: "contact-extras" });
    const extraInputs = {};

    const email = el("input", { class: "input", id: "form-email", name: "email", type: "email", autocomplete: "email", maxlength: "320" });
    email.value = values.email;
    email.addEventListener("input", () => setError("email", null, email));
    const emailField = el("label", { class: "contact-field" }, el("span", { text: T.email }), email, fieldError("email"));

    const submit = el("button", { type: "submit", class: "btn btn-primary", text: T.send });

    function refreshCategory() {
      hint.textContent = category?.hint ?? "";
      hint.hidden = !category;
      subject.placeholder = category?.subjectPlaceholder ?? T.subjectDefault;
      description.placeholder = category?.descriptionPlaceholder ?? T.descriptionDefault;
      descriptionLabel.textContent = category?.id === "review" ? T.descriptionReview : T.description;
      ratingBox.hidden = category?.id !== "review";
      for (const key of Object.keys(extraInputs)) values.extras[key] = extraInputs[key].value;
      extrasBox.replaceChildren();
      for (const key of Object.keys(extraInputs)) delete extraInputs[key];
      for (const extra of category?.extras ?? []) {
        const input = extra.multiline
          ? el("textarea", { class: "input", rows: "3", maxlength: "500", id: `form-extra_${extra.key}`, placeholder: extra.placeholder })
          : el("input", { class: "input", maxlength: "500", id: `form-extra_${extra.key}`, placeholder: extra.placeholder });
        input.value = values.extras[extra.key] ?? "";
        extraInputs[extra.key] = input;
        extrasBox.append(el("label", { class: "contact-field" }, el("span", { text: extra.label }), input, fieldError(`extra_${extra.key}`)));
      }
    }
    refreshCategory();

    function collect() {
      const extras = {};
      for (const [key, input] of Object.entries(extraInputs)) extras[key] = input.value;
      return {
        category: category?.id ?? "",
        subject: subject.value,
        description: description.value,
        email: email.value,
        ratingOverall: category?.id === "review" ? ratings.ratingOverall : "",
        ratingQuality: category?.id === "review" ? ratings.ratingQuality : "",
        extras,
        source: source ?? "",
        token: config.token,
        submissionId: config.submissionId,
        company_website: trap.value,
      };
    }

    const inputs = { subject, description, email };
    function showErrors(map) {
      for (const key of Object.keys(errors)) setError(key, null, inputs[key] ?? extraInputs[key.replace(/^extra_/u, "")]);
      for (const [key, message] of Object.entries(map)) setError(key, message, inputs[key] ?? extraInputs[key.replace(/^extra_/u, "")]);
      const first = Object.keys(map)[0];
      if (first) document.getElementById(`form-${first}`)?.focus();
    }

    function validate(data) {
      const map = {};
      if (!data.category) map.category = T.errCategory;
      const subjectLength = data.subject.trim().replace(/\s+/gu, " ").length;
      if (subjectLength < 3 || subjectLength > config.limits.subjectMax) map.subject = T.errSubject(config.limits.subjectMax);
      const descriptionLength = data.description.trim().length;
      if (descriptionLength < 10 || descriptionLength > config.limits.descriptionMax) map.description = T.errDescription(config.limits.descriptionMax);
      if (data.email.trim() !== "" && !EMAIL.test(data.email.trim())) map.email = T.errEmail;
      if (data.category === "review" && !data.ratingOverall) map.ratingOverall = T.errRating;
      return map;
    }

    node.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (pending) return;
      const data = collect();
      const local = validate(data);
      alertBox.hidden = true;
      if (Object.keys(local).length > 0) {
        showErrors(local);
        return;
      }
      showErrors({});
      pending = true;
      submit.disabled = true;
      submit.textContent = T.sending;
      let result;
      try {
        result = await postJson("/api/contact/submit", data);
      } catch {
        result = { status: "error", message: T.network };
      }
      pending = false;
      submit.disabled = false;
      submit.textContent = T.send;
      if (result.status === "sent") {
        node.replaceWith(sentBox(result.message));
        return;
      }
      if (result.status === "invalid") showErrors(result.errors ?? {});
      alertBox.textContent = result.message || T.fixFields;
      alertBox.hidden = false;
      if (result.status === "error") submit.textContent = T.retry;
    });

    const privacy = el(
      "p",
      { class: "note" },
      T.privacy(source),
      el("a", { href: T.privacyHref, target: "_blank", text: T.privacyLink }),
      ".",
    );

    node.append(alertBox, trapBox, categoryField, subjectField, ratingBox, descriptionField, extrasBox, emailField, privacy, el("div", { class: "contact-actions" }, submit));
    return { node };
  }

  function sentBox(message) {
    const again = location.pathname + (location.search.includes("z=") ? location.search : "");
    return el(
      "div",
      { class: "contact-sent", role: "status" },
      el("p", { class: "contact-sent-title", text: `✓ ${message}` }),
      el("p", { class: "sub", text: T.sentNote }),
      el("button", { type: "button", class: "btn btn-secondary", text: T.another, onclick: () => location.assign(again) }),
    );
  }

  // --- Rozmowa z asystentem AI ----------------------------------------------------------------------

  function buildChat(config, source, onUseForm) {
    const messages = [];
    let busy = false;
    let draft = null;
    let sent = false;

    const log = el("div", { class: "contact-log", role: "log", "aria-live": "polite", "aria-label": T.chatLog });
    const status = el("div");
    const input = el("textarea", { class: "input", rows: "3", maxlength: String(config.limits.chatMessageMax) });
    const sendButton = el("button", { type: "submit", class: "btn btn-primary", text: T.chatSend });
    const limitNote = el("p", { class: "sub", text: T.chatLimit, hidden: true });
    const form = el(
      "form",
      { class: "contact-chat-form" },
      el("label", { class: "contact-field" }, el("span", { text: T.yourMessage }), input),
      limitNote,
      el(
        "div",
        { class: "contact-actions" },
        sendButton,
        el("button", { type: "button", class: "contact-link", text: T.useForm, onclick: () => onUseForm(draft) }),
      ),
    );

    function bubble(role, text) {
      const mine = role === "user";
      return el(
        "div",
        { class: `contact-bubble-row${mine ? " is-mine" : ""}` },
        el("p", { class: "contact-bubble" }, el("span", { class: "sr-only", text: mine ? T.you : T.assistant }), text),
      );
    }

    function paint(error) {
      log.replaceChildren(bubble("assistant", T.greeting), ...messages.map((m) => bubble(m.role, m.content)));
      if (busy) log.append(el("p", { class: "sub", role: "status", text: T.typing }));
      if (error) {
        const last = messages[messages.length - 1];
        log.append(
          el(
            "div",
            { class: "contact-alert", role: "alert" },
            el("p", { text: error }),
            last?.role === "user" ? el("button", { type: "button", class: "btn btn-ghost", text: T.retry, onclick: () => run() }) : null,
          ),
        );
      }
      log.scrollTop = log.scrollHeight;
      const userCount = messages.filter((m) => m.role === "user").length;
      const limitReached = userCount >= config.limits.chatUserMessages;
      limitNote.hidden = !limitReached;
      input.disabled = busy || limitReached || sent;
      sendButton.disabled = busy || limitReached || input.value.trim() === "";
      sendButton.textContent = busy ? T.sending : T.chatSend;
    }

    async function run() {
      busy = true;
      paint();
      let error = null;
      try {
        const result = await postJson("/api/contact/ai", {
          token: config.token,
          messages,
          submissionId: config.submissionId,
          source: source ?? "",
        });
        if (!result.ok) {
          error = result.message;
        } else {
          messages.push({ role: "assistant", content: result.turn.reply });
          // Szkic (nawet niepełny) zostaje, żeby „Wolę zwykły formularz” nie gubił rozmowy.
          if (result.turn.draft.category) draft = result.turn.draft;
          if (result.sent) {
            sent = true;
            form.replaceWith(
              el(
                "div",
                { class: "contact-sent", role: "status" },
                el("p", { class: "contact-sent-title", text: T.chatSent }),
                el("p", { class: "sub", text: result.copied ? T.chatCopied : T.chatNoCopy }),
              ),
            );
          }
        }
      } catch {
        error = T.chatNetwork;
      }
      busy = false;
      paint(error);
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || busy || sent || sendButton.disabled) return;
      // Po błędzie ostatnia wiadomość użytkownika czeka bez odpowiedzi — dopisujemy do niej, żeby role się przeplatały.
      const last = messages[messages.length - 1];
      if (last?.role === "user") last.content = `${last.content}\n${text}`.slice(0, config.limits.chatMessageMax);
      else messages.push({ role: "user", content: text });
      input.value = "";
      void run();
    });
    input.addEventListener("input", () => paint());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    paint();
    return el("div", { class: "contact-chat" }, el("p", { class: "note", text: T.chatNote }), log, form);
  }

  start();
})();
