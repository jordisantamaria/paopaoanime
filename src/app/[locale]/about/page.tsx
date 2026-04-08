import { getTranslations } from "next-intl/server";

export default async function About() {
  const t = await getTranslations("about");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>

      <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
        <p>
          {t("intro")}
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("whyTitle")}</h2>
        <p>
          {t("whyText1")}
        </p>
        <p>
          {t("whyText2")}
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("featuresTitle")}</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>{t("feature1")}</li>
          <li>{t("feature2")}</li>
          <li>{t("feature3")}</li>
          <li>{t("feature4")}</li>
          <li>{t("feature5")}</li>
        </ul>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("platformsTitle")}</h2>
        <p>
          {t("platformsList")}
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("dataTitle")}</h2>
        <p>
          {t("dataText")}
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">{t("contactTitle")}</h2>
        <p>
          {(() => {
            const text = t("contactText", { email: "jordisantamaria1a@gmail.com" });
            const parts = text.split("jordisantamaria1a@gmail.com");
            return (
              <>
                {parts[0]}
                <a href="mailto:jordisantamaria1a@gmail.com" className="text-accent hover:text-accent-hover underline">
                  jordisantamaria1a@gmail.com
                </a>
                {parts[1]}
              </>
            );
          })()}
        </p>
      </div>
    </div>
  );
}
