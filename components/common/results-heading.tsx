"use client";

import { useEffect, useRef } from "react";

export function ResultsHeading({
  children,
  onFocusRequested,
  announcement,
}: {
  children: React.ReactNode;
  onFocusRequested?: boolean;
  announcement?: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const announcementRef = useRef<HTMLDivElement>(null);

  // Move focus to heading when requested (after user-initiated page change)
  useEffect(() => {
    if (onFocusRequested && headingRef.current) {
      headingRef.current.focus();
    }
  }, [onFocusRequested]);

  return (
    <div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-cyan-300"
      >
        {children}
      </h2>

      {/* Screen reader announcement region for pagination updates */}
      {announcement && (
        <div
          ref={announcementRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announcement}
        </div>
      )}
    </div>
  );
}
