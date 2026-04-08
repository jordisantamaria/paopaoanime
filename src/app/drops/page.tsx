import { getDroppedAnimeList } from "@/actions/drops";
import { getAnimeBySlug } from "@/lib/data";
import { DropsContent } from "@/components/drops-content";

export const dynamic = "force-dynamic";

export default async function DropsPage() {
  const dropped = await getDroppedAnimeList();

  const items = await Promise.all(
    dropped.map(async (d) => ({
      slug: d.slug,
      anime: (await getAnimeBySlug(d.slug)) ?? null,
    }))
  );

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold">切り捨てリスト</h1>
      <p className="mb-6 text-xs text-text-muted">
        ホーム画面から非表示にした作品の一覧です。「Remove」で完全に削除、「Undo」で取り消せます。
      </p>
      <DropsContent items={items} />
    </div>
  );
}
