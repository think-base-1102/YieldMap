/**
 * 企業耐久バトルシミュレーター 計算エンジン & 状態管理クラス
 * 仕様書 第4条（財務波及）、第5条（配当決定）、第6条（株価算出）、第7条（状態判定）に完全準拠
 */

class CorporateBattleEngine {
  constructor(stockData) {
    this.rawStock = stockData;
    this.reset();
  }

  /**
   * 状態の初期化（第2条・第3条）
   */
  reset() {
    const s = this.rawStock;
    const getNum = (val, fallback = 0.0) => {
      const num = parseFloat(val);
      return !isNaN(num) ? num : fallback;
    };

    // 初期スカラー変数のセット (百万円単位)
    this.initialState = {
      code: s.code || "----",
      name: s.Name || "Unknown",
      industry: s.Industry || "Unknown",
      // Python側からBPSとSharesOutが来ていない場合に備え、純資産実額を安全に取得
      hp0: getNum(s.Theoretical_Price_BPS, 1000.0) > 0 && getNum(s.SharesOutstanding, 0) > 0 
           ? (getNum(s.Theoretical_Price_BPS) * getNum(s.SharesOutstanding)) / 1000000 
           : getNum(s.NetAssets, 10000.0), // 純資産 (HP)
      cash0: getNum(s.CashAndDeposits, getNum(s.Cash_and_Equivalents, 3000.0)),
      debtSt0: getNum(s.ShortTermLoansPayable, 0.0),
      debtLt0: getNum(s.LongTermLoansPayable, 0.0) + getNum(s.BondsPayable, 0.0),
      sales0: getNum(s.NetSales, 10000.0),
      gp0: getNum(s.GrossProfit, getNum(s.NetSales, 10000.0) * 0.3),
      op0: getNum(s.OperatingIncome, getNum(s.OperatingProfit, 1000.0)),
      ni0: getNum(s.NetIncome, 500.0),
      ocf0: getNum(s.OperatingCF, 1000.0),
      taxRate: getNum(s.TaxRate, 0.306), // 実効税率
      divTotal0: Math.abs(getNum(s.DividendsPaid, getNum(s.Total_Dividends, getNum(s.DividendsPaid_PerShare, 0) * getNum(s.SharesOutstanding, 1) / 1000000))),
      divPs0: getNum(s.DividendsPaid_PerShare, 0.0),
      bps0: getNum(s.Theoretical_Price_BPS, 1000.0),
      sharesOut: getNum(s.SharesOutstanding, 1000000),
      divCutCount: parseInt(getNum(s.Div_Cut_Count, getNum(s.Dividend_Cut_Count_5yr, 0)), 10),
      
      // 事前計算パラメータ（第3条）
      alphaRef: getNum(s.alpha_refinance, 0.20),
      vRatio: getNum(s.variable_cost_ratio, 0.70),
      epsDiv: getNum(s.div_elasticity, 0.0),
      
      // ショック実績値
      shockLehmanPriceDrop: s.Shock_Metrics && s.Shock_Metrics.lehman ? getNum(s.Shock_Metrics.lehman.price_drop, -0.40) : -0.40,
      shockLehmanDivDrop: s.Shock_Metrics && s.Shock_Metrics.lehman ? getNum(s.Shock_Metrics.lehman.div_drop, 0.0) : 0.0,
      shockCoronaPriceDrop: s.Shock_Metrics && s.Shock_Metrics.corona ? getNum(s.Shock_Metrics.corona.price_drop, -0.30) : -0.30,
      shockCoronaDivDrop: s.Shock_Metrics && s.Shock_Metrics.corona ? getNum(s.Shock_Metrics.corona.div_drop, 0.0) : 0.0
    };

    // 現在の状態変数の初期化
    this.current = {
      hp: this.initialState.hp0,
      cash: this.initialState.cash0,
      sales: this.initialState.sales0,
      op: this.initialState.op0,
      ni: this.initialState.ni0,
      ocf: this.initialState.ocf0,
      divPs: this.initialState.divPs0,
      divTotal: this.initialState.divTotal0,
      price: this.initialState.bps0,
      turn: 0,
      logs: [],
      stateCode: "STATE_SURVIVE",
      statusMessage: "🛡️ 鉄壁防衛（通常還元を継続中）"
    };

    this.evaluateState();
  }

