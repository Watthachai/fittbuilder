-- Telling "it finished while you were away" apart from "it died".
--
-- 0034 parked what a turn produced so closing the tab stopped costing the work.
-- Then the server was fixed to actually finish the turn on its own (the
-- cookies()-inside-the-stream bug), and that changed what a parked draft MEANS:
-- most of them are now completed work waiting to be picked up, not wreckage.
--
-- Asking "do you want to recover these files?" is the wrong question for that.
-- Someone who sent a prompt and closed the tab should come back to the ANSWER,
-- the way any background job works — not to a dialog asking whether they would
-- like the answer. The recovery dialog is right only for the genuinely
-- interrupted case: the server itself went down mid-turn (a deploy, a timeout).
--
-- The two are distinguishable at exactly one point — the final park, which runs
-- after the canonical build files are injected and before `done` is sent. This
-- flag is set there and nowhere else.
alter table fittbuilder_project_drafts
  add column if not exists complete boolean not null default false;

notify pgrst, 'reload schema';
