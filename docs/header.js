document.addEventListener("DOMContentLoaded", () => {
  // 1. ヘッダーを挿入するためのコンテナ（<div id="common-header"></div>）をHTMLから探す
  const headerContainer = document.getElementById("common-header");
  if (!headerContainer) return;

  // 2. 現在開いているファイルのパスを取得（アクティブ表示の判定用）
  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  // 3. 共通のヘッダーHTMLを組み立てる
  const headerHtml = `
    <header style="position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background-color: rgba(255, 255, 255, 0.95); box-shadow: 0 2px 4px rgba(0,0,0,0.05); backdrop-filter: blur(6px);">
      <nav class="navbar navbar-expand-lg navbar-light py-2 container">
        <a class="navbar-brand fw-800 text-success" href="index.html" style="font-weight: 800; color: #34c759 !important; font-size: 1.4rem;">
          Yield Map
        </a>
        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse justify-content-end" id="navbarNav">
          <ul class="navbar-nav align-items-center">
            <li class="nav-item">
              <a class="nav-link fw-bold ${currentPath === 'search.html' ? 'text-success' : 'text-dark'}" href="search.html" style="font-weight: 600; margin-right: 1rem;">
                <i class="bi bi-search me-1"></i>銘柄検索
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link fw-bold ${currentPath === 'yield_ranking.html' ? 'text-success' : 'text-dark'}" href="yield_ranking.html" style="font-weight: 600; margin-right: 1rem;">
                <i class="bi bi-compass me-1"></i>戦略別ランキング
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link fw-bold text-danger ${currentPath === 'danger_list.html' ? 'border-bottom border-danger' : ''}" href="danger_list.html" style="font-weight: 600; margin-right: 1rem;">
                <i class="bi bi-exclamation-triangle-fill me-1"></i>要注意銘柄
              </a>
            </li>
            <li class="nav-item ms-lg-3 mt-2 mt-lg-0">
              <a class="btn ${currentPath === 'mypage.html' ? 'btn-success' : 'btn-outline-success'} rounded-pill px-4 fw-bold shadow-sm" href="mypage.html" style="font-weight: bold;">
                <i class="bi bi-person-circle me-1"></i>マイページ
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  `;

  // 4. コンテナの中に組み立てたヘッダーを流し込む
  headerContainer.innerHTML = headerHtml;
});