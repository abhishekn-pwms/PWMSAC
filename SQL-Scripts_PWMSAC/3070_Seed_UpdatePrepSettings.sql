-- Seed data for update_prep_settings, generated from live data on 2026-07-12

insert into update_prep_settings (setting_key, setting_value, updated_at) values
('style_manager', '### STYLE INSTRUCTIONS FOR MANAGER
- Write in clear, confident, executive-level language. Focus on the primary accomplishment or current state reached during the reporting period, not a list of meetings or conversations.
- Where multiple activities contribute to the same objective, synthesize them into a single project-level update rather than describing each activity separately.
- Prefer project-level language (for example assessment, evaluation, validation, commercial discussions, migration planning or deployment readiness) over activity-level language (for example discussed, reviewed, emailed or met), unless the activity itself is the only meaningful progress during the period.
- Where directly supported by the raw data or previous project continuity, briefly state the immediate purpose of the work (for example "to finalize partner selection", "to evaluate migration feasibility" or "to support commercial closure"). Do not infer downstream business impact or client sentiment.
- The bold status sentence should describe the most significant accomplishment or current state, synthesizing related activities into one outcome where appropriate, but do not infer progress, maturity or completion beyond what the evidence supports.
- Clearly distinguish what has been completed from what remains in progress or pending.
- Use dependency or risk framing only when it materially affects the next step, timeline or decision, not on every project and not simply to sound more executive.
- The Next: sentence should state the immediate next action, naming the specific dependency only when one genuinely exists.
- For the bracketed history line, retain whichever date is the most meaningful reference point for continuity. This may be older than the current reporting period and is not necessarily the most recent activity. Introduce a new history date only when the current period establishes a new workstream or a significant shift in direction.
- If there is no material activity during the reporting period, state this explicitly (for example, "No material change this period...") rather than omitting the project.

### DATA INTEGRITY RULES (Apply Before Style)
1. Synthesis must stay strictly grounded in the raw data provided. Do not infer downstream business impact, sentiment or progress (for example, strengthened the pipeline, accelerated closure or increased client confidence) unless explicitly supported by the task logs. It is acceptable to summarize related activities into the immediate outcome achieved during the reporting period.
2. Any dated activity within the current reporting period counts as this period''s activity, even if it appears in an Open ToDos or brief-mention line. Never label a project "No material progress this period" if any dated activity from within the reporting period exists.
3. If a project name this period is a plausible continuation of a differently named project in LAST PERIOD''S UPDATE (same client or same initiative), treat them as the same project and carry forward relevant history. If genuinely uncertain, flag the ambiguity explicitly rather than silently choosing one interpretation.
4. It is acceptable to summarize multiple related activities into a higher-level workstream when they clearly support the same objective. The summary must remain fully supported by the raw data and must not introduce additional progress, outcomes or business impact.', '2026-07-08T14:28:52.217313+00:00'),
('spoken_style', 'Based on the attached final update, provide a Speaking Version.
## INSTRUCTIONS
- Follow the same project sequence as the report.
- Cover every project included in the report in the same order, summarizing each in 1-3 concise sentences that cover the most significant accomplishment or current state, what remains in progress or pending and the immediate next step where relevant.
- Where it helps the listener understand the current update, briefly incorporate relevant historical context from the report to provide continuity. Do not repeat historical details unless they help explain the current status or next step.
- Sound natural when presented verbally during a leadership review, rather than reading the report word-for-word.
- Use simple, confident, executive-level language suitable for senior leadership.
- Clearly distinguish what has been completed from what remains in progress or pending.
- Complement the written report rather than repeating it verbatim.
- Do not introduce any new information, assumptions or business impact beyond what is supported by the written report.
- Ensure the overall flow is concise, conversational and suitable for presenting directly in the meeting.', '2026-07-08T14:28:55.182069+00:00'),
('style_csaio', '### STYLE INSTRUCTIONS FOR CSAIO
- Write in clear, confident, executive-level language. Focus on the primary accomplishment or current state reached during the reporting period, not a list of meetings or conversations.
- Where multiple activities contribute to the same objective, synthesize them into a single project-level update rather than describing each activity separately.
- Prefer project-level language (for example assessment, evaluation, validation, commercial discussions, migration planning or deployment readiness) over activity-level language (for example discussed, reviewed, emailed or met), unless the activity itself is the only meaningful progress during the period.
- Where directly supported by the raw data or previous project continuity, briefly state the immediate purpose of the work (for example "to finalize partner selection", "to evaluate migration feasibility" or "to support commercial closure"). Do not infer downstream business impact or client sentiment.
- Each "Key highlights of this week" bullet should describe the accomplishment or current state for that project, synthesizing related activities into one outcome where appropriate, but do not infer progress, maturity or completion beyond what the evidence supports.
- Clearly distinguish what has been completed from what remains in progress or pending.
- Use dependency or risk framing only when it materially affects the next step, timeline or decision, not on every project and not simply to sound more executive.
- Each "Key priorities for next week" bullet should state the immediate next action for that project, naming the specific dependency only when one genuinely exists.
- There is no bracketed history line in this format, but check LAST PERIOD''S UPDATE for continuity — do not drop a recurring item without reason if it remains relevant this week.
- If there is no material activity during the reporting period, state this explicitly (for example, "No material change this period...") rather than omitting the project.

### DATA INTEGRITY RULES (Apply Before Style)
1. Synthesis must stay strictly grounded in the raw data provided. Do not infer downstream business impact, sentiment or progress (for example, strengthened the pipeline, accelerated closure or increased client confidence) unless explicitly supported by the task logs. It is acceptable to summarize related activities into the immediate outcome achieved during the reporting period.
2. Any dated activity within the current reporting period counts as this period''s activity, even if it appears in an Open ToDos or brief-mention line. Never label a project "No material progress this period" if any dated activity from within the reporting period exists.
3. If a project name this period is a plausible continuation of a differently named project in LAST PERIOD''S UPDATE (same client or same initiative), treat them as the same project and carry forward relevant history. If genuinely uncertain, flag the ambiguity explicitly rather than silently choosing one interpretation.
4. It is acceptable to summarize multiple related activities into a higher-level workstream when they clearly support the same objective. The summary must remain fully supported by the raw data and must not introduce additional progress, outcomes or business impact.', '2026-07-08T14:29:15.42734+00:00'),
('attachmentmode_csaio', 'two', '2026-07-08T14:29:16.026429+00:00'),
('recency_csaio', '2', '2026-07-08T14:29:16.682113+00:00'),
('template_csaio', '- Attachment 1: Previous update of the same report type. Use this as the reference for report structure, writing style and continuity for this report type.
- Attachment 2: Previous update prepared in the other reporting format, covering many of the same projects. Use this only to cross-check project continuity where relevant.
- Most recent previous update for project continuity: Attachment [2].
- Use the most recent previous update to preserve the latest project continuity where it does not conflict with THIS PERIOD''S RAW DATA, which always takes precedence.
- Always follow the FORMAT section for the output. Never mix the format or presentation style of the two report types.
- In addition to project continuity, use the most recent previous update as the primary reference for the reporting style, level of abstraction and project narrative.
- When the current period contains incremental activities on an ongoing initiative, continue the project narrative from the previous report rather than rewriting it solely from the individual task logs.
- Prefer evolving the previous executive summary using this period''s evidence instead of producing an entirely new summary from scratch. The current period''s raw data always takes precedence where there is any conflict.
- Where the previous report already established the project''s objective (for example partner comparison, migration feasibility or commercial closure), retain that objective if it remains consistent with the current raw data instead of restating the underlying activities.
- When deciding between describing individual activities and describing the overall workstream, prefer the workstream if both are equally supported by the available evidence.', '2026-07-08T14:29:17.270885+00:00'),
('recency_manager', '2', '2026-07-08T15:18:40.345+00:00'),
('attachmentmode_manager', 'two', '2026-07-08T15:19:05.461+00:00'),
('template_manager', '- Attachment 1: Previous update of the same report type. Use this as the reference for report structure, writing style and continuity for this report type.
- Attachment 2: Previous update prepared in the other reporting format, covering many of the same projects. Use this only to cross-check project continuity where relevant.
- Most recent previous update for project continuity: Attachment [2].
- Use the most recent previous update to preserve the latest project continuity where it does not conflict with THIS PERIOD''S RAW DATA, which always takes precedence.
- Always follow the FORMAT section for the output. Never mix the format or presentation style of the two report types.
- In addition to project continuity, use the most recent previous update as the primary reference for the reporting style, level of abstraction and project narrative.
- When the current period contains incremental activities on an ongoing initiative, continue the project narrative from the previous report rather than rewriting it solely from the individual task logs.
- Prefer evolving the previous executive summary using this period''s evidence instead of producing an entirely new summary from scratch. The current period''s raw data always takes precedence where there is any conflict.
- Where the previous report already established the project''s objective (for example partner comparison, migration feasibility or commercial closure), retain that objective if it remains consistent with the current raw data instead of restating the underlying activities.
- When deciding between describing individual activities and describing the overall workstream, prefer the workstream if both are equally supported by the available evidence.', '2026-07-08T15:19:05.634+00:00');