  /**
   * コマンドA：金利上昇攻撃（第4条 4.1）
   * @param {number} deltaR - 金利上昇幅 (例: 0.01 で +1.0%)
   */
  attackInterestRate(deltaR) {
    if (this.isGameOver()) return this.getState();

    const rate = Math.max(0.0, parseFloat(deltaR) || 0.0);
    this.current.turn += 1;

    // 1. 追加利払い発生額 ΔIntExp
    const deltaIntExp = (this.initialState.debtSt0 + (this.initialState.debtLt0 * this.initialState.alphaRef)) * rate;

    // 2. 税引後利益への影響額 ΔNI_int
    const deltaNiInt = -deltaIntExp * (1.0 - this.initialState.taxRate);

    // 3. 財務諸表・資産の更新
    this.current.ni += deltaNiInt;
    this.current.ocf += deltaNiInt;
    this.current.hp += deltaNiInt;
    this.current.cash = Math.max(0.0, this.current.cash + deltaNiInt);

    // 4. 配当決定 & 株価更新
    this.updateDividends();
    this.updatePrice();
    this.evaluateState();

    const logMsg = `【ターン${this.current.turn}】金利が +${(rate * 100).toFixed(2)}% 上昇！ 利払い負担が年間 ${deltaIntExp.toFixed(1)} 百万円増加。純利益が ${Math.abs(deltaNiInt).toFixed(1)} 百万円減少しました。`;
    this.current.logs.unshift({ turn: this.current.turn, type: "interest", text: logMsg, state: this.current.stateCode });

    return this.getState();
  }

  /**
   * コマンドB：売上高減少攻撃（第4条 4.1）
   * @param {number} deltaS - 売上減少率 (例: 0.10 で -10%)
   */
  attackSalesDrop(deltaS) {
    if (this.isGameOver()) return this.getState();

    const dropRate = Math.max(0.0, Math.min(1.0, parseFloat(deltaS) || 0.0));
    this.current.turn += 1;

    // 1. 新売上高と売上減少額の算出
    const salesNext = this.current.sales * (1.0 - dropRate);
    const deltaSales = salesNext - this.current.sales; // 負の値

    // 2. 限界利益ベースの営業利益変動額の算出 (回帰誤差によるジャンプを防止)
    const deltaOp = deltaSales * (1.0 - this.initialState.vRatio);

    // 3. 税引後利益への影響額
    const deltaNiSales = deltaOp * (1.0 - this.initialState.taxRate);

    // 4. 財務諸表・資産の更新
    this.current.sales = salesNext;
    this.current.op += deltaOp;
    this.current.ni += deltaNiSales;
    this.current.ocf += deltaNiSales;
    this.current.hp += deltaNiSales;
    this.current.cash = Math.max(0.0, this.current.cash + deltaNiSales);

    // 5. 配当決定 & 株価更新
    this.updateDividends();
    this.updatePrice();
    this.evaluateState();

    const logMsg = `【ターン${this.current.turn}】売上高が -${(dropRate * 100).toFixed(1)}% 減少！ 固定費の重み（限界利益率 ${(100 - this.initialState.vRatio * 100).toFixed(1)}%）により、営業利益が ${Math.abs(deltaOp).toFixed(1)} 百万円吹き飛びました。`;
    this.current.logs.unshift({ turn: this.current.turn, type: "sales", text: logMsg, state: this.current.stateCode });

    return this.getState();
  }

