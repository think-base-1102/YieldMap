document.addEventListener("DOMContentLoaded", () => {
  // 1. ヘッダーを挿入するためのコンテナ（<div id="common-header"></div>）をHTMLから探す
  const headerContainer = document.getElementById("common-header");
  if (!headerContainer) return;

  // 2. 現在のパスを取得し、下層フォルダ（stock, dividend, category等）の中にいるか判定
  const currentPath = window.location.pathname.split("/").pop() || "index.html";
  const isSubDir = window.location.pathname.includes('/stock/') || 
                   window.location.pathname.includes('/dividend/') || 
                   window.location.pathname.includes('/category/') ||
                   window.location.pathname.includes('/yutai/');
  
  // 🌟 下層フォルダの中にいるなら「../」をつけて一つ上の階層に戻るようにする
  const basePath = isSubDir ? '../' : './';

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
        <a class="navbar-brand fw-800 text-success d-flex align-items-center" href="${basePath}index.html" style="font-weight: 800; color: #34c759 !important; font-size: 1.4rem;">
          Yield Map <span class="badge bg-secondary ms-2" style="font-size: 0.6rem; vertical-align: middle; padding: 2px 6px; border-radius: 4px; font-weight: normal; letter-spacing: 0.5px;">BETA</span>
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
            <li class="nav-item dropdown">
              <a class="nav-link dropdown-toggle fw-bold ${(currentPath === 'simulator.html' || currentPath === 'pf_compare.html' || currentPath === 'compare.html' || currentPath === 'battle.html') ? 'text-success' : 'text-dark'}" href="#" id="navbarTools" role="button" data-bs-toggle="dropdown" aria-expanded="false" style="font-weight: 600; margin-right: 1rem;">
                <i class="bi bi-tools me-1"></i>分析ツール
              </a>
              <ul class="dropdown-menu border-0 shadow-sm" aria-labelledby="navbarTools" style="border-radius: 8px;">
                <li>
                  <a class="dropdown-item fw-bold py-2 ${currentPath === 'simulator.html' ? 'text-success bg-light' : 'text-dark'}" href="${basePath}simulator.html">
                    <i class="bi bi-radar me-2 text-primary"></i>PF診断シミュレーター
                  </a>
                </li>
                <li>
                  <a class="dropdown-item fw-bold py-2 ${currentPath === 'pf_compare.html' ? 'text-success bg-light' : 'text-dark'}" href="${basePath}pf_compare.html">
                    <i class="bi bi-briefcase me-2 text-success"></i>ポートフォリオ対決
                  </a>
                </li>
                <li>
                  <a class="dropdown-item fw-bold py-2 ${currentPath === 'battle.html' ? 'text-success bg-light' : 'text-dark'}" href="${basePath}battle.html">
                    <i class="bi bi-fire me-2 text-danger"></i>企業耐久バトル
                  </a>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <a class="dropdown-item fw-bold py-2 ${currentPath === 'compare.html' ? 'text-success bg-light' : 'text-dark'}" href="${basePath}compare.html">
                    <i class="bi bi-layout-split me-2 text-warning"></i>銘柄1on1比較
                  </a>
                </li>
              </ul>
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