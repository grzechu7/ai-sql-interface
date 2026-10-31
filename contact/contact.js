// Zgłoszenia z zakładki Kontakt (port z STALENO): kategorie, walidacja, token formularza, limity i treść e-maili.
// Czyste funkcje bez Express, żeby dało się je testować; trasy są w contact.routes.js.

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 120;
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 2_000;
export const EXTRA_MAX = 500;
export const SOURCE_MAX = 200;

export const CHAT_MAX_USER_MESSAGES = 10;
export const CHAT_MAX_MESSAGE_CHARS = 1_000;
export const CHAT_MAX_REPLY_CHARS = 1_200;

const MIN_FORM_AGE_MS = 2_000;
const MAX_FORM_AGE_MS = 60 * 60 * 1000;
const NONCE_PATTERN = /^[0-9a-f]{16}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export const LANGS = ["pl", "en"];
export function parseLang(raw) {
  return raw === "en" ? "en" : "pl";
}

// Teksty kategorii w obu językach; serwis ma wersję polską i angielską (/en).
export const CONTACT_CATEGORIES = [
  {
    id: "generator",
    label: { pl: "Generator SQL i Optimizer", en: "SQL Generator & Optimizer" },
    hint: {
      pl: "Wygenerowane zapytanie jest błędne, używa złych kolumn albo Optimizer zmienił sens kodu.",
      en: "The generated query is wrong, uses the wrong columns, or the Optimizer changed what the code does.",
    },
    subjectPlaceholder: { pl: "np. Zły JOIN między orders i customers", en: "e.g. Wrong JOIN between orders and customers" },
    descriptionPlaceholder: {
      pl: "Co wpisałeś, jakie zapytanie dostałeś i czego się spodziewałeś? Nie wklejaj danych z bazy.",
      en: "What did you type, what query did you get and what did you expect? Do not paste data from your database.",
    },
    extras: [
      {
        key: "question",
        label: { pl: "Pytanie w języku naturalnym (opcjonalnie)", en: "Your natural-language question (optional)" },
        placeholder: { pl: "np. pokaż 10 ostatnich zamówień klientów z Warszawy", en: "e.g. show the last 10 orders from customers in London" },
        multiline: true,
      },
      {
        key: "dialect",
        label: { pl: "Baza danych (opcjonalnie)", en: "Database (optional)" },
        placeholder: { pl: "np. PostgreSQL 16, MySQL 8, Oracle", en: "e.g. PostgreSQL 16, MySQL 8, Oracle" },
      },
    ],
  },
  {
    id: "schema",
    label: { pl: "Schemat bazy i import", en: "Database schema & import" },
    hint: {
      pl: "Problem z wgraniem lub wklejeniem schematu, konwersją CREATE TABLE do JSON albo listą schematów na koncie.",
      en: "Trouble uploading or pasting a schema, converting CREATE TABLE to JSON, or the schema list in your account.",
    },
    subjectPlaceholder: { pl: "np. Plik .sql z pg_dump nie wczytuje się", en: "e.g. A .sql file from pg_dump won't load" },
    descriptionPlaceholder: {
      pl: "Na której stronie to się stało i jaki komunikat zobaczyłeś? Wystarczy opis struktury, bez danych.",
      en: "Which page were you on and what message did you see? A description of the structure is enough, no data.",
    },
    extras: [
      {
        key: "format",
        label: { pl: "Format i źródło schematu (opcjonalnie)", en: "Schema format and source (optional)" },
        placeholder: { pl: "np. CREATE TABLE z MySQL Workbench, JSON", en: "e.g. CREATE TABLE from MySQL Workbench, JSON" },
      },
    ],
  },
  {
    id: "account",
    label: { pl: "Konto i logowanie", en: "Account & login" },
    hint: {
      pl: "Rejestracja, logowanie (także przez Google), wylogowywanie albo usunięcie konta.",
      en: "Sign-up, login (including Google), being logged out, or deleting your account.",
    },
    subjectPlaceholder: { pl: "np. Logowanie przez Google wraca na stronę logowania", en: "e.g. Google login sends me back to the login page" },
    descriptionPlaceholder: {
      pl: "Co próbujesz zrobić i co się dzieje? Nigdy nie podawaj hasła.",
      en: "What are you trying to do and what happens? Never share your password.",
    },
    extras: [],
  },
  {
    id: "feature",
    label: { pl: "Pomysł na nową funkcję", en: "Feature idea" },
    hint: {
      pl: "Czego brakuje w AI-SQL-Chat — np. nowy dialekt SQL, eksport wyników, historia zapytań.",
      en: "What AI-SQL-Chat is missing — e.g. a new SQL dialect, result export, query history.",
    },
    subjectPlaceholder: { pl: "np. Obsługa MS SQL Server (T-SQL)", en: "e.g. Support for MS SQL Server (T-SQL)" },
    descriptionPlaceholder: {
      pl: "Opisz pomysł, problem, który rozwiązuje, i kiedy byś z niego korzystał.",
      en: "Describe the idea, the problem it solves and when you would use it.",
    },
    extras: [],
  },
  {
    id: "review",
    label: { pl: "Ocena narzędzia", en: "Rate the tool" },
    hint: {
      pl: "Oceń AI-SQL-Chat i podziel się uwagami o wyglądzie, działaniu i jakości zapytań.",
      en: "Rate AI-SQL-Chat and share your thoughts on its look, how it works and query quality.",
    },
    subjectPlaceholder: { pl: "np. Opinia o generatorze", en: "e.g. Feedback on the generator" },
    descriptionPlaceholder: { pl: "Krótko: co ci się podoba, a co przeszkadza?", en: "Briefly: what do you like and what gets in the way?" },
    extras: [],
  },
  {
    id: "partnership",
    label: { pl: "Współpraca i wdrożenie w firmie", en: "Partnership & business use" },
    hint: {
      pl: "Chcesz użyć AI-SQL-Chat w firmie, na własnej bazie lub zaproponować współpracę.",
      en: "You want to use AI-SQL-Chat in your company, on your own database, or propose a partnership.",
    },
    subjectPlaceholder: { pl: "np. Wdrożenie dla działu raportowania", en: "e.g. Rollout for our reporting team" },
    descriptionPlaceholder: {
      pl: "Czym zajmuje się firma, jakiej bazy używacie i czego potrzebujecie?",
      en: "What does your company do, which database do you use and what do you need?",
    },
    extras: [
      { key: "company", label: { pl: "Nazwa firmy", en: "Company name" }, placeholder: { pl: "np. Dane i Raporty sp. z o.o.", en: "e.g. Data & Reports Ltd" } },
      {
        key: "site",
        label: { pl: "Strona internetowa (opcjonalnie)", en: "Website (optional)" },
        placeholder: { pl: "https://…", en: "https://…" },
      },
    ],
  },
  {
    id: "bug",
    label: { pl: "Błąd techniczny", en: "Technical bug" },
    hint: {
      pl: "Coś nie działa, wyświetla się źle albo strona zgłasza błąd.",
      en: "Something doesn't work, looks broken, or the site shows an error.",
    },
    subjectPlaceholder: { pl: "np. Przycisk „Generuj SQL” nie reaguje", en: "e.g. The “Generate SQL” button does nothing" },
    descriptionPlaceholder: { pl: "Co się stało i czego się spodziewałeś?", en: "What happened and what did you expect?" },
    extras: [
      {
        key: "device",
        label: { pl: "Przeglądarka i urządzenie (opcjonalnie)", en: "Browser and device (optional)" },
        placeholder: { pl: "np. Chrome na Windows 11", en: "e.g. Chrome on Windows 11" },
      },
      {
        key: "steps",
        label: { pl: "Kroki prowadzące do błędu (opcjonalnie)", en: "Steps to reproduce (optional)" },
        placeholder: { pl: "1. … 2. …", en: "1. … 2. …" },
        multiline: true,
      },
    ],
  },
  {
    id: "other",
    label: { pl: "Inny temat", en: "Something else" },
    hint: { pl: "Wszystko, co nie pasuje do pozostałych kategorii.", en: "Anything that doesn't fit the other categories." },
    subjectPlaceholder: { pl: "Temat wiadomości", en: "Message subject" },
    descriptionPlaceholder: { pl: "Opisz, w czym możemy pomóc.", en: "Tell us how we can help." },
    extras: [],
  },
];

