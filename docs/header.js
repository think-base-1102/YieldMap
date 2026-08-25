document.addEventListener("DOMContentLoaded", () => {
  // 1. ヘッダーを挿入するためのコンテナ（<div id="common-header"></div>）をHTMLから探す
  const headerContainer = document.getElementById("common-header");
  if (!headerContainer) return;

  // 2. 現在のパスを取得し、「stockフォルダの中にいるか」を判定
  const currentPath = window.location.pathname.split("/").pop() || "index.html";
  const isStockPage = window.location.pathname.includes('/stock/');
  
  // 🌟 stockフォルダの中にいるなら「../」をつけて一つ上の階層に戻るようにする
  const basePath = isStockPage ? '../' : '';

  // 3. 共通のヘッダーHTMLを組み立てる (basePath を全リンクに追加)
  // 💡 スマホ版（991px以下）のみに適用される専用CSSを挿入
  const headerHtml = `
    <style>
      @media (max-width: 991px) {
        #navbarNav {
          background-color: rgba(255, 255, 255, 0.98);
          border-radius: 8px;
          padding: 1rem;
          margin-top: 0.5rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        #navbarNav .navbar-nav {
          align-items: flex-start !important;
        }
        #navbarNav .nav-item {
          width: 100%;
          margin-bottom: 0.5rem;
        }
        #navbarNav .nav-item a.nav-link {
          padding: 0.75rem 1rem !important;
          border-radius: 8px;
          margin-right: 0 !important;
        }
        #navbarNav .nav-item a.nav-link:active {
          background-color: #f8f9fa;
        }
        #ui-header-mypage-btn {
          width: 100%;
          margin-top: 0.5rem !important;
          text-align: center;
        }
      }
    </style>
    <header style="position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background-color: rgba(255, 255, 255, 0.95); box-shadow: 0 2px 4px rgba(0,0,0,0.05); backdrop-filter: blur(6px);">
      <nav class="navbar navbar-expand-lg navbar-light py-2 container">
        <a class="navbar-brand fw-800 text-success" href="${basePath}index.html" style="font-weight: 800; color: #34c759 !important; font-size: 1.4rem;">
          Yield Map
        </a>
        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse justify-content-end" id="navbarNav">
          <ul class="navbar-nav align-items-center">
            <li class="nav-item">
              <a class="nav-link fw-bold ${currentPath === 'search.html' ? 'text-success' : 'text-dark'}" href="${basePath}search.html" style="font-weight: 600; margin-right: 1rem;">
                <i class="bi bi-search me-1"></i>銘柄検索
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link fw-bold ${currentPath === 'yield_ranking.html' ? 'text-success' : 'text-dark'}" href="${basePath}yield_ranking.html" style="font-weight: 600; margin-right: 1rem;">
                <i class="bi bi-compass me-1"></i>戦略別ランキング
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link fw-bold text-danger ${currentPath === 'danger_list.html' ? 'border-bottom border-danger' : ''}" href="${basePath}danger_list.html" style="font-weight: 600; margin-right: 1rem;">
                <i class="bi bi-exclamation-triangle-fill me-1"></i>要注意銘柄
              </a>
            </li>
            <li class="nav-item ms-lg-3 mt-2 mt-lg-0">
              <a id="ui-header-mypage-btn" class="btn ${currentPath === 'mypage.html' ? 'btn-success' : 'btn-outline-success'} rounded-pill px-4 fw-bold shadow-sm" href="${basePath}mypage.html" style="font-weight: bold; transition: all 0.3s ease;">
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

  // 5. Firebaseの認証状態を監視し、マイページボタンの表示を切り替える
  import(`${basePath}firebase-manager.js`).then(module => {
    const { auth, onAuthStateChanged } = module;
    
    onAuthStateChanged(auth, (user) => {
      const mypageBtn = document.getElementById("ui-header-mypage-btn");
      if (mypageBtn) {
        if (user) {
          mypageBtn.innerHTML = `<i class="bi bi-person-check-fill me-1"></i>${user.displayName} さん`;
          if (currentPath !== 'mypage.html') {
            mypageBtn.classList.remove("btn-outline-success");
            mypageBtn.classList.add("btn-success");
            mypageBtn.style.background = "linear-gradient(135deg, #28a745, #20c997)";
            mypageBtn.style.border = "none";
            mypageBtn.style.color = "white";
          }
        } else {
          mypageBtn.innerHTML = `<i class="bi bi-person-circle me-1"></i>マイページ`;
        }
      }
    });
  }).catch(err => {
    console.error("ヘッダーでのFirebase読み込みに失敗しました:", err);
  });
});