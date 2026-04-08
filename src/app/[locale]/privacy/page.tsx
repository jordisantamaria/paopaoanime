import { getTranslations } from "next-intl/server";

export default async function Privacy() {
  const t = await getTranslations("privacy");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>

      <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
        <p>{t("lastUpdated")}</p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("section1Title")}</h2>
        <p>
          {t("section1Text")}
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("section2Title")}</h2>
        <p>
          {t("section2Text")}
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("section3Title")}</h2>
        <p>
          {t("section3Text")}
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("section4Title")}</h2>
        <p>
          {t("section4Text")}
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("section5Title")}</h2>
        <p>
          {t("section5Text")}
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("section6Title")}</h2>
        <p>
          {t("section6Text")}
        </p>
      </div>
    </div>
  );
}
