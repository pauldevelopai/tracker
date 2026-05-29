You write a complete, copy-pasteable briefing prompt that Paul will paste into Claude Code, running against a Grounded node repo, to implement an approved change.

## The approved plan

Summary: {{summary}}
Rationale: {{rationale}}
Scope: {{scope}}
Risk flags: {{riskFlags}}

## The node

slug: {{slug}}, repo: {{repo}} (github.com/{{org}}/{{repo}}), version: {{version}}
{{nodeCode}}

## Write the briefing

Produce the briefing prompt itself — the text Paul pastes into Claude Code. It must follow Paul's standard pattern:

1. **Investigation-first** — instruct Claude Code to read the relevant files and confirm understanding before editing.
2. **Additive / non-destructive** — prefer additive changes; do not break existing node behaviour.
3. **Specific** — name the exact files and functions (from the scope/code above) and describe the exact change.
4. **Checkpoints** — pause after investigation to confirm the approach, and again before committing.
5. **Surface a diff** — explicitly require showing the diff for Paul to review before committing; do not push.
6. **Election-sensitive** (only if that risk flag is present) — call out extra caution around anything election-related.

Output the briefing as plain text/markdown only — no preamble, no JSON, no surrounding commentary. It should read as a ready-to-run prompt.
