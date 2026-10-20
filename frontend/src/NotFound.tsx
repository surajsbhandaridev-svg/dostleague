import { Link } from "react-router-dom"; import { usePage, Footer } from "./Public";
export function NotFound() { usePage("Page not found", "This page does not exist.", "/404", { noindex: true }); return <main><h1>Page not found</h1><p>The page you asked for does not exist or is not available.</p><p><Link to="/" className="subtle-link">Go to the DostLeague homepage</Link></p><Footer /></main>; }
