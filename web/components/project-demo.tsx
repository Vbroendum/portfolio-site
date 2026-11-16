"use client";

import Image from "next/image";
import { useState } from "react";

import type { Media, Project } from "@/lib/api/types";
import { format, type Dictionary } from "@/lib/i18n/dictionaries";

type Labels = Dictionary["demo"];

/**
 * Renders a project's demo according to its `demo_type`. Adding a new kind
 * means: add it to the Go enum + migration, to DemoType in lib/api/types.ts,
 * to the select in the CMS editor, and to the switch below.
 *
 * The frame is shared by every kind so projects line up visually, with a mono
 * caption bar standing in for a browser/terminal chrome.
 *
 * It is a client component, so its strings arrive as plain `labels` from the
 * page's dictionary rather than being looked up here.
 */
export function ProjectDemo({
  project,
  labels,
}: {
  project: Project;
  labels: Labels;
}) {
  if (project.demo_type === "none") return null;

  return (
    <figure className="overflow-hidden rounded-md border border-line bg-surface">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 font-mono text-[12px] text-faint">
        <span>{captionFor(project, labels)}</span>
        {project.live_url ? (
          <a
            href={project.live_url}
            target="_blank"
            rel="noreferrer"
            className="no-underline hover:text-accent"
          >
            {labels.openLive}
          </a>
        ) : null}
      </figcaption>
      <DemoBody project={project} labels={labels} />
    </figure>
  );
}

function captionFor(project: Project, labels: Labels): string {
  switch (project.demo_type) {
    case "iframe":
      return hostOf(project.demo_url);
    case "video":
      return labels.screenRecording;
    case "asciinema":
      return labels.terminalSession;
    case "gallery":
      return project.gallery.length === 1
        ? labels.screenshotOne
        : format(labels.screenshotMany, { n: project.gallery.length });
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

function DemoBody({ project, labels }: { project: Project; labels: Labels }) {
  switch (project.demo_type) {
    case "iframe":
      return (
        <IframeDemo
          url={project.demo_url}
          title={format(labels.iframeTitle, { title: project.title })}
          loadLabel={labels.loadLive}
        />
      );
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
      return (
        <AsciinemaDemo
          url={project.demo_url}
          title={format(labels.terminalTitle, { title: project.title })}
        />
      );
    case "gallery":
      return <Gallery items={project.gallery} labels={labels} />;
    default:
      return null;
  }
}

/**
 * Live sites load on click, not on page load: a project page with four demos
 * should not pull four third-party sites down with it.
 */
function IframeDemo({
  url,
  title,
  loadLabel,
}: {
  url: string;
  title: string;
  loadLabel: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    return (
      <button
        type="button"
        onClick={() => setLoaded(true)}
        className="group flex aspect-video w-full flex-col items-center justify-center gap-2 bg-ink text-muted transition-colors hover:text-fg"
      >
        <span className="font-mono text-[13px]">{loadLabel}</span>
        <span className="font-mono text-[12px] text-faint">{hostOf(url)}</span>
      </button>
    );
  }

  return (
    <iframe
      src={url}
      title={title}
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
      title={title}
      className="block aspect-video w-full bg-ink"
      loading="lazy"
    />
  );
}

function Gallery({ items, labels }: { items: Media[]; labels: Labels }) {
  const [index, setIndex] = useState(0);
  if (items.length === 0) {
    return (
      <p className="p-6 text-center font-mono text-[13px] text-faint">
        {labels.noScreenshots}
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
              aria-label={format(labels.showScreenshot, { n: i + 1 })}
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