  /**
   * コマンドC：時間経過攻撃（自律流出・タコ足放置）（第4条 4.1）
   * @param {number} deltaYears - 経過年数 (例: 1 で 1年経過)
   */
  attackTimeElapse(deltaYears) {
    if (this.isGameOver()) return this.getState();

    const years = Math.max(1, parseInt(deltaYears, 10) || 1);
    this.current.turn += 1;

    // 1. 1年あたりの純収支 (利益 - 配当支払)
    const deltaBalance = this.current.ni - this.current.divTotal;

    // 2. 純資産および現預金の更新
    this.current.hp += deltaBalance * years;
    this.current.cash = Math.max(0.0, this.current.cash + ((this.current.ocf - this.current.divTotal) * years));

    // 3. 配当決定 & 株価更新
    this.updateDividends();
    this.updatePrice();
    this.evaluateState();

    const logMsg = `【ターン${this.current.turn}】この状態のまま ${years} 年が経過。資本・配当収支により純資産が ${deltaBalance < 0 ? Math.abs(deltaBalance * years).toFixed(1) + ' 百万円 流出' : (deltaBalance * years).toFixed(1) + ' 百万円 蓄積'} しました。`;
    this.current.logs.unshift({ turn: this.current.turn, type: "time", text: logMsg, state: this.current.stateCode });

    return this.getState();
  }

  /**
   * 配当金決定アルゴリズム（第5条 完全決定論的ツリー）
   */
  updateDividends() {
    // 判定ステップ 1: 会社法上の分配可能額および債務超過判定
    if (this.current.hp <= 0.0) {
      this.current.divPs = 0.0;
      this.current.divTotal = 0.0;
      return;
    }

    // 判定ステップ 2: 支払原資・手元流動性判定
    if (this.current.cash <= 0.0 && this.current.ocf < 0.0) {
      this.current.divPs = 0.0;
      this.current.divTotal = 0.0;
      return;
    }

    // 判定ステップ 3: 過去実績に基づく企業行動別 配当算定
    if (this.initialState.divCutCount === 0) {
      // 過去非減配企業（累進防衛型）
      if (this.current.ni >= this.initialState.divTotal0) {
        this.current.divPs = this.initialState.divPs0;
        this.current.divTotal = this.initialState.divTotal0;
      } else if (this.current.cash >= this.initialState.divTotal0) {
        this.current.divPs = this.initialState.divPs0;
        this.current.divTotal = this.initialState.divTotal0;
      } else {
        const ratioCash = Math.max(0.0, this.current.cash / this.initialState.divTotal0);
        this.current.divPs = Math.round(this.initialState.divPs0 * ratioCash * 100) / 100;
        this.current.divTotal = Math.round(this.initialState.divTotal0 * ratioCash * 100) / 100;
      }
    } else {
      // 過去減配実績企業（業績連動・脆弱型）
      if (this.current.ni >= this.initialState.ni0) {
        this.current.divPs = this.initialState.divPs0;
        this.current.divTotal = this.initialState.divTotal0;
      } else {
        const lossRatio = Math.max(0.0, (this.initialState.ni0 - this.current.ni) / Math.max(1.0, Math.abs(this.initialState.ni0)));
        const cutRate = Math.min(1.0, lossRatio * this.initialState.epsDiv);

        // 浮動小数点エラーとCutRate100%時の確実な無配化対策
        if (cutRate >= 1.0 || (this.current.ni <= 0.0 && this.current.cash < (this.initialState.divTotal0 * (1.0 - cutRate)))) {
          this.current.divPs = 0.0;
          this.current.divTotal = 0.0;
        } else {
          this.current.divPs = Math.round(this.initialState.divPs0 * (1.0 - cutRate) * 100) / 100;
          this.current.divTotal = Math.round(this.initialState.divTotal0 * (1.0 - cutRate) * 100) / 100;
        }
      }
    }
  }

