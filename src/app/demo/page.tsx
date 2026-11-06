import { Workspace } from "@/components/workspace";
import { demoData } from "@/lib/demo";
export default function Demo() {
  return <Workspace initial={demoData} demo />;
}
