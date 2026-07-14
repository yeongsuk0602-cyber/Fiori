sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/odata/v2/ODataModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (
  Controller,
  Filter,
  FilterOperator,
  JSONModel,
  ODataModel,
  MessageBox,
  MessageToast
) {
  "use strict";

  return Controller.extend("zpf4pp0003.controller.Main", {
    _sServiceUrl: "/sap/opu/odata/sap/ZGWF4PP0003_SRV/",
    _sOrderDetailSet: "/OrderDetailSet",

    _mAliases: {
      aufnr: ["Aufnr", "AUFNR"],
      plnum: ["Plnum", "PLNUM"],
      matnr: ["Matnr", "MATNR"],
      maktx: ["Maktx", "MAKTX"],
      werks: ["Werks", "WERKS"],
      bukrs: ["Bukrs", "BUKRS", "Burks", "BURKS"],
      aufst: ["Aufst", "AUFST"],
      gamng: ["Gamng", "GAMNG"],
      meins: ["Meins", "MEINS"],
      yieldQty: ["YieldQty", "YIELD_QTY", "Yield_Qty", "YIELDQTY"],
      scrapQty: ["ScrapQty", "SCRAP_QTY", "Scrap_Qty", "SCRAPQTY"],
      actCarbon: ["ActCarbon", "ACT_CARBON", "Act_Carbon", "ACTCARBON"],
      workTime: ["WorkTime", "WORK_TIME", "Work_Time", "WORKTIME"],
      zcrbMeins: ["ZcrbMeins", "ZCRB_MEINS", "Zcrb_Meins"],
      achRate: ["AchRate", "ACH_RATE", "Ach_Rate", "ACHRATE"],
      defectRate: ["DefectRate", "DEFECT_RATE", "Defect_Rate", "DEFECTRATE"]
    },

    onInit: function () {
      this.getView().setModel(new JSONModel(this._getInitialState()), "view");
      this.getView().setModel(this._getODataModel());
      this._loadMetadataProperties().then(function () {
        this.onSearch();
      }.bind(this));
    },

    onSearch: function () {
      var oViewModel = this.getView().getModel("view");

      oViewModel.setProperty("/busy", true);
      this._getODataModel().read(this._sOrderDetailSet, {
        filters: this._buildFilters(),
        success: function (oData) {
          this._onDataReceived(oData);
        }.bind(this),
        error: function (oError) {
          oViewModel.setProperty("/busy", false);
          oViewModel.setProperty("/rows", []);
          this._updateDashboard([]);
          MessageBox.error(this._getODataErrorText(oError));
        }.bind(this)
      });
    },

    onResetFilters: function () {
      this.getView().getModel("view").setProperty("/filters", this._getInitialFilters());
      this.onSearch();
    },

    onRefresh: function () {
      this.onSearch();
    },

    onScrollToTop: function () {
      var oPage = this.byId("dashboardPage");
      var oScrollDelegate = oPage && oPage.getScrollDelegate && oPage.getScrollDelegate();

      if (oScrollDelegate) {
        oScrollDelegate.scrollTo(0, 0, 300);
      }
    },

    onPressEvent: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("view");
      var oData = oContext && oContext.getObject();

      if (oData) {
        MessageToast.show("생산오더 " + (oData.Aufnr || "-"));
      }
    },

    formatNumber: function (vValue, iDecimals) {
      var nValue;

      if (vValue === null || vValue === undefined || vValue === "") {
        return "";
      }

      nValue = this._toNumber(vValue);
      return nValue.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: iDecimals === undefined ? 3 : iDecimals
      });
    },

    formatPercent: function (vValue) {
      return this._toNumber(vValue).toFixed(2);
    },

    formatAchState: function (vRate) {
      var nRate = this._toNumber(vRate);

      if (nRate >= 95) {
        return "Success";
      }
      if (nRate >= 80) {
        return "Warning";
      }
      return "Error";
    },

    formatDefectState: function (vRate) {
      var nRate = this._toNumber(vRate);

      if (nRate < 3) {
        return "Success";
      }
      if (nRate <= 5) {
        return "Warning";
      }
      return "Error";
    },

    formatAchValueColor: function (vRate) {
      var nRate = this._toNumber(vRate);

      if (nRate >= 95) {
        return "Good";
      }
      if (nRate >= 80) {
        return "Critical";
      }
      return "Error";
    },

    formatDefectValueColor: function (vRate) {
      var nRate = this._toNumber(vRate);

      if (nRate < 3) {
        return "Good";
      }
      if (nRate <= 5) {
        return "Critical";
      }
      return "Error";
    },

    formatStatusState: function (sStatus) {
      if (sStatus === "TECO") {
        return "Success";
      }
      if (sStatus === "CNF") {
        return "Information";
      }
      if (sStatus === "REL") {
        return "Warning";
      }
      return "None";
    },

    _getODataModel: function () {
      if (!this._oODataModel) {
        this._oODataModel = new ODataModel(this._sServiceUrl, {
          defaultBindingMode: "OneWay",
          defaultCountMode: "Inline",
          useBatch: false
        });
      }

      return this._oODataModel;
    },

    _loadMetadataProperties: function () {
      this._mProperties = {};

      return this._getODataModel().metadataLoaded().then(function () {
        var oMetaModel = this._getODataModel().getMetaModel();
        var oEntitySet = oMetaModel.getODataEntitySet("OrderDetailSet");
        var oEntityType = oEntitySet && oMetaModel.getODataEntityType(oEntitySet.entityType);
        var aProperties = oEntityType && oEntityType.property ? oEntityType.property : [];

        aProperties.forEach(function (oProperty) {
          this._mProperties[oProperty.name.toUpperCase()] = oProperty.name;
        }.bind(this));
      }.bind(this)).catch(function () {
        this._mProperties = {};
      }.bind(this));
    },

    _buildFilters: function () {
      var oFilters = this.getView().getModel("view").getProperty("/filters");
      var aFilters = [];
      var sWerks = this._resolvePropertyName("werks");
      var sMatnr = this._resolvePropertyName("matnr");
      var sAufnr = this._resolvePropertyName("aufnr");
      var sAufst = this._resolvePropertyName("aufst");

      if (oFilters.WERKS && sWerks) {
        aFilters.push(new Filter(sWerks, FilterOperator.EQ, oFilters.WERKS));
      }
      if (oFilters.MATNR && sMatnr) {
        aFilters.push(new Filter(sMatnr, FilterOperator.Contains, oFilters.MATNR));
      }
      if (oFilters.AUFNR && sAufnr) {
        aFilters.push(new Filter(sAufnr, FilterOperator.Contains, oFilters.AUFNR));
      }
      if (oFilters.AUFST && sAufst) {
        aFilters.push(new Filter(sAufst, FilterOperator.EQ, oFilters.AUFST));
      }

      return aFilters;
    },

    _onDataReceived: function (oData) {
      var aRows = oData && oData.results ? oData.results : [];
      var aNormalizedRows = aRows.map(this._normalizeRow.bind(this));
      var oViewModel = this.getView().getModel("view");

      oViewModel.setProperty("/busy", false);
      oViewModel.setProperty("/rows", aNormalizedRows);
      this._updateDashboard(aNormalizedRows);
    },

    _normalizeRow: function (oRow) {
      var nGamng = this._toNumber(this._getValue(oRow, "gamng"));
      var nYield = this._toNumber(this._getValue(oRow, "yieldQty"));
      var nScrap = this._toNumber(this._getValue(oRow, "scrapQty"));
      var nTotalActual = nYield + nScrap;
      var nAchRate = this._getValue(oRow, "achRate");
      var nDefectRate = this._getValue(oRow, "defectRate");

      if (nAchRate === "" && nGamng > 0) {
        nAchRate = nYield / nGamng * 100;
      }
      if (nDefectRate === "" && nTotalActual > 0) {
        nDefectRate = nScrap / nTotalActual * 100;
      }

      return {
        Aufnr: this._getValue(oRow, "aufnr"),
        Plnum: this._getValue(oRow, "plnum"),
        Matnr: this._getValue(oRow, "matnr"),
        Maktx: this._getValue(oRow, "maktx"),
        Werks: this._getValue(oRow, "werks"),
        Bukrs: this._getValue(oRow, "bukrs"),
        Aufst: this._getValue(oRow, "aufst"),
        Gamng: nGamng,
        Meins: this._getValue(oRow, "meins"),
        YieldQty: nYield,
        ScrapQty: nScrap,
        ActCarbon: this._toNumber(this._getValue(oRow, "actCarbon")),
        WorkTime: this._toNumber(this._getValue(oRow, "workTime")),
        ZcrbMeins: this._getValue(oRow, "zcrbMeins") || "kgCO2",
        AchRate: this._toNumber(nAchRate),
        DefectRate: this._toNumber(nDefectRate)
      };
    },

    _updateDashboard: function (aRows) {
      var nGamng = 0;
      var nYield = 0;
      var nScrap = 0;
      var nCarbon = 0;
      var aTopCarbonRows;
      var aAchievementRows;
      var nTotalActual;

      aRows.forEach(function (oRow) {
        nGamng += this._toNumber(oRow.Gamng);
        nYield += this._toNumber(oRow.YieldQty);
        nScrap += this._toNumber(oRow.ScrapQty);
        nCarbon += this._toNumber(oRow.ActCarbon);
      }.bind(this));

      nTotalActual = nYield + nScrap;
      aAchievementRows = aRows.slice(0, 12);
      aTopCarbonRows = aRows.slice().sort(function (a, b) {
        return this._toNumber(b.ActCarbon) - this._toNumber(a.ActCarbon);
      }.bind(this)).slice(0, 8);

      this.getView().getModel("view").setProperty("/kpi", {
        achRate: nGamng > 0 ? nYield / nGamng * 100 : 0,
        defectRate: nTotalActual > 0 ? nScrap / nTotalActual * 100 : 0,
        carbonSum: nCarbon,
        orderCount: aRows.length,
        unit: aRows[0] && aRows[0].ZcrbMeins ? aRows[0].ZcrbMeins : "kgCO2"
      });
      this.getView().getModel("view").setProperty("/achievementRows", aAchievementRows);
      this.getView().getModel("view").setProperty("/carbonRows", aTopCarbonRows);
    },

    _resolvePropertyName: function (sAlias) {
      var aNames = this._mAliases[sAlias] || [];
      var i;

      for (i = 0; i < aNames.length; i += 1) {
        if (this._mProperties && this._mProperties[aNames[i].toUpperCase()]) {
          return this._mProperties[aNames[i].toUpperCase()];
        }
      }

      return aNames[0];
    },

    _getValue: function (oRow, sAlias) {
      var aNames = this._mAliases[sAlias] || [];
      var i;

      for (i = 0; i < aNames.length; i += 1) {
        if (oRow[aNames[i]] !== null && oRow[aNames[i]] !== undefined && oRow[aNames[i]] !== "") {
          return oRow[aNames[i]];
        }
      }

      return "";
    },

    _toNumber: function (vValue) {
      var nValue;

      if (vValue === null || vValue === undefined || vValue === "") {
        return 0;
      }

      nValue = Number(String(vValue).replace(/,/g, ""));
      return Number.isFinite(nValue) ? nValue : 0;
    },

    _getODataErrorText: function (oError) {
      if (oError && oError.message) {
        return oError.message;
      }
      if (oError && oError.responseText) {
        try {
          return JSON.parse(oError.responseText).error.message.value;
        } catch (e) {
          return oError.responseText;
        }
      }

      return "서버와 통신 중 오류가 발생했습니다.";
    },

    _getInitialState: function () {
      return {
        busy: false,
        filters: this._getInitialFilters(),
        kpi: {
          achRate: 0,
          defectRate: 0,
          carbonSum: 0,
          orderCount: 0,
          unit: "kgCO2"
        },
        rows: [],
        achievementRows: [],
        carbonRows: []
      };
    },

    _getInitialFilters: function () {
      return {
        WERKS: "1000",
        MATNR: "",
        AUFNR: "",
        AUFST: "TECO"
      };
    }
  });
});
