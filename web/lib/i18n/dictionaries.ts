/**
 * Every string the public site itself owns, per locale. Content (posts,
 * projects, CV, settings) is translated in the CMS instead.
 *
 * `en` defines the shape and `da` must match it, so a missing Danish string is
 * a type error rather than a blank on the page.
 *
 * Placeholders like {n} and {title} are filled with `format()`. Values stay
 * plain strings, not functions, so a slice of the dictionary can be passed to
 * a client component as props.
 *
 * House style applies to both languages: plain hyphens, no em or en dashes.
 */
import type { Locale } from "./config";

const en = {
  meta: {
    fallbackTitle: "Portfolio",
  },
  nav: {
    label: "Primary",
    work: "work",
    writing: "writing",
    cv: "cv",
    about: "about",
    switchLanguage: "Dansk",
    switchLanguageLabel: "Læs siden på dansk",
  },
  footer: {
    rss: "rss",
  },
  home: {
    heroFallback: "I build things, mostly small and sharp.",
    otherWork: "Other work",
    allProjects: "all projects",
    recentWriting: "Recent writing",
    allPosts: "all posts",
    aboutFallback: "About",
    more: "more",
  },
  about: {
    title: "About",
    empty: "Nothing here yet.",
  },
  blog: {
    title: "Writing",
    description: "Notes on things I build.",
    filterLabel: "Filter by tag",
    allTags: "all",
    noneTagged: 'Nothing tagged "{tag}" yet.',
    back: "← writing",
    minRead: "{n} min read",
    untranslated: "This post has not been translated, so it is shown in English.",
  },
  projects: {
    title: "Work",
    description: "Projects, with demos you can actually run.",
    intro:
      "Things I have built. Most have a demo you can poke at on the project page.",
    empty: "No projects published yet.",
    featured: "featured",
    back: "← work",
    source: "source",
    liveSite: "live site",
    untranslated:
      "This write-up has not been translated, so it is shown in English.",
  },
  demo: {
    screenRecording: "screen recording",
    terminalSession: "terminal session",
    screenshotOne: "1 screenshot",
    screenshotMany: "{n} screenshots",
    openLive: "open live",
    loadLive: "load live demo",
    noScreenshots: "No screenshots added yet.",
    showScreenshot: "Show screenshot {n}",
    iframeTitle: "{title} demo",
    terminalTitle: "{title} terminal recording",
  },
  cv: {
    title: "CV",
    description: "Experience, education and the tools I reach for.",
    experience: "Experience",
    education: "Education",
    certification: "Certifications",
    skill: "Skills",
    other: "Also",
    empty: "No CV entries yet.",
    now: "now",
  },
  notFound: {
    title: "That page is not here.",
    body: "It may have been renamed, or it may never have existed.",
    back: "back to the start",
  },
};

export type Dictionary = typeof en;

const da: Dictionary = {
  meta: {
    fallbackTitle: "Portfolio",
  },
  nav: {
    label: "Hovedmenu",
    work: "projekter",
    writing: "blog",
    cv: "cv",
    about: "om",
    switchLanguage: "English",
    switchLanguageLabel: "Read this page in English",
  },
  footer: {
    rss: "rss",
  },
  home: {
    heroFallback: "Jeg bygger ting, for det meste små og skarpe.",
    otherWork: "Andre projekter",
    allProjects: "alle projekter",
    recentWriting: "Seneste indlæg",
    allPosts: "alle indlæg",
    aboutFallback: "Om mig",
    more: "mere",
  },
  about: {
    title: "Om mig",
    empty: "Her er ikke noget endnu.",
  },
  blog: {
    title: "Blog",
    description: "Noter om ting, jeg bygger.",
    filterLabel: "Filtrer efter tag",
    allTags: "alle",
    noneTagged: 'Intet med tagget "{tag}" endnu.',
    back: "← blog",
    minRead: "{n} min. læsning",
    untranslated:
      "Dette indlæg er ikke oversat endnu, så det vises på engelsk.",
  },
  projects: {
    title: "Projekter",
    description: "Projekter med demoer, du rent faktisk kan prøve.",
    intro:
      "Ting, jeg har bygget. De fleste har en demo, du kan prøve af på projektsiden.",
    empty: "Ingen projekter udgivet endnu.",
    featured: "udvalgt",
    back: "← projekter",
    source: "kildekode",
    liveSite: "live side",
    untranslated:
      "Denne beskrivelse er ikke oversat endnu, så den vises på engelsk.",
  },
  demo: {
    screenRecording: "skærmoptagelse",
    terminalSession: "terminalsession",
    screenshotOne: "1 skærmbillede",
    screenshotMany: "{n} skærmbilleder",
    openLive: "åbn live",
    loadLive: "indlæs live-demo",
    noScreenshots: "Ingen skærmbilleder endnu.",
    showScreenshot: "Vis skærmbillede {n}",
    iframeTitle: "{title}, demo",
    terminalTitle: "{title}, terminaloptagelse",
  },
  cv: {
    title: "CV",
    description: "Erfaring, uddannelse og de værktøjer, jeg bruger.",
    experience: "Erfaring",
    education: "Uddannelse",
    certification: "Certificeringer",
    skill: "Kompetencer",
    other: "Andet",
    empty: "Ingen CV-punkter endnu.",
    now: "nu",
  },
  notFound: {
    title: "Den side findes ikke.",
    body: "Den er måske blevet omdøbt, eller også har den aldrig eksisteret.",
    back: "tilbage til forsiden",
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { en, da };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** Fills {name} placeholders: format("{n} min read", { n: 4 }). */
export function format(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