export const CONTACT_CATEGORY_IDS = CONTACT_CATEGORIES.map((category) => category.id);

export const CONTACT_ERRORS = {
  pl: {
    category: "Wybierz kategorię zgłoszenia.",
    subject: `Temat powinien mieć od ${SUBJECT_MIN} do ${SUBJECT_MAX} znaków.`,
    description: `Opis powinien mieć od ${DESCRIPTION_MIN} do ${DESCRIPTION_MAX} znaków.`,
    email: "Podaj prawidłowy adres e-mail albo zostaw pole puste.",
    ratingOverall: "Wybierz ocenę ogólną od 1 do 5 gwiazdek.",
    ratingQuality: "Ocena trafności zapytań musi być liczbą od 1 do 5.",
    extra: `Pole może mieć najwyżej ${EXTRA_MAX} znaków i nie może zawierać znaków sterujących.`,
  },
  en: {
    category: "Choose a category.",
    subject: `The subject should be ${SUBJECT_MIN}–${SUBJECT_MAX} characters long.`,
    description: `The description should be ${DESCRIPTION_MIN}–${DESCRIPTION_MAX} characters long.`,
    email: "Enter a valid email address or leave the field empty.",
    ratingOverall: "Choose an overall rating from 1 to 5 stars.",
    ratingQuality: "The query accuracy rating must be a number from 1 to 5.",
    extra: `This field may have at most ${EXTRA_MAX} characters and no control characters.`,
  },
};

