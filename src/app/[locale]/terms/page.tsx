import { getTranslations } from "next-intl/server";

export default async function Terms() {
  const t = await getTranslations("terms");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>

      <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
        <p>{t("lastUpdated")}</p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("article1Title")}</h2>
        <p>
          {t("article1Text")}
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("article2Title")}</h2>
        <p>
          {t("article2Text")}
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("article3Title")}</h2>
        <p>
          {t("article3Text")}
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("article4Title")}</h2>
        <p>
          {t("article4Text")}
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("article5Title")}</h2>
        <p>
          {t("article5Text")}
        </p>
      </div>
    </div>
  );
}
