// ==========================================
// Yield Map 共通ユーティリティ関数・マスターデータ
// ==========================================

// 💡手動の連続増配マスターデータ（※必要に応じて企業を追加していく）
const MANUAL_DIVIDEND_MASTER = {
  "4452": { years: 34, base_dividend: 150.0 }, // 花王
  "8593": { years: 25, base_dividend: 33.0 },  // 三菱HCキャピタル
  "7532": { years: 21, base_dividend: 20.0 },  // パンパシフィック
  "9432": { years: 13, base_dividend: 4.8 }    // NTT（※株式分割考慮後）
};

// 🎯 配当履歴とマスターから「連続増配年数」を計算するハイブリッド関数
function getConsecutiveYears(historyData, currentDividend, code) {
  let edinetCount = 0;
  let latestDiv = parseFloat(currentDividend) || 0;

  // 1. EDINETの過去5年データからの自動計算
  try {
    const hist = typeof historyData === 'string' ? JSON.parse(historyData) : historyData;
    if (Array.isArray(hist) && hist.length >= 2) {
      // 降順（新しい年が先頭）になるようソート
      hist.sort((a, b) => {
        const yearA = parseInt(a.year || (a.date ? a.date.split('-')[0] : 0));
        const yearB = parseInt(b.year || (b.date ? b.date.split('-')[0] : 0));
        return yearB - yearA;
      });

      let count = 0;
      for (let i = 0; i < hist.length - 1; i++) {
        const cur = parseFloat(hist[i].dividend || hist[i].amount) || 0;
        const prev = parseFloat(hist[i+1].dividend || hist[i+1].amount) || 0;
        if (cur > prev && prev > 0) {
          count++;
        } else {
          break;
        }
      }
      if (count > 0) edinetCount = count + 1; // 1回増配＝2期連続
    }
  } catch (e) {}

  // 2. 手動マスターとの突き合わせ（差分更新ロジック）
  if (MANUAL_DIVIDEND_MASTER[code]) {
    const master = MANUAL_DIVIDEND_MASTER[code];
    const baseDiv = master.base_dividend;
    const baseYears = master.years;

    // 最新の配当がマスターの基準配当を上回っていればインクリメント
    if (latestDiv > baseDiv && baseDiv > 0) {
      return baseYears + 1;
    } else if (latestDiv === baseDiv) {
      return baseYears; // 維持
    } else if (latestDiv < baseDiv && latestDiv > 0) {
      return 0; // 減配したらリセット
    }
    return baseYears; // データ不足時などはマスターの値をそのまま返す
  }

  // マスターにない企業はEDINETの計算結果を返す
  return edinetCount;
}