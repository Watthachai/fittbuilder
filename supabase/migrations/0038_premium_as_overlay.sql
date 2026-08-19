-- Premium stops being a second copy and becomes what it always was: the base
-- plus the part that is sold.
--
-- 0031 stored each version as a complete file map, so the two drifted. Work done
-- while Premium was active stayed in Premium even when it had nothing to do with
-- the upgrade, and a real project proved it: 41 files on Premium against 28 on
-- Standard, with FAQ, About, Contact, Blog, Reviews, ArticleDetail and Privacy
-- existing ONLY on the paid side. Exporting Standard for a customer would have
-- shipped a demo missing seven ordinary pages.
--
-- The relationship the product actually has is one-directional: Standard is the
-- base, Premium is the base with some files replaced or added. So the parked
-- Premium row now holds only the files that DIFFER from the base — the 3D
-- viewer, the product page that embeds it, the package.json that installs it —
-- and switching recomputes the view instead of restoring a snapshot. Base work
-- reaches Premium for free; Premium work never leaks down.
--
-- `base_sha` records which base an override was captured against. Without it
-- there is no way to tell "Premium deliberately replaces this file" from "the
-- base moved underneath and Premium is now shadowing a stale copy" — the second
-- is the one worth warning about, and it is invisible otherwise.

alter table fittbuilder_project_versions
  add column if not exists base_sha text;

/** Switch tiers, treating Premium as an overlay on Standard.

    Returns { files, shadowed } — `shadowed` lists overlay files whose base has
    changed since the overlay was captured. Those are the only real conflicts in
    this model: Premium deliberately replaces a file, and the file it replaces
    has since moved. Silence there means the base edit quietly does nothing on
    the paid side, which is the kind of bug found months later by a customer. */
create or replace function fittbuilder_switch_version(
  pid uuid,
  from_key text,
  to_key text,
  outgoing jsonb
) returns jsonb language plpgsql security invoker as $$
declare
  base jsonb;
  overlay jsonb;
  incoming jsonb;
  captured text;
  shadowed jsonb := '[]'::jsonb;
begin
  if from_key = to_key then
    raise exception 'switch to the same version (%) is not a switch', to_key;
  end if;

  if to_key = 'premium' then
    -- Leaving the base: it IS `outgoing`. The overlay is whatever was parked,
    -- and the Premium view is the base with the overlay laid over it — so every
    -- change made to the base since last time is already in the result.
    base := outgoing;
    select files, base_sha into overlay, captured
      from fittbuilder_project_versions where project_id = pid and key = 'premium';
    incoming := base || coalesce(overlay, '{}'::jsonb);
    -- The base moved under the overlay: every file the overlay replaces is now
    -- hiding a newer version of itself.
    if captured is not null and captured <> md5(base::text) then
      select coalesce(jsonb_agg(k order by k), '[]'::jsonb) into shadowed
        from jsonb_object_keys(coalesce(overlay, '{}'::jsonb)) k
       where base ? k;
    end if;
  else
    -- Leaving Premium: keep only what it actually adds. Anything identical to
    -- the base is base work that happens to have been done here, and carrying it
    -- in the overlay is what made the two versions drift apart.
    select files into base
      from fittbuilder_project_versions where project_id = pid and key = 'standard';
    base := coalesce(base, '{}'::jsonb);
    select coalesce(jsonb_object_agg(k, outgoing -> k), '{}'::jsonb)
      into overlay
      from jsonb_object_keys(outgoing) k
     where base -> k is distinct from outgoing -> k;
    incoming := base;
  end if;

  update fittbuilder_projects
     set files = incoming,
         active_version = to_key,
         updated_at = now()
   where id = pid;
  if not found then
    raise exception 'no permission to switch project %', pid;
  end if;

  delete from fittbuilder_project_versions where project_id = pid and key = to_key;

  insert into fittbuilder_project_versions (project_id, key, files, base_sha, updated_at)
    values (
      pid,
      from_key,
      case when from_key = 'premium' then overlay else outgoing end,
      -- Only an overlay needs to remember its base; a parked base has none.
      case when from_key = 'premium' then md5(base::text) else null end,
      now()
    )
    on conflict (project_id, key)
      do update set files = excluded.files,
                    base_sha = excluded.base_sha,
                    updated_at = excluded.updated_at;

  return jsonb_build_object('files', incoming, 'shadowed', shadowed);
end;
$$;

notify pgrst, 'reload schema';
