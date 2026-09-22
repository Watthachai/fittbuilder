import ModuleView from "./ModuleView";

export default async function ModulePage(props: PageProps<"/erp/[module]">) {
  const { module } = await props.params;
  return <ModuleView id={module} />;
}
