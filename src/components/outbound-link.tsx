"use client";

import { ReactNode } from "react";
import { track } from "@vercel/analytics";

interface OutboundLinkProps {
  href: string;
  /** Where the click sends the user: "youtube" or a platform id (e.g. "netflix"). */
  destination: string;
  /** Slug of the anime the click originated from, for per-title ranking. */
  anime: string;
  className?: string;
  children: ReactNode;
}

/**
 * External link that records a Vercel Analytics custom event on click.
 *
 * The anime detail page is a server component, so the outbound CTAs (YouTube,
 * streaming platforms) need this small client wrapper to attach the `onClick`
 * that fires `track()`. The "outbound_click" event is the directory's real
 * conversion metric — far more meaningful than page views or bounce rate.
 */
export function OutboundLink({ href, destination, anime, className, children }: OutboundLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => track("outbound_click", { destination, anime })}
    >
      {children}
    </a>
  );
}
