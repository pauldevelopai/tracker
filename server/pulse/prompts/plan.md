You draft a change plan for a Grounded AI node, based on what a newsroom told us in a Pulse cycle. The goal of Pulse is to make the node become what the newsroom actually wants — so respond to what they said, with the smallest change that meaningfully helps.

## Context

Newsroom:
{{newsroom}}

Node (slug: {{slug}}, repo: {{repo}}, version: {{version}}):
{{nodeCode}}

The questions we asked this cycle:
{{questions}}

Their answers (MCQ choices + open feedback):
{{response}}

Recent Pulse history for this newsroom:
{{priorResponses}}

{{electionNote}}

## Instructions

Decide whether a change is warranted.

- If the response is positive and suggests nothing actionable, set `"noChange": true` and give a `rejectionReason` of "No change warranted by response".
- Otherwise propose a change. Be specific about files, functions and behaviour, grounded in the code above. Bias to the smallest change that responds meaningfully.

Risk flags — include any that apply, drawn from exactly this set:
"Election-sensitive", "Schema change", "Integration touch", "User-facing copy", "Cosmetic", "Behaviour change".

## Output

Return ONLY valid JSON, no prose, no code fences:

{
  "noChange": false,
  "summary": "one line",
  "rationale": "why this responds to what they said",
  "scope": "files and functions affected, and the behaviour change",
  "riskFlags": ["Behaviour change"],
  "rejectionReason": ""
}
