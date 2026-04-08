import { getTranslations } from "next-intl/server";
import { getDroppedAnimeList } from "@/actions/drops";
import { getAnimeBySlug } from "@/lib/data";
import { DropsContent } from "@/components/drops-content";

export const dynamic = "force-dynamic";

export default async function DropsPage() {
  const t = await getTranslations("drops");
  const dropped = await getDroppedAnimeList();

  const items = await Promise.all(
    dropped.map(async (d) => ({
      slug: d.slug,
      anime: (await getAnimeBySlug(d.slug)) ?? null,
    }))
  );

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold">{t("title")}</h1>
      <p className="mb-6 text-xs text-text-muted">
        {t("description")}
      </p>
      <DropsContent items={items} />
    </div>
  );
}
