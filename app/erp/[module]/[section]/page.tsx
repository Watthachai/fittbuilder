import ModuleView from "../ModuleView";

/**
 * One capability per address. The segment is the 1-based position in the
 * module's `keyFeatures`, which keeps the URL stable when a Thai capability name
 * is renamed and keeps it out of percent-encoding.
 */
export default async function SectionPage(props: PageProps<"/erp/[module]/[section]">) {
  const { module, section } = await props.params;
  return <ModuleView id={module} sectionIndex={Math.max(0, Number(section) - 1)} />;
}
