"use client";

import Image from "next/image";
import { useState } from "react";

import type { Media, Project } from "@/lib/api/types";

/**
 * Renders a project's demo according to its `demo_type`. Adding a new kind
 * means: add it to the Go enum + migration, to DemoType in lib/api/types.ts,
 * to the select in the CMS editor, and to the switch below.
 *
 * The frame is shared by every kind so projects line up visually, with a mono
 * caption bar standing in for a browser/terminal chrome.
 */
export function ProjectDemo({ project }: { project: Project }) {
  if (project.demo_type === "none") return null;

  return (
    <figure className="overflow-hidden rounded-md border border-line bg-surface">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 font-mono text-[12px] text-faint">
        <span>{captionFor(project)}</span>
        {project.live_url ? (
          <a
            href={project.live_url}
            target="_blank"
            rel="noreferrer"
            className="no-underline hover:text-accent"
          >
            open live
          </a>
        ) : null}
      </figcaption>
      <DemoBody project={project} />
    </figure>
  );
}

function captionFor(project: Project): string {
  switch (project.demo_type) {
    case "iframe":
      return hostOf(project.demo_url);
    case "video":
      return "screen recording";
    case "asciinema":
      return "terminal session";
    case "gallery":
      return `${project.gallery.length} screenshot${project.gallery.length === 1 ? "" : "s"}`;
    default:
      return "";
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function DemoBody({ project }: { project: Project }) {
  switch (project.demo_type) {
    case "iframe":
      return <IframeDemo url={project.demo_url} title={project.title} />;
    case "video":
      return (
        <video
          src={project.demo_url}
          poster={project.cover?.url}
          className="block aspect-video w-full bg-ink"
          controls
          muted
          loop
          playsInline
          preload="metadata"
        />
      );
    case "asciinema":
      return <AsciinemaDemo url={project.demo_url} title={project.title} />;
    case "gallery":
      return <Gallery items={project.gallery} />;
    default:
      return null;
  }
}

/**
 * Live sites load on click, not on page load: a project page with four demos
 * should not pull four third-party sites down with it.
 */
function IframeDemo({ url, title }: { url: string; title: string }) {
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    return (
      <button
        type="button"
        onClick={() => setLoaded(true)}
        className="group flex aspect-video w-full flex-col items-center justify-center gap-2 bg-ink text-muted transition-colors hover:text-fg"
      >
        <span className="font-mono text-[13px]">load live demo</span>
        <span className="font-mono text-[12px] text-faint">{hostOf(url)}</span>
      </button>
    );
  }

  return (
    <iframe
      src={url}
      title={`${title} demo`}
      className="block aspect-video w-full bg-ink"
      loading="lazy"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      referrerPolicy="no-referrer"
    />
  );
}

/**
 * Accepts either a full asciinema.org URL or a bare cast id. The embed is an
 * iframe so no third-party script runs on the page.
 */
function AsciinemaDemo({ url, title }: { url: string; title: string }) {
  const id = url.match(/asciinema\.org\/a\/([\w-]+)/)?.[1] ?? url;
  return (
    <iframe
      src={`https://asciinema.org/a/${id}/embed?theme=nord&autoplay=0`}
      title={`${title} terminal recording`}
      className="block aspect-video w-full bg-ink"
      loading="lazy"
    />
  );
}

function Gallery({ items }: { items: Media[] }) {
  const [index, setIndex] = useState(0);
  if (items.length === 0) {
    return (
      <p className="p-6 text-center font-mono text-[13px] text-faint">
        No screenshots added yet.
      </p>
    );
  }
  const current = items[index];

  return (
    <div>
      <div className="relative aspect-video w-full bg-ink">
        <Image
          src={current.url}
          alt={current.alt_text || ""}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-contain"
        />
      </div>
      {items.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto border-t border-line p-2">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show screenshot ${i + 1}`}
              aria-current={i === index}
              className={`relative h-12 w-20 shrink-0 overflow-hidden rounded border transition-opacity ${
                i === index
                  ? "border-accent opacity-100"
                  : "border-line opacity-60 hover:opacity-100"
              }`}
            >
              <Image
                src={item.url}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
