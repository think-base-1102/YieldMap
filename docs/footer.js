// Yield Map 共通フッター（EDINET利用規約準拠・法的リンク含む）

document.addEventListener("DOMContentLoaded", () => {
  const footerContainer = document.getElementById("common-footer");
  if (!footerContainer) return;

  // 現在のパスを取得し、下層フォルダの中にいるか判定
  const isSubDir = window.location.pathname.includes('/stock/') || 
                   window.location.pathname.includes('/dividend/') || 
                   window.location.pathname.includes('/category/') ||
                   window.location.pathname.includes('/yutai/');
  const basePath = isSubDir ? '../' : '';

  // 💡 スマホ時の下部ナビゲーション干渉防止と、リンクの折り返し余白（gap）を最適化
  const footerHtml = `
    <style>
      @media (max-width: 767.98px) {
        .footer-links { gap: 12px !important; }
        .footer-links a { font-size: 0.85rem; }
        /* 下部固定ナビ（bottom-nav）やiOSのセーフエリアと被らないように余白を大幅に追加 */
        .common-footer-wrap { padding-bottom: calc(90px + env(safe-area-inset-bottom)) !important; }
      }
    </style>
    <footer class="common-footer-wrap mt-5 pt-4 pb-4 text-center text-muted small" style="background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
      <div class="container">
        <div class="footer-links mb-3 d-flex justify-content-center flex-wrap" style="gap: 1.5rem;">
          <a href="${basePath}about.html" class="text-decoration-none text-secondary fw-bold" style="border-bottom: 1px dotted #6c757d;">コンセプト・運営者情報</a>
          <!-- 🌟 ここに「全上場企業一覧」のリンクを追加 -->
          <a href="${basePath}all_stocks.html" class="text-decoration-none text-secondary fw-bold" style="border-bottom: 1px dotted #6c757d;">全上場企業一覧</a>
          <a href="${basePath}disclaimer.html" class="text-decoration-none text-secondary fw-bold" style="border-bottom: 1px dotted #6c757d;">免責事項・利用規約</a>
          <a href="${basePath}privacy.html" class="text-decoration-none text-secondary fw-bold" style="border-bottom: 1px dotted #6c757d;">プライバシーポリシー</a>
          <a href="${basePath}contact.html" class="text-decoration-none text-secondary fw-bold" style="border-bottom: 1px dotted #6c757d;">お問い合わせ</a>
        </div>
        <p class="mb-2" style="font-size: 0.8rem; line-height: 1.5;">
          <i class="bi bi-info-circle me-1"></i>
          本サービスは、金融庁の「EDINET API」を利用して取得した公開情報を独自に加工・集計して作成しています。
        </p>
        <p class="mb-0 fw-bold" style="font-family: 'Inter', sans-serif;">&copy; 2026 Yield Map. All Rights Reserved.</p>
      </div>
    </footer>
  `;

  footerContainer.innerHTML = footerHtml;
});