  /**
   * 理論株価および下落率の算出アルゴリズム（第6条）
   */
  updatePrice() {
    // 6.1 ファンダメンタルズ要因下落率 ΔP_fund
    let deltaPFund = 0.0;
    if (this.initialState.hp0 > 0) {
      deltaPFund = (this.current.hp - this.initialState.hp0) / this.initialState.hp0;
    }
    if (this.current.hp <= 0.0) deltaPFund = -1.0;

    // 6.2 インカムショック要因下落率 ΔP_div
    let deltaDivRate = 0.0;
    if (this.initialState.divPs0 > 0) {
      deltaDivRate = Math.max(0.0, (this.initialState.divPs0 - this.current.divPs) / this.initialState.divPs0);
    }

    const priceDropHist = Math.min(this.initialState.shockLehmanPriceDrop, this.initialState.shockCoronaPriceDrop);
    const divDropHist = Math.min(this.initialState.shockLehmanDivDrop, this.initialState.shockCoronaDivDrop);

    let gammaShock = Math.abs(priceDropHist);
    if (Math.abs(divDropHist) > 0) {
      gammaShock = Math.abs(priceDropHist) / Math.abs(divDropHist);
    }
    gammaShock = Math.max(0.2, Math.min(5.0, gammaShock));

    const deltaPDiv = -(deltaDivRate * gammaShock);

    // 6.3 総合理論株価下落率および変動後株価
    const deltaPriceTotal = Math.max(-0.99, deltaPFund + deltaPDiv);
    this.current.price = Math.max(1.0, Math.round(this.initialState.bps0 * (1.0 + deltaPriceTotal) * 100) / 100);
    this.current.priceDropRate = deltaPriceTotal;
  }

  /**
   * 状態コードおよびゲームオーバー判定（第7条）
   */
  evaluateState() {
    if (this.current.hp <= 0.0) {
      this.current.stateCode = "STATE_INSOLVENCY";
      this.current.statusMessage = "💀 債務超過・破綻（上場廃止確定）";
    } else if (this.current.cash <= 0.0 && this.current.ocf < 0.0) {
      this.current.stateCode = "STATE_DEFAULT";
      this.current.statusMessage = "💥 資金ショート・デフォルト（黒字倒産）";
    } else if (this.current.divPs === 0.0) {
      this.current.stateCode = "STATE_NO_DIV";
      this.current.statusMessage = "🚨 無配転落（インカム機能完全停止）";
    } else if (this.current.divPs < this.initialState.divPs0) {
      this.current.stateCode = "STATE_DIV_CUT";
      this.current.statusMessage = `⚠️ 減配発表 (${((1.0 - this.current.divPs / this.initialState.divPs0) * 100).toFixed(1)}% カット)`;
    } else {
      this.current.stateCode = "STATE_SURVIVE";
      this.current.statusMessage = "🛡️ 鉄壁防衛（通常還元を継続中）";
    }
  }

  isGameOver() {
    return this.current.stateCode === "STATE_INSOLVENCY" || this.current.stateCode === "STATE_DEFAULT";
  }

  /**
   * 現在の全状態オブジェクトを返す（UI描画用）
   */
  getState() {
    const hpRatio = this.initialState.hp0 > 0 ? Math.max(0.0, (this.current.hp / this.initialState.hp0) * 100) : 0.0;
    const cashRatio = this.initialState.cash0 > 0 ? Math.max(0.0, (this.current.cash / this.initialState.cash0) * 100) : 0.0;
    const divYield = this.current.price > 0 ? (this.current.divPs / this.current.price) * 100 : 0.0;

    return {
      stock: {
        code: this.initialState.code,
        name: this.initialState.name,
        industry: this.initialState.industry
      },
      turn: this.current.turn,
      stateCode: this.current.stateCode,
      statusMessage: this.current.statusMessage,
      isGameOver: this.isGameOver(),
      metrics: {
        hp: Math.max(0.0, this.current.hp),
        hp0: this.initialState.hp0,
        hpRatio: Math.min(100.0, hpRatio),
        cash: this.current.cash,
        cash0: this.initialState.cash0,
        cashRatio: Math.min(100.0, cashRatio),
        sales: this.current.sales,
        op: this.current.op,
        ni: this.current.ni,
        ocf: this.current.ocf,
        divPs: this.current.divPs,
        divPs0: this.initialState.divPs0,
        divCutRate: this.initialState.divPs0 > 0 ? ((this.initialState.divPs0 - this.current.divPs) / this.initialState.divPs0) * 100 : 0.0,
        divTotal: this.current.divTotal,
        price: this.current.price,
        bps0: this.initialState.bps0,
        priceDropRate: (this.current.priceDropRate || 0.0) * 100,
        divYield: divYield
      },
      logs: this.current.logs
    };
  }
}

// グローバルスコープへエクスポート（ブラウザ環境用）
if (typeof window !== "undefined") {
  window.CorporateBattleEngine = CorporateBattleEngine;
}