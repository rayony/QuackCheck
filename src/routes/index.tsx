import { createFileRoute } from "@tanstack/react-router";
import { Wizard } from "@/components/quackcheck/Wizard";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Wizard />;
}
