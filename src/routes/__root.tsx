import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import appCss from "../styles.css?url";

const SITE_URL = "https://envvars.xyz";
const SITE_NAME = "Envvars";
const TITLE = "Envvars — Organize, Diff & Export Environment Variables";
const DESCRIPTION =
	"Envvars is a spreadsheet for your .env files. Sort, compare, and diff environment variables across dev, staging, and production, then import or export them in seconds.";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

const structuredData = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: SITE_NAME,
	url: SITE_URL,
	description: DESCRIPTION,
	applicationCategory: "DeveloperApplication",
	operatingSystem: "Any",
	offers: {
		"@type": "Offer",
		price: "0",
		priceCurrency: "USD",
	},
};

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: TITLE,
			},
			{
				name: "description",
				content: DESCRIPTION,
			},
			{
				name: "theme-color",
				content: "#030712",
			},
			{
				name: "robots",
				content: "index, follow",
			},
			// Open Graph
			{
				property: "og:type",
				content: "website",
			},
			{
				property: "og:url",
				content: SITE_URL,
			},
			{
				property: "og:site_name",
				content: SITE_NAME,
			},
			{
				property: "og:title",
				content: TITLE,
			},
			{
				property: "og:description",
				content: DESCRIPTION,
			},
			{
				property: "og:image",
				content: OG_IMAGE,
			},
			{
				property: "og:image:width",
				content: "1200",
			},
			{
				property: "og:image:height",
				content: "630",
			},
			{
				property: "og:image:alt",
				content: "Envvars — organize, diff, and export environment variables",
			},
			{
				property: "og:locale",
				content: "en_US",
			},
			// Twitter
			{
				name: "twitter:card",
				content: "summary_large_image",
			},
			{
				name: "twitter:title",
				content: TITLE,
			},
			{
				name: "twitter:description",
				content: DESCRIPTION,
			},
			{
				name: "twitter:image",
				content: OG_IMAGE,
			},
			{
				name: "twitter:image:alt",
				content: "Envvars — organize, diff, and export environment variables",
			},
		],
		links: [
			{
				rel: "canonical",
				href: SITE_URL,
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
			},
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				href: "/favicon.ico",
			},
			{
				rel: "manifest",
				href: "/manifest.json",
			},
		],
		scripts: [
			{
				type: "application/ld+json",
				children: JSON.stringify(structuredData),
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
