import { createFileRoute } from "@tanstack/react-router";
import { EnvVarSheet } from "#/components/EnvVarSheet";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return <EnvVarSheet />;
}
