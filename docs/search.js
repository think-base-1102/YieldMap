/**
 * 検索条件を受け取り、適切なページへ遷移する
 *
 * 設計方針：
 * - 検索結果が1件のみ → 個別銘柄ページ
 * - 0件 or 複数件 → results.html に遷移し、選択させる
 * - フィルタ条件は将来拡張用として URL にのみ付与
 *
 * @param {Object} options
 * @param {string} options.query - 検索文字列（必須）
 * @param {boolean} [options.dividend=false] - 配当あり（将来用）
 * @param {boolean} [options.yutai=false] - 優待あり（将来用）
 */
async function searchStock(options) {
  if (!options || typeof options.query !== "string") return;

  const {
    query: rawQuery,
    dividend = false,
    yutai = false
  } = options;

  // --- 検索文字列正規化 ---
  const query = rawQuery
    .replace(/[０-９]/g, s =>
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    )
    .toLowerCase()
    .trim();

  if (!query) return;

  // --- 銘柄データ取得 ---
  let stocks = [];
  try {
    const res = await fetch("stocks.json");
    if (!res.ok) throw new Error("fetch failed");
    stocks = await res.json();
  } catch (e) {
    console.error("stocks.json 読み込み失敗", e);
    return;
  }

  // --- 検索処理 ---
  // ・コード：部分一致（720 → 7201, 7203 など）
  // ・銘柄名：部分一致
  const matched = stocks.filter(stock =>
    stock.code.includes(query) ||
    stock.name.toLowerCase().includes(query)
  );

  // --- 遷移制御 ---
  // 1件のみ → 直接個別ページ
  if (matched.length === 1) {
    location.href = `stocks/${matched[0].file}`;
    return;
  }

  // 0件 or 複数件 → results.html
  const params = new URLSearchParams();
  params.set("q", query);

  // 将来用フィルタ（results.html 側で解釈）
  if (dividend) params.set("dividend", "1");
  if (yutai) params.set("yutai", "1");

  location.href = `results.html?${params.toString()}`;
}
