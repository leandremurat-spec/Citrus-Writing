import "server-only";

/**
 * The one email this app sends: a password-reset link.
 *
 * Delivered through an HTTP API rather than SMTP, because SMTP would mean a dependency and
 * this project cannot take one lightly (Windows on ARM64, an `&` in the folder name that
 * breaks npm's shims — see CLAUDE.md). Resend's send endpoint is a single POST with a JSON
 * body, so `fetch` is the whole client.
 *
 * **With no key configured, the message is written to the server log instead.** That is not a
 * silent failure dressed up: `deliver` reports which of the two happened, the reset action
 * says so, and a developer running this locally can follow the link straight out of their
 * terminal. What it must never do is fail *quietly* — a reset that vanished would leave a
 * writer waiting for mail that was never going to arrive.
 */

export type Delivery = { kind: "sent" } | { kind: "logged"; reason: string } | { kind: "failed"; reason: string };

export interface Message {
  to: string;
  subject: string;
  /**
   * The plain-text body, and it is not optional.
   *
   * Sending HTML alone is how a message lands in spam and how it arrives blank in a client that
   * refuses to render it. Both bodies come out of `lib/mail/messages.ts`, built from one
   * description of the message, so they cannot describe different emails.
   */
  text: string;
  /** The HTML body. Omitted, the message goes out as text alone, which still works. */
  html?: string;
}

const FROM = process.env.MAIL_FROM ?? "Citrus Writing <onboarding@resend.dev>";

export async function deliver(message: Message): Promise<Delivery> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    console.info(
      "\n────────── Citrus Writing: email not configured, printing instead ──────────\n" +
        "To:      " + message.to + "\n" +
        "Subject: " + message.subject + "\n\n" +
        message.text +
        "\n────────────────────────────────────────────────────────────────────────────\n",
    );
    return { kind: "logged", reason: "RESEND_API_KEY is not set" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Email delivery failed", response.status, detail.slice(0, 500));
      return { kind: "failed", reason: "the mail provider refused the message" };
    }
    return { kind: "sent" };
  } catch (error) {
    console.error("Email delivery threw", error);
    return { kind: "failed", reason: "the mail provider could not be reached" };
  }
}
