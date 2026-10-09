-- A case can be reported from an AI reply in the chat.
--
-- Not every problem shows up as an error screen: the AI can stop short, say a
-- turn finished when it did not, or answer something off. The chat now has a
-- "แจ้งปัญหา" button under each reply; its cases get their own kind so the team
-- can tell them from preview and runtime failures. The reply itself travels in
-- context.aiReply (lib/cases.ts).

alter table fittbuilder_cases drop constraint if exists fittbuilder_cases_kind_check;
alter table fittbuilder_cases add constraint fittbuilder_cases_kind_check
  check (kind in ('preview', 'runtime', 'generation', 'ai_reply', 'other'));
