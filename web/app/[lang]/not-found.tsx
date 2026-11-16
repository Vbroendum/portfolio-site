import Link from "next/link";

import { localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { requestLocale } from "@/lib/i18n/server";

/** not-found pages get no params, so the locale comes from the proxy header. */
export default async function NotFound() {
  const locale = await requestLocale();
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-5xl px-5 py-24 sm:px-8">
      <p className="font-mono text-[13px] text-faint">404</p>
      <h1 className="mt-2 text-3xl">{dict.notFound.title}</h1>
      <p className="mt-3 text-muted">{dict.notFound.body}</p>
      <p className="mt-6 font-mono text-[13px]">
        <Link
          href={localePath(locale)}
          className="text-muted no-underline hover:text-accent"
        >
          {dict.notFound.back}
        </Link>
      </p>
    </div>
  );
}
