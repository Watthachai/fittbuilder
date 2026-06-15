"use client";

import { useEffect, useState } from "react";

/**
 * Bridge page required by @webcontainer/api when a preview is opened in a
 * separate tab: the preview navigates to <origin>/webcontainer/connect/<id>
 * and setupConnect() relays MessagePorts between the opener (studio tab)
 * and StackBlitz's connect frame. Without this route the open-in-new-tab
 * button 404s.
 */
export default function WebContainerConnectPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void import("@webcontainer/api/connect")
      .then(({ setupConnect }) => setupConnect())
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "เชื่อมต่อ preview ไม่สำเร็จ");
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-night">
      <p className="font-mono text-sm text-chalk-dim">
        {error ?? "กำลังเชื่อมต่อ preview…"}
      </p>
    </div>
  );
}
