import { getAllSkills } from "@/lib/skills/db";

/** Built-in + published custom skill templates, for the client SkillDropdown. */
export async function GET() {
  const skills = await getAllSkills();
  return Response.json({ skills });
}
