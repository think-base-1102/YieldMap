// Yield Map 共通フッター（EDINET利用規約準拠・法的リンク含む）

document.addEventListener("DOMContentLoaded", () => {
  const footerContainer = document.getElementById("common-footer");
  if (!footerContainer) return;

  const footerHtml = `
    <footer class="mt-5 py-4 text-center text-muted small" style="background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
      <div class="container">
        <div class="mb-3 d-flex justify-content-center gap-4">
          <a href="disclaimer.html" class="text-decoration-none text-secondary fw-bold" style="border-bottom: 1px dotted #6c757d;">免責事項・利用規約</a>
          <a href="privacy.html" class="text-decoration-none text-secondary fw-bold" style="border-bottom: 1px dotted #6c757d;">プライバシーポリシー</a>
        </div>
        <p class="mb-2" style="font-size: 0.8rem;">
          <i class="bi bi-info-circle me-1"></i>
          本サービスは、金融庁の「EDINET API」を利用して取得した公開情報を独自に加工・集計して作成しています。
        </p>
        <p class="mb-0 fw-bold" style="font-family: 'Inter', sans-serif;">&copy; 2026 Yield Map. All Rights Reserved.</p>
      </div>
    </footer>
  `;

  footerContainer.innerHTML = footerHtml;
});