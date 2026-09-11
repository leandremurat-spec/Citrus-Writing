/*
 * ═══════════════════════════════════════════════════════════════════════════
 *  EVERY WORD ON THE PUBLIC PAGES LIVES HERE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  This is the file to open when you want to change the writing. The landing
 *  page, the pricing page and the sign-up page all read from it, so you never
 *  have to go looking through the layout code to reword a sentence.
 *
 *  ── How to edit ──────────────────────────────────────────────────────────
 *
 *  Everything is a plain string in quotes. Change what is between the quotes,
 *  save, and the page updates while `npm run dev` is running.
 *
 *      headline: "Write the next one.",
 *                 ^^^^^^^^^^^^^^^^^^^ change this
 *
 *  Four rules, and that is the whole of it:
 *
 *  1. KEEP THE QUOTES AND THE COMMA. Only the words between the quotes change.
 *  2. AN APOSTROPHE NEEDS THE CURLY ONE: write don’t, not don't. A straight
 *     apostrophe ends the string early and breaks the page. (Same for a quote
 *     inside a sentence: use “ and ”.) If the page goes blank after an edit,
 *     this is almost always why.
 *  3. *STARS MAKE BOLD.* Anywhere you see a sentence rendered through the
 *     bold-aware renderer — the plan bullet lists, the figure captions — you
 *     can wrap words in *stars* to embolden them. Elsewhere stars are literal.
 *  4. TO REMOVE AN ITEM from a list, delete its whole `{ ... },` block. To add
 *     one, copy an existing block and change the words. Lists can be any
 *     length; the layout adapts.
 *
 *  ── What is deliberately NOT here ────────────────────────────────────────
 *
 *  PRICES AND PLAN LIMITS live in `src/lib/billing/plans.ts`, because the
 *  server *enforces* them. If a price were editable as copy, the page could
 *  advertise $5 while the checkout charged $9. The pricing page reads the real
 *  numbers from that file and formats them itself.
 *
 *  The words *inside the app* — the writing workspace, the binder, the export
 *  dialog — are not here either. There are only twenty-two sentences of prose
 *  in the whole app by design (see CLAUDE.md, "Explanatory copy earns its
 *  place or goes"), and each one sits next to the thing it explains.
 */

// ═══════════════════════════════════════════════════════════════════════════
//  THE LANDING PAGE  ( / )
// ═══════════════════════════════════════════════════════════════════════════

