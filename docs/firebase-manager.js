// firebase-manager.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDp-hhz03L9X_NTHbJFfqP-r7HvigmpOiA",
  authDomain: "yieldmap-241d2.firebaseapp.com",
  projectId: "yieldmap-241d2",
  storageBucket: "yieldmap-241d2.firebasestorage.app",
  messagingSenderId: "841429106976",
  appId: "1:841429106976:web:b1882e865299edccdd1745",
  measurementId: "G-V9P47R95KN"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const provider = new GoogleAuthProvider();
export { signInWithPopup, onAuthStateChanged, signOut, doc, setDoc, getDoc };

// 共通データ管理マネージャー
export const AppStorageManager = {
  getFavorites: () => JSON.parse(localStorage.getItem('yieldmap_favs') || '[]'),
  
  saveFavorites: (favs) => {
    localStorage.setItem('yieldmap_favs', JSON.stringify(favs));
    syncToCloud(); 
  },
  
  getTargetPrice: (code) => localStorage.getItem(`target_price_${code}`) || "",
  getTargetDate: (code) => localStorage.getItem(`target_price_date_${code}`) || "",
  getMemo: (code) => localStorage.getItem(`memo_${code}`) || "",
  
  saveTargetData: (code, price) => {
    if (price) {
      localStorage.setItem(`target_price_${code}`, price);
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      localStorage.setItem(`target_price_date_${code}`, `${yyyy}/${mm}/${dd}`);
    } else {
      localStorage.removeItem(`target_price_${code}`);
      localStorage.removeItem(`target_price_date_${code}`);
    }
    syncToCloud(); 
  },
  
  saveMemo: (code, memo) => {
    if (memo) {
      localStorage.setItem(`memo_${code}`, memo);
    } else {
      localStorage.removeItem(`memo_${code}`);
    }
    syncToCloud();
  }
};

// ==========================================
// 💡 追加: 連続同期によるFirestore書き込み課金を防ぐためのタイマー
// ==========================================
let cloudSyncTimeout = null;

// ログイン状態を確認してクラウドへデータを送信する共通処理
export const syncToCloud = async () => {
  const user = auth.currentUser;
  if (!user) return;

  // 以前の同期予約があればキャンセルする（連続リクエストをまとめる）
  if (cloudSyncTimeout) {
    clearTimeout(cloudSyncTimeout);
  }

  // 最後のデータ保存から2秒間待ってから、一括でクラウドへ書き込む
  cloudSyncTimeout = setTimeout(async () => {
    try {
      const userRef = doc(db, "users", user.uid);
      const localFavs = AppStorageManager.getFavorites();
      const stockDetails = {};
      
      localFavs.forEach(code => {
        stockDetails[code] = {
          memo: AppStorageManager.getMemo(code),
          targetPrice: AppStorageManager.getTargetPrice(code),
          targetDate: AppStorageManager.getTargetDate(code)
        };
      });

      await setDoc(userRef, {
        favorites: localFavs,
        details: stockDetails,
        updatedAt: new Date()
      }, { merge: true });
      
      console.log("クラウドへ最新データを同期しました。");
    } catch (error) {
      console.error("クラウド同期エラー:", error);
    }
  }, 2000); // 2000ミリ秒（2秒）の遅延バッファ
};