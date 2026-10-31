// Trasy zakładki Kontakt: konfiguracja formularza, wysłanie formularza i tura rozmowy z asystentem AI.

import express from "express";
import { askContactAi, chatEmail, contactAiEnabled, parseChatMessages } from "./contact-ai.js";
import {
  CHAT_MAX_MESSAGE_CHARS,
  CHAT_MAX_USER_MESSAGES,
  DESCRIPTION_MAX,
  SUBJECT_MAX,
  contactCopyMail,
  contactMail,
  createContactLimiter,
  deriveContactKey,
  issueContactToken,
  newSubmissionId,
  parseContact,
  parseLang,
  parseMailConfig,
  parseSubmissionId,
  publicCategories,
  readContactToken,
  requestOrigin,
  sendMail,
} from "./contact.js";

const SITE_BASE = "https://aisql.pl/";

const TEXT = {
  pl: {
    closed: "Formularz kontaktowy jest chwilowo niedostępny. Spróbuj ponownie później.",
    tooFast: "Formularz został wysłany zbyt szybko. Spróbuj ponownie.",
    refresh: "Odśwież stronę i wyślij formularz ponownie.",
    later: "Z tego miejsca wysłano już kilka zgłoszeń. Spróbuj ponownie później.",
    sendFailed: "Nie udało się wysłać zgłoszenia. Twoje dane zostały w formularzu — spróbuj ponownie.",
    sendFailedAi: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę albo skorzystaj ze zwykłego formularza.",
    sent: "Dziękujemy! Zgłoszenie zostało wysłane.",
    invalid: "Popraw zaznaczone pola.",
    aiOff: "Asystent AI jest niedostępny. Skorzystaj ze zwykłego formularza.",
    aiBadChat: "Rozmowa jest za długa albo zawiera niedozwolone znaki. Przejdź do zwykłego formularza.",
    aiLimit: "Zadano już wiele pytań. Spróbuj później albo skorzystaj ze zwykłego formularza.",
    aiDown: "Asystent AI jest chwilowo niedostępny. Spróbuj ponownie albo skorzystaj ze zwykłego formularza.",
    aiBadEmail: "Ten adres e-mail wygląda na niepoprawny. Podaj proszę adres, na który mamy odpowiedzieć.",
    aiNeedRating: "Zanim wyślę zgłoszenie: jak oceniasz AI-SQL-Chat w skali 1–5?",
    aiNeedDescription: "Potrzebuję jeszcze krótkiego opisu sprawy, żeby wysłać zgłoszenie.",
    aiSentNoEmail:
      "Dziękuję! Wysłałem zgłoszenie do administratora AI-SQL-Chat. Bez adresu e-mail nie dostaniesz kopii ani odpowiedzi — jeśli zechcesz, napisz ponownie i podaj adres.",
    aiSentCopy: (email) =>
      `Dziękuję! Wysłałem zgłoszenie do administratora AI-SQL-Chat, a jego kopię na Twój adres ${email}. Odpowiedź przyjdzie e-mailem.`,
    aiSentNoCopy: (email) =>
      `Dziękuję! Wysłałem zgłoszenie do administratora AI-SQL-Chat. Kopii na adres ${email} nie udało się wysłać, ale odpowiedź przyjdzie na ten adres.`,
  },
  en: {
    closed: "The contact form is temporarily unavailable. Please try again later.",
    tooFast: "The form was sent too quickly. Please try again.",
    refresh: "Refresh the page and send the form again.",
    later: "Several messages have already been sent from here. Please try again later.",
    sendFailed: "We couldn't send your message. Your text is still in the form — please try again.",
    sendFailedAi: "We couldn't send your message. Try again in a moment or use the regular form.",
    sent: "Thank you! Your message has been sent.",
    invalid: "Please correct the highlighted fields.",
    aiOff: "The AI assistant is unavailable. Please use the regular form.",
    aiBadChat: "The conversation is too long or contains invalid characters. Please switch to the regular form.",
    aiLimit: "Too many questions have been asked. Try later or use the regular form.",
    aiDown: "The AI assistant is temporarily unavailable. Try again or use the regular form.",
    aiBadEmail: "That email address doesn't look right. Please give the address we should reply to.",
    aiNeedRating: "Before I send it: how would you rate AI-SQL-Chat on a scale of 1–5?",
    aiNeedDescription: "I still need a short description of the issue to send your message.",
    aiSentNoEmail:
      "Thank you! I've sent your message to the AI-SQL-Chat administrator. Without an email address you won't get a copy or a reply — feel free to write again and include one.",
    aiSentCopy: (email) =>
      `Thank you! I've sent your message to the AI-SQL-Chat administrator and a copy to ${email}. The reply will come by email.`,
    aiSentNoCopy: (email) =>
      `Thank you! I've sent your message to the AI-SQL-Chat administrator. We couldn't send a copy to ${email}, but the reply will go to that address.`,
  },
};

/** Formularz działa, gdy jest klucz tokenu i konfiguracja Resend; AI wymaga dodatkowo CONTACT_AI_ENABLED i OPENAI_API_KEY. */
function intake() {
  const key = deriveContactKey();
  const mail = parseMailConfig();
  if (!key || !mail) return { open: false };
  return { open: true, key, mail, aiKey: contactAiEnabled() ? process.env.OPENAI_API_KEY.trim() : null };
}

function text(value, max) {
  if (typeof value !== "string") return "";
  return value.length > max ? value.slice(0, max + 1) : value;
}

