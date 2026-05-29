// Turn Airtable records into compact text blocks for the prompts, and serialise
// Pulse records for the admin API.

const NEWSROOM_FIELDS = [
  'Name', 'Country', 'Type', 'Cohort Name', 'Languages', 'AI tools used',
  'Who are they?', 'AI Journey Status', 'Notes',
];

export function formatNewsroom(rec) {
  if (!rec) return '(unknown newsroom)';
  const f = rec.fields || {};
  const lines = [];
  for (const key of NEWSROOM_FIELDS) {
    const v = f[key];
    if (v == null || v === '') continue;
    const val = Array.isArray(v)
      ? v.map((x) => (x && x.name) || x).join(', ')
      : (v && v.name) || v;
    lines.push(`${key}: ${val}`);
  }
  return lines.join('\n') || '(no newsroom detail)';
}

export function formatPriorResponses(responses) {
  if (!responses || !responses.length) return '(none yet)';
  return responses.map((r, i) => {
    const f = r.fields || {};
    return [
      `#${i + 1} (${f['Submitted at'] || '?'})`,
      `  answers: ${[f['Answer 1'], f['Answer 2'], f['Answer 3']].filter(Boolean).join(' | ')}`,
      f['Open feedback'] ? `  open: ${f['Open feedback']}` : '',
    ].filter(Boolean).join('\n');
  }).join('\n');
}

export function formatQuestions(questionRecs) {
  if (!questionRecs || !questionRecs.length) return '(no questions)';
  return questionRecs.map((q) => {
    const f = q.fields || {};
    const opts = ['A', 'B', 'C', 'D']
      .map((L) => (f[`Option ${L}`] ? `${L}) ${f[`Option ${L}`]} [${f[`Option ${L} value`] ?? ''}]` : ''))
      .filter(Boolean).join('  ');
    return `Q${f.Order || ''}: ${f['Question text'] || ''}\n  ${opts}`;
  }).join('\n');
}

export function formatResponse(rec) {
  if (!rec) return '(no response)';
  const f = rec.fields || {};
  return [
    `Answer 1: ${f['Answer 1'] || ''}`,
    `Answer 2: ${f['Answer 2'] || ''}`,
    `Answer 3: ${f['Answer 3'] || ''}`,
    `Open feedback: ${f['Open feedback'] || '(none)'}`,
    f['Respondent name'] ? `From: ${f['Respondent name']}${f['Respondent role'] ? `, ${f['Respondent role']}` : ''}` : '',
  ].filter(Boolean).join('\n');
}

export function formatNodeEvents(events) {
  if (!events || !events.length) return '(no recent events)';
  return events.map((e) => JSON.stringify(e.fields || {})).join('\n').slice(0, 1500);
}
