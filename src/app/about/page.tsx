export default function About() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">PaoPaoAnimeについて</h1>

      <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
        <p>
          PaoPaoAnimeは、日本国内のアニメ配信スケジュールをまとめて確認できるサービスです。
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">なぜ作ったのか</h2>
        <p>
          日本でアニメを観るとき、DMM TV、U-NEXT、dアニメストア、ABEMA、Netflix、Amazon Prime Video、Disney+…と配信プラットフォームが多すぎて、「あのアニメはどこで何曜日に配信されるのか」を調べるのが大変です。
        </p>
        <p>
          各プラットフォームの公式サイトを一つ一つ確認するのは非効率。PaoPaoAnimeは、すべてのプラットフォームの配信情報を一箇所にまとめ、曜日・時間・プラットフォーム別にかんたんに確認できるようにしました。
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">機能</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>今期アニメの最新エピソード一覧</li>
          <li>曜日別の配信スケジュール</li>
          <li>プラットフォーム別フィルター（複数選択可）</li>
          <li>各アニメの詳細ページ（あらすじ、配信先リンク）</li>
          <li>アニメ検索</li>
        </ul>

        <h2 className="text-base font-bold text-text-primary pt-2">対応プラットフォーム</h2>
        <p>
          DMM TV / U-NEXT / dアニメストア / ABEMA / Amazon Prime Video / Netflix / Disney+
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">データについて</h2>
        <p>
          配信スケジュールのデータは各プラットフォームの公式情報を元に、毎シーズン更新しています。情報の正確性には万全を期していますが、実際の配信スケジュールは各プラットフォームの公式サイトでご確認ください。
        </p>

        <h2 className="text-base font-bold text-text-primary pt-2">お問い合わせ</h2>
        <p>
          ご意見・ご要望・データの誤りなどがございましたら、<a href="https://github.com/jordisantamaria/anime-schedule/issues" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover underline">GitHubのIssue</a>にてご連絡ください。
        </p>
      </div>
    </div>
  );
}
