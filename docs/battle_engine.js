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
      ord0: getNum(s.OrdinaryIncome, getNum(s.OperatingIncome, 1000.0)), // 💡 追加
      ni0: getNum(s.NetIncome, 500.0),
      ocf0: getNum(s.OperatingCF, 1000.0),
      taxRate: getNum(s.TaxRate, 0.306), // 実効税率
      divTotal0: Math.abs(getNum(s.DividendsPaid, getNum(s.Total_Dividends, getNum(s.DividendsPaid_PerShare, 0) * getNum(s.SharesOutstanding, 1) / 1000000))),
      divPs0: getNum(s.DividendsPaid_PerShare, 0.0),
      bps0: getNum(s.Theoretical_Price_BPS, 1000.0),
      sharesOut: getNum(s.SharesOutstanding, 1000000),
      divCutCount: parseInt(getNum(s.Div_Cut_Count, getNum(s.Dividend_Cut_Count_5yr, 0)), 10),
      
      // Sランク攻撃用 追加実額パラメータ（第2条 21〜24項）
      cogs0: getNum(s.CostOfSales, Math.max(0.0, getNum(s.NetSales, 10000.0) - getNum(s.GrossProfit, getNum(s.NetSales, 10000.0) * 0.3))),
      rec0: getNum(s.Receivables, 0.0),
      ppe0: getNum(s.PropertyPlantAndEquipment, 0.0),
      gw0: getNum(s.Goodwill, 0.0),

      // 事前計算パラメータ（第3条）
      alphaRef: getNum(s.alpha_refinance, 0.20),
      vRatio: getNum(s.variable_cost_ratio, 0.70),
      epsDiv: getNum(s.div_elasticity, 0.0),
      // 💡 修正：前回抜け落ちてしまった「固定費」の定義を復活
      fixedCost: getNum(s.fixed_cost, Math.max(0.0, getNum(s.NetSales, 10000.0) - (getNum(s.OperatingIncome, getNum(s.OperatingProfit, 1000.0)) + getNum(s.NetSales, 10000.0) * getNum(s.variable_cost_ratio, 0.70)))),
      
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
      cogs: this.initialState.cogs0,
      rec: this.initialState.rec0,
      ppe: this.initialState.ppe0,
      gw: this.initialState.gw0,
      op: this.initialState.op0,
      ord: this.initialState.ord0, // 💡 追加
      ni: this.initialState.ni0,
      ocf: this.initialState.ocf0,
      divPs: this.initialState.divPs0,
      divTotal: this.initialState.divTotal0,
      price: this.initialState.bps0,
      turn: 0,
      logs: [],
      addedInterestRate: 0.0, // 💡 追加：変動した金利の累計を記憶
      stateCode: "STATE_SURVIVE",
      statusMessage: "🛡️ 鉄壁防衛（通常還元を継続中）"
    };

    this.history = []; // 💡 追加：Undo（1つ前に戻る）用の履歴配列

    this.evaluateState();
  }

  // 💡 追加：履歴保存と巻き戻し（Undo）のメソッド
  saveState() {
    // プリミティブ値と配列(logs)をディープコピーして履歴に保存
    this.history.push(JSON.parse(JSON.stringify(this.current)));
  }

  canUndo() {
    return this.history.length > 0;
  }

  undo() {
    if (this.canUndo()) {
      this.current = this.history.pop();
      return true;
    }
    return false;
  }

  /**
   * コマンドA：金利変動ショック（第4条 4.1 拡張）
   * @param {number} deltaR - 金利変動幅 (例: -0.01 で -1.0%)
   */
  attackInterestRate(deltaR) {
    if (this.isGameOver()) return this.getState();
    this.saveState(); // 💡 追加：行動前に現在の状態を保存

    // 💡 修正：マイナスの金利（利下げ）も許容する
    const rate = parseFloat(deltaR) || 0.0;
    this.current.turn += 1;
    this.current.addedInterestRate += rate;

    // 1. 追加利払い発生額 ΔIntExp (マイナスの場合は利払い負担減)
    const deltaIntExp = (this.initialState.debtSt0 + (this.initialState.debtLt0 * this.initialState.alphaRef)) * rate;

    // 2. 税引後利益への影響額 ΔNI_int
    const deltaNiInt = -deltaIntExp * (1.0 - this.initialState.taxRate);

    // 3. 財務諸表・資産の更新
    this.current.ord -= deltaIntExp; // 💡 営業外費用なので経常利益が減る（営業利益opは不変）
    this.current.ni += deltaNiInt;
    this.current.ocf += deltaNiInt;
    this.current.hp += deltaNiInt;
    this.current.cash = Math.max(0.0, this.current.cash + deltaNiInt);

    // 4. 配当決定 & 株価更新
    this.updateDividends();
    this.updatePrice();
    this.evaluateState();

    // 💡 修正：利上げ・利下げでログの文言を動的に変える
    const actionText = rate >= 0 ? "上昇" : "低下";
    const impactText = rate >= 0 ? "増加" : "減少";
    const niImpactText = deltaNiInt < 0 ? "減少" : "増加";
    
    const logMsg = `【ターン${this.current.turn}】市場金利が ${rate > 0 ? '+' : ''}${(rate * 100).toFixed(2)}%pt ${actionText}！ 利払い負担が年間 ${this.formatCurrency(Math.abs(deltaIntExp))} ${impactText}し、純利益が ${this.formatCurrency(Math.abs(deltaNiInt))} ${niImpactText}しました。`;
    this.current.logs.unshift({ turn: this.current.turn, type: "interest", text: logMsg, state: this.current.stateCode });

    return this.getState();
  }

  /**
   * コマンドB：売上高変動ショック（第4条 4.1 拡張）
   * @param {number} rate - 売上変動率 (例: 0.10 で +10%, -0.10 で -10%)
   */
  attackSalesChange(rate) {
    if (this.isGameOver()) return this.getState();

    const r = parseFloat(rate) || 0.0;
    this.current.turn += 1;

    // 1. 新売上高の算出
    const salesNext = Math.max(0.0, this.current.sales * (1.0 + r));

    // 2. 固変分解モデルに基づく新総費用および新営業利益の厳密算出
    const tcNext = (this.initialState.vRatio * salesNext) + this.initialState.fixedCost;
    const opNext = salesNext - tcNext;
    const deltaOp = opNext - this.current.op;

    // 3. 税引後利益への影響額
    const deltaNiSales = deltaOp * (1.0 - this.initialState.taxRate);

    // 4. 財務諸表・資産の更新
    this.current.sales = salesNext;
    this.current.op = opNext;
    this.current.ord += deltaOp; // 💡 本業利益の増減なので経常利益も連動する
    this.current.ni += deltaNiSales;
    this.current.ocf += deltaNiSales;
    this.current.hp += deltaNiSales;
    this.current.cash = Math.max(0.0, this.current.cash + deltaNiSales);

    // 5. 配当決定 & 株価更新
    this.updateDividends();
    this.updatePrice();
    this.evaluateState();

    const actionText = r >= 0 ? "増加" : "減少";
    let impactText = "";
    if (deltaOp > 0) {
      impactText = "押し上げました";
    } else if (deltaOp < 0) {
      impactText = "吹き飛ばしました";
    } else {
      impactText = "変化させませんでした";
    }
    const logMsg = `【ターン${this.current.turn}】売上高が ${Math.abs(r * 100).toFixed(1)}% ${actionText}！ 固定費のレバレッジ（限界利益率 ${(100 - this.initialState.vRatio * 100).toFixed(1)}%）により、営業利益を ${this.formatCurrency(Math.abs(deltaOp))} ${impactText}。`;
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

    const logMsg = `【ターン${this.current.turn}】この状態のまま ${years} 年が経過。資本・配当収支により純資産が ${deltaBalance < 0 ? this.formatCurrency(Math.abs(deltaBalance * years)) + ' 流出' : this.formatCurrency(deltaBalance * years) + ' 蓄積'} しました。`;
    this.current.logs.unshift({ turn: this.current.turn, type: "time", text: logMsg, state: this.current.stateCode });

    return this.getState();
  }

  /**
   * コマンドD：仕入・製造原価変動ショック（第4条 4.1 拡張）
   * @param {number} rate - 原価変動率 (例: 0.05 で +5.0%, -0.05 で -5.0%)
   */
  attackCogsChange(rate) {
    if (this.isGameOver()) return this.getState();

    const r = parseFloat(rate) || 0.0;
    this.current.turn += 1;

    // 1. 売上原価増加・減少額の算出 (最低でも原価は0までにクリップ)
    let deltaCogs = this.current.cogs * r;
    if (this.current.cogs + deltaCogs < 0) {
      deltaCogs = -this.current.cogs;
    }

    // 2. 営業利益への波及額
    const deltaOpCogs = -deltaCogs;
    const deltaNiCogs = deltaOpCogs * (1.0 - this.initialState.taxRate);

    // 3. 財務諸表・資産の更新
    this.current.cogs += deltaCogs;
    this.current.op += deltaOpCogs;
    this.current.ord += deltaOpCogs; // 💡 本業の原価変動なので経常利益も連動する
    this.current.ni += deltaNiCogs;
    this.current.ocf += deltaNiCogs;
    this.current.hp += deltaNiCogs;
    this.current.cash = Math.max(0.0, this.current.cash + deltaNiCogs);

    // 4. 配当決定 & 株価更新
    this.updateDividends();
    this.updatePrice();
    this.evaluateState();

    const actionText = r >= 0 ? "高騰" : "低下";
    const impactText = r >= 0 ? "減少" : "増加";
    const logMsg = `【ターン${this.current.turn}】仕入・製造原価が ${r >= 0 ? '+' : ''}${(r * 100).toFixed(1)}% ${actionText}！ 限界利益率が直接変動し、営業利益が ${this.formatCurrency(Math.abs(deltaOpCogs))} ${impactText}しました。`;
    this.current.logs.unshift({ turn: this.current.turn, type: "cogs", text: logMsg, state: this.current.stateCode });

    return this.getState();
  }

  /**
   * コマンドE：売掛金焦げ付き・貸倒ショック（第4条 4.1 追加）
   * @param {number} deltaLoss - 貸倒発生率 (例: 0.05 で 5.0%)
   */
  attackReceivablesDefault(deltaLoss) {
    if (this.isGameOver()) return this.getState();

    const lossRate = Math.max(0.0, Math.min(1.0, parseFloat(deltaLoss) || 0.0));
    this.current.turn += 1;

    // 1. 貸倒損失額の算出
    const lossRec = this.current.rec * lossRate;

    // 2. 税引後純利益への影響額
    const deltaNiRec = -lossRec * (1.0 - this.initialState.taxRate);

    // 3. 財務諸表・資産の更新（手元現金は直接流出せず据え置き）
    this.current.rec = Math.max(0.0, this.current.rec - lossRec);
    this.current.ni += deltaNiRec;
    this.current.ocf += deltaNiRec; // 回収予定CFの未達
    this.current.hp += deltaNiRec;

    // 4. 配当決定 & 株価更新
    this.updateDividends();
    this.updatePrice();
    this.evaluateState();

    const logMsg = `【ターン${this.current.turn}】取引先倒産により売上債権の ${(lossRate * 100).toFixed(1)}% が焦げ付き！ ${this.formatCurrency(lossRec)} の貸倒損失が発生し、純資産が毀損しました。`;
    this.current.logs.unshift({ turn: this.current.turn, type: "default", text: logMsg, state: this.current.stateCode });

    return this.getState();
  }

  /**
   * コマンドF：固定資産・のれん強制減損ショック（第4条 4.1 追加）
   * @param {number} deltaImpair - 減損率 (例: 0.20 で 20.0%)
   */
  attackAssetImpairment(deltaImpair) {
    if (this.isGameOver()) return this.getState();

    const impairRate = Math.max(0.0, Math.min(1.0, parseFloat(deltaImpair) || 0.0));
    this.current.turn += 1;

    // 1. 減損対象資産合計と減損損失額の算出
    const assetImpair = this.current.ppe + this.current.gw;
    const lossImpair = assetImpair * impairRate;

    if (lossImpair <= 0) {
      this.current.logs.unshift({ turn: this.current.turn, type: "impair", text: `【ターン${this.current.turn}】減損対象となる固定資産・のれんが存在しません。`, state: this.current.stateCode });
      return this.getState();
    }

    // 2. 特別損失計上（税法上の損金不算入に準拠し税効果なし）
    const deltaNiImpair = -lossImpair;

    // 3. 資産残高の按分と損益・純資産の更新（非資金費用のためCashとOCFは据え置き）
    const deltaGw = Math.min(this.current.gw, lossImpair);
    const deltaPpe = lossImpair - deltaGw;

    this.current.gw -= deltaGw;
    this.current.ppe = Math.max(0.0, this.current.ppe - deltaPpe);
    
    this.current.ni += deltaNiImpair;
    this.current.hp += deltaNiImpair;

    // 4. 配当決定 & 株価更新
    this.updateDividends();
    this.updatePrice();
    this.evaluateState();

    const logMsg = `【ターン${this.current.turn}】保有資産の ${(impairRate * 100).toFixed(1)}% を強制減損！ ${this.formatCurrency(lossImpair)} の特別損失（のれん ${this.formatCurrency(deltaGw)}、有形固定資産 ${this.formatCurrency(deltaPpe)}）を一括計上しました。`;
    this.current.logs.unshift({ turn: this.current.turn, type: "impair", text: logMsg, state: this.current.stateCode });

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
   * 百万円単位の数値を日本の直感的な金額表記（例：15億4000万円）に変換する
   */
  formatCurrency(valueInMillion) {
    if (isNaN(valueInMillion) || valueInMillion === 0) return "0円";
    const absVal = Math.abs(valueInMillion);
    let result = "";
    if (absVal >= 100) {
      const oku = Math.floor(absVal / 100);
      const man = Math.round((absVal % 100) * 100);
      result = `${oku.toLocaleString()}億`;
      if (man > 0) result += `${man.toLocaleString()}万`;
    } else {
      const man = Math.round(absVal * 100);
      result = `${man.toLocaleString()}万`;
    }
    result += "円";
    return valueInMillion < 0 ? "-" + result : result;
  }

  /**
   * 現在の全状態オブジェクトを返す（UI描画用）
   */
  getState() {
    const hpRatio = this.initialState.hp0 > 0 ? Math.max(0.0, (this.current.hp / this.initialState.hp0) * 100) : 0.0;
    const cashRatio = this.initialState.cash0 > 0 ? Math.max(0.0, (this.current.cash / this.initialState.cash0) * 100) : 0.0;
    const divYield = this.current.price > 0 ? (this.current.divPs / this.current.price) * 100 : 0.0;

    // 💡 プログレスバーUI用：支出構造のリアルタイム計算
    const safeSales = Math.max(1.0, this.current.sales);
    
    // 現在の金利コストの逆算（初期金利コスト + 攻撃による追加金利コスト）
    const currentIntExp = (this.initialState.debtSt0 + (this.initialState.debtLt0 * this.initialState.alphaRef)) * Math.max(0.0, this.current.addedInterestRate);
    
    // 法人税の実額（営業利益から利息を引いて税率を掛ける。赤字なら0）
    const taxableIncome = Math.max(0.0, this.current.op - currentIntExp);
    const currentTax = taxableIncome * this.initialState.taxRate;
    
    // 売上に対する各項目の割合（%）
    const breakdown = {
      cogsRatio: (this.current.cogs / safeSales) * 100,
      fixedCostRatio: (this.initialState.fixedCost / safeSales) * 100,
      interestRatio: (currentIntExp / safeSales) * 100,
      taxRatio: (currentTax / safeSales) * 100,
      dividendRatio: (this.current.divTotal / safeSales) * 100
    };

    breakdown.totalExpenseRatio = breakdown.cogsRatio + breakdown.fixedCostRatio + breakdown.interestRatio + breakdown.taxRatio + breakdown.dividendRatio;
    breakdown.retainedRatio = Math.max(0.0, 100.0 - breakdown.totalExpenseRatio);
    breakdown.deficitRatio = Math.max(0.0, breakdown.totalExpenseRatio - 100.0);

    // 💡 追加: 財務体質（内部状態バッジ）の決定論的判定
    const badges = [];
    const totalDebt = this.initialState.debtSt0 + this.initialState.debtLt0;

    // 【超健全・資産リッチ系】
    if (this.current.cash >= totalDebt && this.current.op > 0) {
      badges.push({ type: "success", icon: "bi-building-fill-check", text: "実質無借金 (キャッシュリッチ)", helpKey: "badge-cashrich" });
    }
    if (this.current.ni > this.current.divTotal && breakdown.totalExpenseRatio < 80.0) {
      badges.push({ type: "primary", icon: "bi-graph-up-arrow", text: "高収益・自律成長モード", helpKey: "badge-growth" });
    }

    // 【要注意・歪み検知系】
    if (this.current.ni > 0 && this.current.divTotal > this.current.ni) {
      badges.push({ type: "warning", textClass: "text-dark", icon: "bi-bag-x-fill", text: "タコ足還元 (利益超過配当)", helpKey: "badge-tako" });
    }
    if (this.current.ni <= 0 && this.current.cash >= this.current.divTotal && this.current.hp > 0 && this.current.divPs > 0) {
      badges.push({ type: "warning", textClass: "text-dark", icon: "bi-shield-exclamation", text: "止血防衛 (資産取崩による配当維持)", helpKey: "badge-defense" });
    }
    if (this.current.op <= 0 && this.current.cash > 0) {
      badges.push({ type: "danger", icon: "bi-graph-down", text: "本業赤字・延命状態", helpKey: "badge-red" });
    }

    // 【破綻前夜・クリティカル系】
    if (this.current.ni > 0 && (this.current.ocf <= 0 || this.current.cash <= this.current.divTotal * 0.5) && !this.isGameOver()) {
      badges.push({ type: "danger", icon: "bi-bomb-fill", text: "黒字倒産予備軍 (CF枯渇)", helpKey: "badge-cf-dry" });
    }
    if (this.current.op < currentIntExp && currentIntExp > 0 && !this.isGameOver()) {
      badges.push({ type: "danger", icon: "bi-exclamation-octagon-fill", text: "ゾンビ企業 (利払い超過)", helpKey: "badge-zombie" });
    }

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
      canUndo: this.canUndo(),
      metrics: {
        hp: Math.max(0.0, this.current.hp),
        hp0: this.initialState.hp0,
        hpRatio: Math.min(100.0, hpRatio),
        cash: this.current.cash,
        cash0: this.initialState.cash0,
        cashRatio: Math.min(100.0, cashRatio),
        sales: this.current.sales,
        op: this.current.op,
        ord: this.current.ord,
        ni: this.current.ni,
        ocf: this.current.ocf,
        divPs: this.current.divPs,
        divPs0: this.initialState.divPs0,
        divCutRate: this.initialState.divPs0 > 0 ? ((this.initialState.divPs0 - this.current.divPs) / this.initialState.divPs0) * 100 : 0.0,
        divTotal: this.current.divTotal,
        price: this.current.price,
        bps0: this.initialState.bps0,
        priceDropRate: (this.current.priceDropRate || 0.0) * 100,
        divYield: divYield,
        breakdown: breakdown,
        badges: badges
      },
      logs: this.current.logs
    };
  }
}

// グローバルスコープへエクスポート（ブラウザ環境用）
if (typeof window !== "undefined") {
  window.CorporateBattleEngine = CorporateBattleEngine;
}