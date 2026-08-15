// Yield Map 共通ユーティリティ関数・マスターデータ

// 🎯 グローバルに読み込まれたマスターデータから「連続増配年数」を取得する関数
function getConsecutiveYears(historyData, currentDividend, code) {
  // バックエンド(Python)側で全銘柄の計算と手動上書きが完了しているため、
  // JS側ではループ計算を捨てて window.manualConsecutiveYears を参照するだけにする
  if (window.manualConsecutiveYears && window.manualConsecutiveYears[code]) {
    return window.manualConsecutiveYears[code].years || 0;
  }

  // 読み込み失敗時やデータが存在しない場合のフォールバック
  return 0;
}