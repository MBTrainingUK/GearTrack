import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';

// ── Configuration ────────────────────────────────────────────────────
// RESEND_API_KEY is a Firebase secret (firebase functions:secrets:set RESEND_API_KEY).
// The string params are read from functions/.env.<projectId> per environment.
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

// Sender shown to recipients. Must be a verified domain in Resend for
// production; the resend.dev onboarding address works for staging tests.
export const MAIL_FROM = defineString('MAIL_FROM', {
  default: 'GearTrack <onboarding@resend.dev>',
});

// When set, every email is redirected to this address instead of the real
// recipients (subject gains an [original recipients] prefix). Set on the
// staging project so tests can never email real users; leave unset in prod.
export const MAIL_REDIRECT = defineString('MAIL_REDIRECT', { default: '' });

// Base URL of the deployed app, used for links in emails.
export const APP_URL = defineString('APP_URL', {
  default: 'https://mbtraininguk.github.io/GearTrack/',
});

// ── Sending ──────────────────────────────────────────────────────────

export interface Email {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
}

/**
 * Sends via the Resend REST API. Failures are logged, never thrown —
 * a broken email must not fail the checkout/reservation write that
 * triggered it.
 */
export async function sendEmail(email: Email): Promise<void> {
  let { to, cc, subject } = email;

  const redirect = MAIL_REDIRECT.value().trim();
  if (redirect) {
    subject = `[to: ${[...to, ...(cc ?? [])].join(', ')}] ${subject}`;
    to = [redirect];
    cc = undefined;
  }

  if (to.length === 0) return;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY.value()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: MAIL_FROM.value(),
        to,
        ...(cc && cc.length > 0 ? { cc } : {}),
        subject,
        html: email.html,
      }),
    });
    if (!res.ok) {
      console.error(`Resend rejected email "${subject}": ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error(`Failed to send email "${subject}":`, err);
  }
}

// ── Recipient helpers ────────────────────────────────────────────────

/** Emails of an org's admins (and optionally managers), for staff notifications. */
export async function getOrgStaffEmails(
  orgId: string,
  roles: ('admin' | 'manager')[]
): Promise<string[]> {
  const snap = await getFirestore()
    .collection('users')
    .where('orgId', '==', orgId)
    .where('role', 'in', roles)
    .get();
  return snap.docs.map((d) => d.data().email as string).filter(Boolean);
}

/** Item names for the given ids, in the same order; unknown ids are skipped. */
export async function getItemNames(itemIds: string[]): Promise<string[]> {
  if (itemIds.length === 0) return [];
  const db = getFirestore();
  const snaps = await db.getAll(...itemIds.map((id) => db.collection('items').doc(id)));
  return snaps.filter((s) => s.exists).map((s) => s.data()!.name as string);
}

// ── Templates ────────────────────────────────────────────────────────

export function formatDay(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
}

function itemList(itemNames: string[]): string {
  return `<ul style="margin:8px 0 16px;padding-left:20px;color:#374151;">${itemNames
    .map((n) => `<li style="margin:2px 0;">${escapeHtml(n)}</li>`)
    .join('')}</ul>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Shared layout: GearTrack header, body content, one call-to-action button. */
function layout(heading: string, bodyHtml: string, ctaText: string, ctaPath: string): string {
  const url = `${APP_URL.value().replace(/\/$/, '')}/#${ctaPath}`;
  return `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <div style="font-size:18px;font-weight:700;color:#2563eb;margin-bottom:16px;">GearTrack</div>
    <h2 style="font-size:16px;color:#111827;margin:0 0 12px;">${heading}</h2>
    ${bodyHtml}
    <a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">${ctaText}</a>
    <p style="font-size:12px;color:#9ca3af;margin-top:24px;">This is an automated message from GearTrack.</p>
  </div>`;
}

export function reservationPendingEmail(input: {
  userName: string;
  itemNames: string[];
  startDate: Date;
  endDate: Date;
}): Pick<Email, 'subject' | 'html'> {
  return {
    subject: `Reservation pending approval — ${input.userName}`,
    html: layout(
      `${escapeHtml(input.userName)} has requested a reservation`,
      `<p style="color:#374151;">From <strong>${formatDay(input.startDate)}</strong> to <strong>${formatDay(
        input.endDate
      )}</strong>:</p>${itemList(input.itemNames)}`,
      'Review reservation',
      '/reservations'
    ),
  };
}

export function reservationApprovedEmail(input: {
  itemNames: string[];
  startDate: Date;
  endDate: Date;
}): Pick<Email, 'subject' | 'html'> {
  return {
    subject: 'Your reservation has been approved',
    html: layout(
      'Your reservation has been approved',
      `<p style="color:#374151;">Booked from <strong>${formatDay(input.startDate)}</strong> to <strong>${formatDay(
        input.endDate
      )}</strong>:</p>${itemList(input.itemNames)}`,
      'View reservation',
      '/reservations'
    ),
  };
}

export function dueTomorrowEmail(input: {
  itemNames: string[];
  dueDate: Date;
}): Pick<Email, 'subject' | 'html'> {
  return {
    subject: 'Reminder: your gear is due back tomorrow',
    html: layout(
      'Your gear is due back tomorrow',
      `<p style="color:#374151;">Due <strong>${formatDay(input.dueDate)}</strong>:</p>${itemList(
        input.itemNames
      )}`,
      'View my gear',
      '/m/gear'
    ),
  };
}

export function overdueEmail(input: {
  userName: string;
  itemNames: string[];
  dueDate: Date;
}): Pick<Email, 'subject' | 'html'> {
  return {
    subject: `Overdue: ${input.userName} — gear was due back ${formatDay(input.dueDate)}`,
    html: layout(
      'This gear is overdue',
      `<p style="color:#374151;">Checked out to <strong>${escapeHtml(
        input.userName
      )}</strong>, due back <strong>${formatDay(input.dueDate)}</strong>:</p>${itemList(
        input.itemNames
      )}<p style="color:#374151;">Please return it as soon as possible.</p>`,
      'View my gear',
      '/m/gear'
    ),
  };
}
