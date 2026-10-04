import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="standalone-state">
      <div className="standalone-state__icon">
        <SearchX size={28} />
      </div>
      <p className="eyebrow">404 / Not found</p>
      <h1>This signal went quiet.</h1>
      <p>The page or lead you were looking for does not exist.</p>
      <Link className="button button--primary" href="/">
        <ArrowLeft size={16} /> Back to overview
      </Link>
    </main>
  );
}

