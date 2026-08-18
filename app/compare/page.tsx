import { Suspense } from "react";
import CompareShell from "@/components/compare/CompareShell";

export const metadata = { title: "เทียบเดโม" };

/**
 * Side-by-side demo comparison, one tab per project.
 *
 * The shell reads its selection from the query string, so it must sit behind a
 * Suspense boundary — useSearchParams opts the tree into client rendering and
 * Next needs a fallback for the prerender.
 */
export default function ComparePage() {
  return (
    <Suspense fallback={<div className="h-screen bg-night" />}>
      <CompareShell />
    </Suspense>
  );
}
