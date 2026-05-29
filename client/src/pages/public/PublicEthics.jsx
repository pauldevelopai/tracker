// Ethics — sits under the "AI Policies" menu alongside Lawsuits, Regulations,
// Connections and Use cases. A practical guide to using AI responsibly in a
// newsroom: the principles, the hard questions, and concrete guardrails a
// newsroom can adopt. Self-contained (no API) so it always renders.

const TOPICS = [
  {
    id: 'transparency',
    title: 'Transparency with your audience',
    lede: 'Readers deserve to know when and how AI shaped what they read.',
    body: [
      'Trust is a newsroom’s core asset. Using AI quietly to draft, summarise or translate risks that trust the moment it surfaces. The safer path is to be open: say what AI did, what a human checked, and where responsibility sits.',
      'Practical moves: publish an AI-use policy readers can find; label AI-assisted work clearly; keep a human byline accountable for every published piece; and never present synthetic media as a real recording without disclosure.',
    ],
  },
  {
    id: 'accuracy',
    title: 'Accuracy and verification',
    lede: 'A model that sounds confident is not the same as a fact that is true.',
    body: [
      'Generative tools fabricate — names, quotes, citations, dates. Treat every AI output as an unverified tip from an unreliable source, not as copy ready to publish.',
      'Practical moves: require human verification of every fact before publication; never let a model invent quotes or sources; check AI summaries against the original document; and keep your existing editorial standards as the bar AI must clear, not a bar it gets to lower.',
    ],
  },
  {
    id: 'sources',
    title: 'Protecting sources and sensitive data',
    lede: 'What you paste into a tool may not stay private.',
    body: [
      'Confidential source material, unpublished investigations and personal data can leak through third-party AI services, be retained for training, or be exposed in a breach. The convenience of a chatbot is not worth burning a source.',
      'Practical moves: never paste source identities or sensitive material into public AI tools; prefer tools with clear no-training and data-deletion terms; redact before processing; and keep the most sensitive work off cloud AI entirely.',
    ],
  },
  {
    id: 'bias',
    title: 'Bias, representation and fairness',
    lede: 'Models trained on the global web carry the global web’s blind spots.',
    body: [
      'AI systems under-represent African languages, contexts and names, and can reproduce stereotypes. Leaning on them uncritically risks importing those distortions into your coverage of your own communities.',
      'Practical moves: review AI output for skewed framing or missing local context; do not rely on models for cultural or linguistic nuance they were not built for; keep local editors in the loop; and treat AI as a draft assistant, never as the final voice on your community.',
    ],
  },
  {
    id: 'labour',
    title: 'Jobs, skills and the newsroom',
    lede: 'AI should expand what your team can do — not quietly replace it.',
    body: [
      'Used well, AI takes the drudgery off journalists so they can report. Used badly, it hollows out entry-level roles and the training pipeline the craft depends on.',
      'Practical moves: be explicit about which tasks AI assists and which stay human; invest the time AI saves back into reporting and verification; train staff on the tools and their limits; and involve the newsroom in decisions about where AI is adopted.',
    ],
  },
  {
    id: 'accountability',
    title: 'Accountability and correction',
    lede: 'When AI gets it wrong, a person — not a model — answers for it.',
    body: [
      'You cannot delegate editorial responsibility to a tool. If an AI-assisted story misleads, the newsroom owns the error and the correction, exactly as with any other mistake.',
      'Practical moves: keep a named human accountable for every output; log how AI was used so errors can be traced; correct AI-introduced mistakes openly and promptly; and review your AI policy regularly as the tools and the law change.',
    ],
  },
];

export default function PublicEthics() {
  return (
    <div>
      <section style={{ marginBottom: 30, maxWidth: 760 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>
          AI Policies &middot; Ethics
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 14px 0', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          Using AI responsibly in the newsroom
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          AI can speed up reporting, translation and research — but only if it strengthens trust rather than
          eroding it. These are the principles and practical guardrails a newsroom can adopt to use AI without
          compromising accuracy, sources or accountability.
        </p>
      </section>

      {/* Topic index */}
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
        {TOPICS.map(t => (
          <a key={t.id} href={`#${t.id}`}
             style={{ fontSize: 13, fontWeight: 600, padding: '7px 13px', borderRadius: 999, textDecoration: 'none',
                      border: '1px solid var(--border-color)', color: 'var(--text-primary)', background: 'var(--card-bg)' }}>
            {t.title}
          </a>
        ))}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820 }}>
        {TOPICS.map((t, i) => (
          <article key={t.id} id={t.id} className="card" style={{ padding: 24, scrollMarginTop: 90 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{String(i + 1).padStart(2, '0')}</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 6px 0', letterSpacing: '-0.01em' }}>{t.title}</h2>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', margin: '0 0 12px 0' }}>{t.lede}</p>
            {t.body.map((p, j) => (
              <p key={j} style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 10px 0' }}>{p}</p>
            ))}
          </article>
        ))}
      </section>
    </div>
  );
}