/** Kategorie bez funkcji, w jednym języku — dla przeglądarki (GET /api/contact/config). */
export function publicCategories(lang) {
  return CONTACT_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label[lang],
    hint: category.hint[lang],
    subjectPlaceholder: category.subjectPlaceholder[lang],
    descriptionPlaceholder: category.descriptionPlaceholder[lang],
    extras: category.extras.map((extra) => ({
      key: extra.key,
      label: extra.label[lang],
      placeholder: extra.placeholder[lang],
      multiline: extra.multiline === true,
    })),
  }));
}

export function contactCategory(id) {
  return CONTACT_CATEGORIES.find((category) => category.id === id) ?? null;
}

export function hasDisallowedControls(value, allowNewlines) {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0 || code === 127) return true;
    if (code < 32) {
      if (allowNewlines && (char === "\n" || char === "\r" || char === "\t")) continue;
      return true;
    }
  }
  return false;
}

function collapseSpaces(value) {
  return value.trim().replace(/\s+/gu, " ");
}

function str(value) {
  return typeof value === "string" ? value : "";
}

/** Podstrona źródłowa: wyłącznie ścieżka wewnętrzna; zapytanie i kotwica są odrzucane (mogą zawierać dane osobowe). */
export function parseSourcePath(raw) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > SOURCE_MAX * 2) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (hasDisallowedControls(value, false) || /\s/u.test(value)) return null;
  const path = value.split(/[?#]/u)[0];
  if (path.length === 0 || path.length > SOURCE_MAX) return null;
  return path;
}

function parseRating(raw) {
  const value = str(raw).trim();
  if (value === "") return null;
  return /^[1-5]$/u.test(value) ? Number(value) : undefined;
}

function parseSubject(raw) {
  const value = collapseSpaces(str(raw));
  if (value.length < SUBJECT_MIN || value.length > SUBJECT_MAX) return null;
  if (hasDisallowedControls(value, false)) return null;
  return value;
}

function parseDescription(raw) {
  const value = str(raw).trim();
  if (value.length < DESCRIPTION_MIN || value.length > DESCRIPTION_MAX) return null;
  if (hasDisallowedControls(value, true)) return null;
  return value;
}

function parseExtra(raw, multiline) {
  const value = multiline ? str(raw).trim() : collapseSpaces(str(raw));
  if (value === "") return null;
  if (value.length > EXTRA_MAX || hasDisallowedControls(value, multiline)) return undefined;
  return value;
}

/** Adres do odpowiedzi trafia do nagłówka Reply-To, więc odrzucamy cudzysłowy i nawiasy kątowe. */
function parseReplyEmail(raw) {
  const value = str(raw).trim();
  if (value === "") return null;
  if (value.length < 3 || value.length > 320 || hasDisallowedControls(value, false)) return undefined;
  if (!EMAIL_PATTERN.test(value) || /[<>",;]/u.test(value)) return undefined;
  return value;
}

/**
 * draft: { category, subject, description, email, ratingOverall, ratingQuality, extras, source, aiAssisted, trap, lang }
 * Wynik: { kind: "spam" } | { kind: "invalid", errors } | { kind: "valid", value }
 */
export function parseContact(draft) {
  const lang = parseLang(draft.lang);
  const messages = CONTACT_ERRORS[lang];
  if (str(draft.trap).trim() !== "") return { kind: "spam" };

  const errors = {};
  const category = contactCategory(str(draft.category));
  if (!category) errors.category = messages.category;

  const subject = parseSubject(draft.subject);
  if (!subject) errors.subject = messages.subject;

  const description = parseDescription(draft.description);
  if (!description) errors.description = messages.description;

  const email = parseReplyEmail(draft.email);
  if (email === undefined) errors.email = messages.email;

  let ratingOverall = null;
  let ratingQuality = null;
  if (category?.id === "review") {
    const overall = parseRating(draft.ratingOverall);
    if (overall === undefined || overall === null) errors.ratingOverall = messages.ratingOverall;
    else ratingOverall = overall;
    const quality = parseRating(draft.ratingQuality);
    if (quality === undefined) errors.ratingQuality = messages.ratingQuality;
    else ratingQuality = quality;
  }

  const extras = draft.extras && typeof draft.extras === "object" ? draft.extras : {};
  const details = [];
  for (const extra of category?.extras ?? []) {
    const value = parseExtra(extras[extra.key], extra.multiline === true);
    if (value === undefined) errors[`extra_${extra.key}`] = messages.extra;
    // W mailu do obsługi etykiety są po polsku.
    else if (value !== null) details.push({ label: extra.label.pl.replace(/\s*\(opcjonalnie\)$/u, ""), value });
  }

  if (Object.keys(errors).length > 0) return { kind: "invalid", errors };

  return {
    kind: "valid",
    value: {
      category,
      subject,
      description,
      email,
      ratingOverall,
      ratingQuality,
      details,
      sourcePath: parseSourcePath(draft.source),
      aiAssisted: draft.aiAssisted === true,
      lang,
    },
  };
}

// --- Token formularza (HMAC, ważny od 2 s do 1 h) -----------------------------------------------

/** Klucz z CONTACT_FORM_SECRET, a bez niego z SESSION_SECRET — ten sam po restarcie procesu. */
export function deriveContactKey(env = process.env) {
  const secret = env.CONTACT_FORM_SECRET?.trim() || env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 16) return null;
  return createHmac("sha256", secret).update("aisql/contact-form-token/v1").digest();
}

export function issueContactToken(key, nowMs = Date.now()) {
  const body = Buffer.from(JSON.stringify({ t: nowMs, n: randomBytes(8).toString("hex") }), "utf8").toString("base64url");
  const mac = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${mac}`;
}

/** "ok" | "invalid" | "too-fast" | "expired" */
export function readContactToken(token, nowMs, key) {
  if (typeof token !== "string" || token.length === 0 || token.length > 512) return "invalid";
  const parts = token.split(".");
  if (parts.length !== 2) return "invalid";
  const [body, macText] = parts;
  if (!/^[A-Za-z0-9_-]+$/u.test(body) || !/^[A-Za-z0-9_-]+$/u.test(macText)) return "invalid";
  const actual = Buffer.from(macText, "base64url");
  const expected = createHmac("sha256", key).update(body).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return "invalid";
  let record;
  try {
    record = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return "invalid";
  }
  if (!record || typeof record !== "object" || Object.keys(record).length !== 2) return "invalid";
  if (!Number.isSafeInteger(record.t) || typeof record.n !== "string" || !NONCE_PATTERN.test(record.n)) return "invalid";
  const age = nowMs - record.t;
  if (age < 0) return "invalid";
  if (age < MIN_FORM_AGE_MS) return "too-fast";
  if (age > MAX_FORM_AGE_MS) return "expired";
  return "ok";
}

export function newSubmissionId() {
  return randomUUID();
}

const SUBMISSION_ID = /^[A-Za-z0-9_-]{16,64}$/u;
export function parseSubmissionId(raw) {
  return typeof raw === "string" && SUBMISSION_ID.test(raw) ? raw : null;
}

// --- Limity w pamięci procesu (PM2 uruchamia jedną instancję) ------------------------------------

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function rateWindow(limit, windowMs) {
  return { limit, windowMs, hits: new Map() };
}

function takeRateSlot(window, key, nowMs) {
  const threshold = nowMs - window.windowMs;
  const recent = (window.hits.get(key) ?? []).filter((stamp) => stamp > threshold);
  if (window.hits.size > 2_000) {
    for (const [bucket, stamps] of window.hits) {
      if (stamps.every((stamp) => stamp <= threshold)) window.hits.delete(bucket);
    }
  }
  if (recent.length >= window.limit) {
    window.hits.set(key, recent);
    return false;
  }
  recent.push(nowMs);
  window.hits.set(key, recent);
  return true;
}

export function createContactLimiter() {
  const attemptIp = rateWindow(8, 10 * MINUTE);
  const attemptNetwork = rateWindow(30, 10 * MINUTE);
  const sendIp = rateWindow(5, DAY);
  const sendAll = rateWindow(200, DAY);
  const aiIp = rateWindow(30, HOUR);
  const aiNetwork = rateWindow(100, HOUR);
  const aiAll = rateWindow(1_000, DAY);
  return {
    /** Każda próba wysłania (także odrzucona) zajmuje miejsce w limicie adresu i sieci. */
    allowAttempt(origin, nowMs) {
      const ip = takeRateSlot(attemptIp, origin.ip, nowMs);
      const network = takeRateSlot(attemptNetwork, origin.network, nowMs);
      return ip && network;
    },
    /** Tylko poprawne zgłoszenia tuż przed wysyłką: dzienny limit adresu i limit całego serwisu. */
    allowSend(origin, nowMs) {
      const ip = takeRateSlot(sendIp, origin.ip, nowMs);
      return ip && takeRateSlot(sendAll, "all", nowMs);
    },
    /** Tura rozmowy z AI: limit adresu, sieci i dzienny limit kosztów całego serwisu. */
    allowAiTurn(origin, nowMs) {
      const ip = takeRateSlot(aiIp, origin.ip, nowMs);
      const network = takeRateSlot(aiNetwork, origin.network, nowMs);
      return ip && network && takeRateSlot(aiAll, "all", nowMs);
    },
  };
}

function normalizedIp(raw) {
  const value = str(raw).trim().toLowerCase();
  if (value.length === 0 || value.length > 64 || isIP(value) === 0) return null;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/u.exec(value);
  return mapped && isIP(mapped[1]) === 4 ? mapped[1] : value;
}

/** Nginx nadpisuje X-Real-IP adresem połączenia; aplikacja nasłuchuje tylko na 127.0.0.1. */
export function requestOrigin(req) {
  const ip = normalizedIp(req.get("x-real-ip")) ?? normalizedIp(req.socket?.remoteAddress);
  if (!ip) return { ip: "unknown", network: "unknown" };
  if (isIP(ip) === 4) return { ip, network: `${ip.split(".").slice(0, 3).join(".")}.0/24` };
  return { ip, network: `${ip.split(":").slice(0, 4).join(":")}::/64` };
}

// --- Treść e-maili --------------------------------------------------------------------------------

export const AI_MARK = "Zgłoszenie przygotowane z pomocą asystenta AI.";

function escapeHtml(value) {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

const DATE_FORMAT = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Temat: [AI-SQL-Chat] [Kategoria] [Temat zgłoszenia]. Nawiasy kwadratowe z tematu użytkownika zamieniamy na okrągłe. */
export function contactSubject(submission) {
  const subject = submission.subject.replace(/\[/gu, "(").replace(/\]/gu, ")");
  return `[AI-SQL-Chat] [${submission.category.label.pl}] [${subject}]`;
}

function stars(value) {
  return value === null ? null : `${value}/5 ${"★".repeat(value)}${"☆".repeat(5 - value)}`;
}

const MAIL_TEXT = {
  pl: {
    category: "Kategoria",
    subject: "Temat",
    date: "Data zgłoszenia",
    page: "Podstrona",
    unknown: "nieznana",
    email: "E-mail do odpowiedzi",
    noEmail: "nie podano",
    lang: "Wersja strony",
    overall: "Ocena ogólna",
    quality: "Trafność zapytań SQL",
    description: "Opis",
    reviewDescription: "Uwagi i propozycje zmian",
    transcript: "Pełna treść rozmowy z asystentem AI",
    user: "Klient",
    assistant: "Asystent",
    heading: "Nowe zgłoszenie z formularza kontaktowego",
    copyHeading: "Kopia Twojego zgłoszenia",
    copyIntro: "Dziękujemy za kontakt z AI-SQL-Chat. Twoje zgłoszenie trafiło do administratora — poniżej jego kopia.",
    copySubject: "Kopia zgłoszenia",
    dateSuffix: "(czas polski)",
  },
  en: {
    category: "Category",
    subject: "Subject",
    date: "Sent at",
    page: "Page",
    unknown: "unknown",
    email: "Reply-to email",
    noEmail: "not provided",
    lang: "Site version",
    overall: "Overall rating",
    quality: "SQL query accuracy",
    description: "Description",
    reviewDescription: "Comments and suggestions",
    transcript: "Full conversation with the AI assistant",
    user: "You",
    assistant: "Assistant",
    heading: "New contact form message",
    copyHeading: "A copy of your message",
    copyIntro: "Thank you for contacting AI-SQL-Chat. Your message has reached the administrator — here is a copy.",
    copySubject: "Copy of your message",
    dateSuffix: "(Polish time)",
  },
};

/** lang = język maila: do obsługi zawsze "pl", kopia dla klienta w języku strony, z której pisał. */
export function contactMail(submission, { receivedAt, siteBase, transcript = [], lang = "pl" }) {
  const t = MAIL_TEXT[lang];
  const sourceUrl = submission.sourcePath ? new URL(submission.sourcePath, siteBase).toString() : null;
  const rows = [
    [t.category, submission.category.label[lang]],
    [t.subject, submission.subject],
    [t.date, `${DATE_FORMAT.format(receivedAt)} ${t.dateSuffix}`],
    [t.page, sourceUrl ?? t.unknown],
    [t.email, submission.email ?? t.noEmail],
    [t.lang, submission.lang === "en" ? "EN" : "PL"],
    [t.overall, stars(submission.ratingOverall)],
    [t.quality, stars(submission.ratingQuality)],
    ...submission.details.map((detail) => [detail.label, detail.value]),
  ].filter((row) => row[1] !== null);
  const descriptionTitle = submission.category.id === "review" ? t.reviewDescription : t.description;
  const speaker = (role) => (role === "user" ? t.user : t.assistant);

  const text = [
    ...(submission.aiAssisted ? [AI_MARK, ""] : []),
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    `${descriptionTitle}:`,
    submission.description,
    ...(transcript.length > 0 ? ["", `${t.transcript}:`, ...transcript.map((m) => `${speaker(m.role)}: ${m.content}`)] : []),
  ].join("\n");

  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#5b6472;vertical-align:top">${escapeHtml(label)}</td>` +
        `<td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const banner = submission.aiAssisted
    ? `<p style="font-size:13px;background:#eef4ff;border-radius:6px;padding:8px 12px">${escapeHtml(AI_MARK)}</p>`
    : "";
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#0b1f3a;max-width:600px">` +
    `<p style="font-size:12px;letter-spacing:2px;color:#2563eb;font-weight:bold">AI-SQL-CHAT</p>` +
    `<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(t.heading)}</h1>${banner}` +
    `<table style="border-collapse:collapse;font-size:14px">${table}</table>` +
    `<h2 style="font-size:15px;margin:20px 0 6px">${escapeHtml(descriptionTitle)}</h2>` +
    `<p style="font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(submission.description)}</p>` +
    (transcript.length > 0
      ? `<h2 style="font-size:15px;margin:20px 0 6px">${escapeHtml(t.transcript)}</h2>` +
        transcript
          .map(
            (m) =>
              `<p style="font-size:14px;line-height:1.5;white-space:pre-wrap;margin:0 0 8px">` +
              `<strong>${escapeHtml(speaker(m.role))}:</strong> ${escapeHtml(m.content)}</p>`,
          )
          .join("")
      : "") +
    `</div>`;

  return { subject: contactSubject(submission), text, html };
}

/** Kopia zgłoszenia dla klienta: ta sama treść w języku strony, bez adresu obsługi. */
export function contactCopyMail(submission, context) {
  const lang = submission.lang;
  const t = MAIL_TEXT[lang];
  const original = contactMail({ ...submission, aiAssisted: false }, { ...context, lang });
  const html = original.html
    .replace(escapeHtml(t.heading), escapeHtml(t.copyHeading))
    .replace("</h1>", `</h1><p style="font-size:14px">${escapeHtml(t.copyIntro)}</p>`);
  return { subject: `${t.copySubject}: ${contactSubject(submission)}`, text: `${t.copyIntro}\n\n${original.text}`, html };
}

// --- Wysyłka przez Resend --------------------------------------------------------------------------

export function parseMailConfig(env = process.env) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.CONTACT_MAIL_FROM?.trim() || env.MAIL_FROM?.trim();
  const to = env.CONTACT_RECIPIENT?.trim();
  if (!apiKey || !apiKey.startsWith("re_") || !from || !to || !EMAIL_PATTERN.test(to)) return null;
  return { apiKey, from, to };
}

/** Zwraca true, gdy Resend przyjął wiadomość. Treści ani adresu nie zapisuje w logach. */
export async function sendMail(config, message) {
  const headers = { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" };
  if (message.idempotencyKey) headers["Idempotency-Key"] = message.idempotencyKey;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Kontakt: Resend odrzucił wiadomość.", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Kontakt: wysyłka e-maila nie powiodła się.", error instanceof Error ? error.name : "unknown");
    return false;
  }
}