export const landing = {
  /** The browser tab, and what search engines and link previews show. */
  meta: {
    title: "Citrus Writing — a workspace for webauthors",
    description:
      "Write the next chapter, stay ahead of the last. A writing workspace built for webnovel and serial fiction authors.",
  },

  /** The huge headline. Two lines, each on its own row — keep both short. */
  hero: {
    headlineLine1: "Write the next one.",
    headlineLine2: "Stay ahead of the last.",
    intro:
      "Citrus Writing: the workspace tailored for webnovels and serials. The chapter is your unit of work, the arc is your unit of story, and the day-to-day is your unit of time. We count what you write, tell you when you’ve hit that sweet spot in the chapter, and show you exactly how far ahead of schedule you are.",
    /** The filled button. The second version shows to someone already signed in. */
    primaryCta: "Start your first serial",
    primaryCtaSignedIn: "Back to your library",
    secondaryCta: "See how the Run works",
  },

  /** The card showing the run strand. */
  run: {
    eyebrow: "The Run",
    blurb:
      "Your whole serial, drawn as one strand. The size is the length, fill is status, and the dashed line is your readers.",
  },

  /**
   * The four circles of numbers.
   *
   * `value` is the big number — keep it short, it is set very large.
   * `label` is the small capitals underneath. Stars make bold.
   */
  figures: [
    { value: "1,500", label: "Words where a chapter starts working" },
    { value: "4", label: "Weeks of buffer, and you can relax" },
    { value: "20", label: "Versions kept per chapter, always on" },
    { value: "0", label: "Words of yours we train on" },
  ],

  /** The four two-column rows. Add or remove whole blocks freely. */
  capabilities: {
    eyebrow: "What it actually does",
    items: [
      {
        heading: "Counts the work, not just the session",
        body: "Words in, words out. Whether you’re fleshing out a missing detail or cutting a scene that isn’t working, progress isn’t just addition. We track every word written and deleted, because it all moves the story forward.",
      },
      {
        heading: "Knows what a chapter measures",
        body: "Hit the 1,500–2,500 word serial sweet spot every time. The footer flags length deviations in real time as you write, saving you from post-publish engagement drops.",
      },
      {
        heading: "Remembers your characters",
        body: "Type @ to tag a character instantly. The codex logs their traits, connections, and chapter appearances so you never accidentally abandon a plot-critical sidekick.",
      },
      {
        heading: "Hands you clean text",
        body: "Export a chapter, an arc, or the whole serial as HTML, Markdown or plain text with no classes and no wrapper junk. It pastes into Royal Road, Scribble Hub and Wattpad without a fight.",
      },
    ],
  },

  /** The buffer section: words on the left, the runway illustration on the right. */
  buffer: {
    eyebrow: "The buffer",
    heading: "Staying ahead of eager readers is tricky, so we simplified it",
    body1:
      "Every webnovel author knows the feeling of deadline day coming. Citrus Writing turns your finished-but-unposted chapters into weeks of runway, drops them onto real dates, and measures your pace.",
    body2:
      "Nothing is published for you. There is no platform connected and no key to paste. The schedule exists to make sure you stay ahead of your deadlines”.",
  },

  /**
   * The runway card beside it. This is a picture of the feature, not live data —
   * these are example chapters, so name them whatever reads well.
   */
  runwayCard: {
    title: "Runway",
    weeksDone: "2",
    weeksTarget: "of 3 weeks",
    slots: [
      { date: "Sat 13 Sep", chapter: "Beneath the Ninth Pier", words: "2,310", status: "queued" },
      { date: "Sat 20 Sep", chapter: "The Warden’s Bargain", words: "1,240", status: "edited" },
    ],
    emptySlot: "Sat 27 Sep · nothing queued yet",
  },

  /** The pull quote. Attribution shows underneath in smaller grey text. */
  quote: {
    text: "The daily chapter grind makes you feel like you’re always one sick day away from tanking your rankings. Seeing the buffer I managed proved I wasn't drowning at all.",
    attribution: "— tastyshengjianbao (webnovel author), 132 chapters in",
  },

  /** The green band at the bottom. */
  closing: {
    heading: "One serial, free, for as long as you like",
    body: "The whole writing surface — the run, the sweet spot, the codex, version history, clean export.",
    primaryCta: "Get started",
    primaryCtaSignedIn: "Open your library",
    secondaryCta: "See the plans",
  },

  /** The small grey line at the very bottom right. */
  footerNote: "Your words stay yours. Export everything, any time.",
};

// ═══════════════════════════════════════════════════════════════════════════
//  THE PRICING PAGE  ( /pricing )
// ═══════════════════════════════════════════════════════════════════════════