const limiter = createContactLimiter();
const router = express.Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.get("/config", (req, res) => {
  const lang = parseLang(req.query.lang);
  const state = intake();
  if (!state.open) return res.json({ open: false });
  res.json({
    open: true,
    ai: state.aiKey !== null,
    token: issueContactToken(state.key),
    submissionId: newSubmissionId(),
    categories: publicCategories(lang),
    limits: { subjectMax: SUBJECT_MAX, descriptionMax: DESCRIPTION_MAX, chatMessageMax: CHAT_MAX_MESSAGE_CHARS, chatUserMessages: CHAT_MAX_USER_MESSAGES },
  });
});

router.post("/submit", async (req, res) => {
  const body = req.body ?? {};
  const lang = parseLang(body.lang);
  const t = TEXT[lang];
  const fail = (message) => res.json({ status: "error", message });

  const state = intake();
  if (!state.open) return fail(t.closed);

  const origin = requestOrigin(req);
  if (!limiter.allowAttempt(origin, Date.now())) return fail(t.later);

  const extras = {};
  if (body.extras && typeof body.extras === "object") {
    for (const [key, value] of Object.entries(body.extras).slice(0, 10)) extras[key] = text(value, 600);
  }
  const parsed = parseContact({
    category: text(body.category, 30),
    subject: text(body.subject, 300),
    description: text(body.description, 2_100),
    email: text(body.email, 360),
    ratingOverall: text(body.ratingOverall, 4),
    ratingQuality: text(body.ratingQuality, 4),
    extras,
    source: text(body.source, 500),
    aiAssisted: false,
    trap: text(body.company_website, 200),
    lang,
  });
  // Boty dostają to samo potwierdzenie co ludzie, ale nic nie jest wysyłane.
  if (parsed.kind === "spam") return res.json({ status: "sent", message: t.sent });

  const token = readContactToken(text(body.token, 512), Date.now(), state.key);
  if (token === "too-fast") return fail(t.tooFast);
  if (token !== "ok") return fail(t.refresh);

  if (parsed.kind === "invalid") return res.json({ status: "invalid", message: t.invalid, errors: parsed.errors });
  if (!limiter.allowSend(origin, Date.now())) return fail(t.later);

  const submissionId = parseSubmissionId(text(body.submissionId, 80));
  const sent = await sendMail(state.mail, {
    to: state.mail.to,
    ...contactMail(parsed.value, { receivedAt: new Date(), siteBase: SITE_BASE }),
    replyTo: parsed.value.email,
    // Ponowienie tego samego formularza po utracie odpowiedzi nie wyśle zgłoszenia drugi raz.
    ...(submissionId ? { idempotencyKey: `aisql-contact-${submissionId}` } : {}),
  });
  if (!sent) return fail(t.sendFailed);
  res.json({ status: "sent", message: t.sent });
});

router.post("/ai", async (req, res) => {
  const body = req.body ?? {};
  const lang = parseLang(body.lang);
  const t = TEXT[lang];
  const fail = (message) => res.json({ ok: false, message });

  const state = intake();
  if (!state.open || !state.aiKey) return fail(t.aiOff);
  if (readContactToken(text(body.token, 512), Date.now(), state.key) !== "ok") return fail(t.refresh);
  const messages = parseChatMessages(body.messages);
  if (!messages) return fail(t.aiBadChat);
  const origin = requestOrigin(req);
  if (!limiter.allowAiTurn(origin, Date.now())) return fail(t.aiLimit);
  const turn = await askContactAi(state.aiKey, messages, lang);
  if (!turn) return fail(t.aiDown);

  const email = chatEmail(messages);
  // Bez e-maila wysyłamy tylko wtedy, gdy klient odmówił jego podania; obsługa dostaje zgłoszenie bez adresu do odpowiedzi.
  if (!turn.ready || (!email && !turn.emailDeclined)) return res.json({ ok: true, turn, sent: false });

  // Klient podał e-mail (albo odmówił), a model przygotował zgłoszenie: walidacja jak w zwykłym formularzu, potem wysyłka.
  const parsed = parseContact({
    ...turn.draft,
    email: email ?? "",
    extras: {},
    source: text(body.source, 500),
    aiAssisted: true,
    trap: "",
    lang,
  });
  if (parsed.kind !== "valid") {
    const reply =
      parsed.kind === "invalid" && parsed.errors.email
        ? t.aiBadEmail
        : parsed.kind === "invalid" && parsed.errors.ratingOverall
          ? t.aiNeedRating
          : t.aiNeedDescription;
    return res.json({ ok: true, turn: { ...turn, reply, ready: false }, sent: false });
  }
  if (!limiter.allowSend(origin, Date.now())) return fail(t.later);

  const submissionId = parseSubmissionId(text(body.submissionId, 80));
  const context = { receivedAt: new Date(), siteBase: SITE_BASE, transcript: messages };
  const sent = await sendMail(state.mail, {
    to: state.mail.to,
    ...contactMail(parsed.value, context),
    replyTo: parsed.value.email,
    ...(submissionId ? { idempotencyKey: `aisql-contact-${submissionId}` } : {}),
  });
  if (!sent) return fail(t.sendFailedAi);
  if (!parsed.value.email) return res.json({ ok: true, turn: { ...turn, reply: t.aiSentNoEmail }, sent: true, copied: false });

  // Kopia dla klienta jest dodatkiem: jej błąd nie cofa zgłoszenia, które już dotarło do obsługi.
  const copied = await sendMail(state.mail, {
    to: parsed.value.email,
    ...contactCopyMail(parsed.value, context),
    ...(submissionId ? { idempotencyKey: `aisql-contact-copy-${submissionId}` } : {}),
  });
  const reply = copied ? t.aiSentCopy(parsed.value.email) : t.aiSentNoCopy(parsed.value.email);
  res.json({ ok: true, turn: { ...turn, reply }, sent: true, copied });
});

export default router;
