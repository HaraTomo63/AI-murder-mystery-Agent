import Link from "next/link";

export default function HomePage() {
  return (
    <section className="card">
      <h2>ゲームフロー</h2>
      <ol>
        <li>ログイン → ニックネーム設定</li>
        <li>新規セッション作成（世界観/属性/難易度/画像タグ）</li>
        <li>導入文・イラストを確認して会話開始</li>
        <li>残り回数0で提出画面へ強制遷移</li>
        <li>犯人＋矛盾立証提出 → 採点 → 履歴</li>
      </ol>
      <Link href="/sessions/new">セッションを開始する</Link>
    </section>
  );
}