export const pricing = {
  meta: {
    title: "Pricing",
    description: "Free for one serial. Cheap for the rest. Every plan carries the whole writing surface.",
  },

  hero: {
    headlineLine1: "Free for one serial.",
    headlineLine2: "Cheap for the rest.",
    intro:
      "Every plan has the whole writing surface in it — the manuscript, the binder, the run, the sweet spot, version history and clean export. You are paying for scale and for the scheduling tools, never for the ability to write.",
  },

  /**
   * What each plan card lists.
   *
   * `included: false` draws a grey cross instead of a tick — use it for the one
   * line that says what a plan does *not* do. Stars make bold.
   *
   * These are the selling words. The limits they describe are enforced from
   * `src/lib/billing/plans.ts`, so if you change a number here, change it there
   * too — otherwise the page promises one thing and the app does another.
   */
  planLines: {
    DRAWER: [
      { included: true, text: "*One serial*, unlimited chapters and arcs" },
      { included: true, text: "The manuscript, the binder, volumes and arcs" },
      { included: true, text: "The run, the sweet spot and chapter notes" },
      { included: true, text: "20 versions kept per chapter" },
      { included: true, text: "Chapter export, all three formats" },
      { included: false, text: "No release schedule or runway" },
    ],
    SERIAL: [
      { included: true, text: "*Unlimited serials*" },
      { included: true, text: "*The buffer* — runway, schedule, pace" },
      { included: true, text: "Chapter scheduling on real dates" },
      { included: true, text: "Codex ties and appearances" },
      { included: true, text: "Arc, volume and whole-serial export in one pass" },
      { included: true, text: "Unlimited version history" },
    ],
  },

  /** The badge beside the monthly/yearly switch. {saving} becomes the real figure. */
  yearlyBadge: "Save {saving} a year on yearly",

  /** Button labels on the plan cards. */
  planCta: {
    signedOut: "Start writing",
    currentPlan: "Your plan",
    backToLibrary: "Back to your library",
    upgrade: "Upgrade to Serial",
    upgradePending: "Opening checkout…",
  },

  /** The comparison table. `drawer`/`serial` are the two cells on each row. */
  comparison: {
    heading: "Line by line",
    rows: [
      { label: "Serials", drawer: "One", serial: "Unlimited" },
      { label: "Manuscript, volumes, arcs and notes", drawer: "Yes", serial: "Yes" },
      { label: "The run, the sweet spot, the streak", drawer: "Yes", serial: "Yes" },
      { label: "Versions kept per chapter", drawer: "20", serial: "Unlimited" },
      { label: "Export scope", drawer: "Chapter", serial: "Chapter, arc, volume, serial" },
      { label: "Export formats", drawer: "HTML, Markdown, plain text", serial: "HTML, Markdown, plain text" },
      { label: "Release schedule & runway", drawer: "—", serial: "Yes" },
      { label: "Codex entries", drawer: "Yes", serial: "Yes" },
      { label: "Codex ties & appearances", drawer: "—", serial: "Yes" },
      { label: "Your words used for training", drawer: "Never", serial: "Never" },
    ],
  },

  faq: {
    heading: "FAQ",
    items: [
      {
        question: "Does it post my chapters for me?",
        answer:
          "No — not yet, anyway. Citrus Writing isn’t connected to any publishing platform. We can’t post for you, but we can schedule it for you.",
      },
      {
        question: "What happens if I stop paying?",
        answer:
          "Nothing is deleted or locked. You drop to the Drawer plan: every serial stays readable and exportable, and you pick one to keep writing in until you upgrade again.",
      },
      {
        question: "Do you train on my fiction?",
        answer:
          "Never, on any plan. There is no model reading your manuscript and no setting to check. There never will be.",
      },
      {
        question: "Can I get my work out?",
        answer:
          "Always. Every chapter exports as HTML, Markdown or plain text on the free plan, and Serial adds whole-arc and whole-serial exports in one pass. We never keep your serials hostage.",
      },
    ],
  },

  closing: {
    heading: "Start on Drawer. Decide later.",
    body: "One serial with unlimited chapters and arcs. Everything you need to launch your first story — just without the runway tools. Upgrade whenever you’re ready for serial number two.",
    primaryCta: "Create an account",
    primaryCtaSignedIn: "Open your library",
    secondaryCta: "Back to the tour",
  },

  footerNote: "Prices in USD. Cancel from your account, any day.",
};

// ═══════════════════════════════════════════════════════════════════════════
//  THE SIGN-UP PAGE  ( /sign-up )
// ═══════════════════════════════════════════════════════════════════════════

export const signUp = {
  meta: { title: "Create an account" },

  headlineLine1: "Make an account.",
  headlineLine2: "Then start writing!",
  intro:
    "You’ll start on our Drawer plan. Name your first serial and you get an Arc 1 and a Chapter 1 to write in straight away.",

  /** The three ticked promises down the left. Add or remove lines freely. */
  promises: [
    "Twenty versions of every chapter, kept automatically from the first word",
    "Export every chapter you write — HTML, Markdown or plain text — on the free plan",
    "Your fiction is never used to train anything",
  ],

  /** The card on the right. */
  formHeading: "Create your account",
  submit: "Create account",
  submitPending: "Creating your account…",
  /** The one opt-in. This is the only email the app ever sends besides a password reset. */
  notifyLabel: "Email me when a chapter has sat untouched for too long. Nothing else, ever.",
};

// ═══════════════════════════════════════════════════════════════════════════
//  THE SIGN-IN PAGE  ( /sign-in )
// ═══════════════════════════════════════════════════════════════════════════

export const signIn = {
  meta: { title: "Sign in" },
  headline: "Welcome back!",
  submit: "Sign in",
  submitPending: "Signing in…",
  /** Shown under the card. */
  noAccount: "No account yet?",
  noAccountLink: "Create one",
  noAccountTail: "— one serial is free for good.",
};
