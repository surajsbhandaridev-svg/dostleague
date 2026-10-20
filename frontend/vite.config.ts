import { defineConfig } from "vitest/config"; import { loadEnv, type Plugin } from "vite"; import react from "@vitejs/plugin-react";
/** Adds Google's site-verification meta tag at build time, only when a syntactically valid publisher ID is configured. */
const adsenseMeta = (client: string): Plugin => ({ name: "adsense-account-meta", transformIndexHtml: (html) => (/^ca-pub-\d{10,20}$/.test(client) ? html.replace("</head>", `<meta name="google-adsense-account" content="${client}"/></head>`) : html) });
export default defineConfig(({ mode }) => ({ plugins: [react(), adsenseMeta(loadEnv(mode, process.cwd(), "VITE_").VITE_ADSENSE_CLIENT ?? "")], test: { environment: "jsdom" } }));
