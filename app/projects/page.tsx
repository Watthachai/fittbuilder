import type { Metadata } from "next";
import ProjectGrid from "@/components/projects/ProjectGrid";

export const metadata: Metadata = {
  title: "ผลงานของฉัน",
};

export default function ProjectsPage() {
  return <ProjectGrid />;
}
