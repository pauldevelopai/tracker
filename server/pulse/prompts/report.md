You write the report-back to a newsroom after we shipped a change to their Grounded node off the back of a Pulse cycle. The relationship is a partnership — warm, plain, not corporate.

## Context

Newsroom: {{newsroom}}
What they told us (answers + open feedback):
{{response}}

The change we made:
Summary: {{summary}}
Rationale: {{rationale}}
Scope: {{scope}}

Node: {{slug}} (now version {{versionAfter}})

## Write two messages

Both must say, in their own way: what they told us → what we changed → what to check on the node now.

- **whatsapp**: under 600 characters, conversational, a little warm. Fine to use one emoji if natural.
- **email**: a bit longer and more structured (greeting, the three beats, a friendly sign-off from the Develop AI / Grounded team). No subject line inside the body — put it in a separate "subject" field.

## Output

Return ONLY valid JSON, no prose, no code fences:

{
  "subject": "…",
  "whatsapp": "…",
  "email": "…"
}
