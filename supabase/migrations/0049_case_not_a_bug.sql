-- A case can close as "not a bug".
--
-- Case #4 was an error thrown by the React DevTools extension, not by FITT
-- Builder; the only way to close it was "released", which tells the reporter a
-- new version shipped when nothing did. 'not_bug' closes a case honestly: the
-- team looked, and there is nothing to change.

alter table fittbuilder_cases drop constraint if exists fittbuilder_cases_status_check;
alter table fittbuilder_cases add constraint fittbuilder_cases_status_check
  check (status in ('new', 'investigating', 'need_info', 'fixed', 'released', 'not_bug'));

alter table fittbuilder_case_messages drop constraint if exists fittbuilder_case_messages_status_to_check;
alter table fittbuilder_case_messages add constraint fittbuilder_case_messages_status_to_check
  check (status_to in ('new', 'investigating', 'need_info', 'fixed', 'released', 'not_bug'));
