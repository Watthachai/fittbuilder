"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deliveredWork, type DeliveredProject } from "@/lib/org-modules";
import { formatTHB } from "@/lib/quote";

/**
 * What this workspace has had built, module by module (lib/org-modules).
 *
 * Read with the viewer's own rights: a project they cannot open is not listed,
 * and neither are its modules. The modules come from each project's proposal,
 * where "แตกเป็นโมดูลด้วย AI" puts them — this page only reads.
 */
export default function OrgModules({ orgId }: { orgId: string }) {
  const [work, setWork] = useState<DeliveredProject[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const { data: projects } = await supabase
        .from("fittbuilder_projects")
        .select("id, name, updated_at")
        .eq("org_id", orgId)
        .order("updated_at", { ascending: false });
      const ids = (projects ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      // Only the parts read here: a proposal's screen manual and a quotation's
      // letterhead are most of their size, and neither is needed.
      const [{ data: proposals }, { data: quotes }] = await Promise.all([
        supabase.from("fittbuilder_project_proposals").select("project_id, version, modules:payload->modules").in("project_id", ids),
        supabase
          .from("fittbuilder_project_quotes")
          .select("project_id, version, rows:payload->rows, rate:payload->ratePerDay")
          .in("project_id", ids),
      ]);
      return deliveredWork(projects ?? [], proposals ?? [], quotes ?? []);
    };
    void load()
      .catch(() => [])
      .then((w) => {
        if (!cancelled) setWork(w);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const moduleCount = (work ?? []).reduce((n, p) => n + p.modules.length, 0);

  return (
    <section className="mt-7 rounded-xl border border-night-edge bg-night-panel p-4">
      <div className="flex items-center gap-2">
        <Boxes size={15} className="text-shine" />
        <h2 className="font-display text-sm font-semibold">งานที่ทำให้องค์กรนี้</h2>
        {work && work.length > 0 && (
          <span className="ml-auto font-mono text-[12px] text-chalk-dim">
            {work.length} โปรเจกต์ · {moduleCount} โมดูล
          </span>
        )}
      </div>
      <p className="mt-1 text-[13px] text-chalk-dim">
        แต่ละโปรเจกต์แยกเป็นโมดูลตามที่แตกไว้ในแท็บข้อเสนอโครงการ ราคาดึงจากรายการในใบเสนอราคาที่ชื่อตรงกับโมดูล
      </p>

      {work === null ? (
        <p className="mt-3 inline-flex items-center gap-2 text-[13px] text-chalk-dim">
          <Loader2 size={13} className="animate-spin text-shine" /> กำลังอ่านโปรเจกต์ขององค์กรนี้…
        </p>
      ) : work.length === 0 ? (
        <p className="mt-3 text-[13px] text-chalk-dim">ยังไม่มีโปรเจกต์ในองค์กรนี้</p>
      ) : (
        <div className="mt-3 space-y-2">
          {work.map((p) => (
            <div key={p.id} className="rounded-lg border border-night-edge bg-night px-3 py-2.5">
              <div className="flex items-center gap-3">
                <p className="min-w-0 flex-1 truncate font-display text-[13.5px] text-chalk">{p.name}</p>
                <Link href={`/project/${p.id}`} className="shrink-0 text-[12.5px] text-shine hover:underline">
                  เปิดโปรเจกต์
                </Link>
              </div>
              {p.modules.length === 0 ? (
                <p className="mt-1 text-[12.5px] text-chalk-dim">
                  ยังไม่ได้แตกโมดูล — เปิดโปรเจกต์ แล้วกด “แตกเป็นโมดูลด้วย AI” ในแท็บข้อเสนอโครงการ
                </p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {p.modules.map((m) => (
                    <li key={m.name} className="flex flex-wrap items-baseline gap-x-3 text-[12.5px]">
                      <span className="min-w-0 flex-1 text-chalk">{m.name}</span>
                      <span className="text-chalk-dim">
                        {m.parts} ระบบย่อย · {m.screens} หน้าจอ
                      </span>
                      <span className="w-28 text-right font-mono text-chalk">
                        {m.price === null ? "—" : m.price === 0 ? "รวมในดีล" : formatTHB(m.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
