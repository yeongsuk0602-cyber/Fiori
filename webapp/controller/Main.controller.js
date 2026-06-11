sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/m/ColumnListItem",
  "sap/m/Text",
  "sap/m/ObjectNumber",
  "sap/m/ObjectStatus"
], function (Controller, Filter, FilterOperator, JSONModel, MessageBox, MessageToast, ColumnListItem, Text, ObjectNumber, ObjectStatus) {
  "use strict";

  return Controller.extend("zrf4pp0002.controller.Main", {
    _sServiceUrl: "/sap/opu/odata/sap/ZGWF4PP0001_SRV/",
    _sProductionOrderSet: "/esProdHeadSet",
    _sConfirmationSet: "/esPerfoSet",
    _sQualitySet: "/esQualitySet",
    _mProdHeadFields: {
      AUFNR: "Aufnr",
      PLNUM: "Plnum",
      MATNR: "Matnr",
      WERKS: "Werks",
      PLNNR: "Plnnr",
      GAMNG: "Gamng",
      MEINS: "Meins",
      MAKTX: "Maktx",
      AUFST: "Aufst",
      ERDAT: "Erdat"
    },


    onInit: function () {
      var oViewModel = new JSONModel(this._getInitialViewState());
      this.getView().setModel(oViewModel, "view");
    },

    onSearch: function () {
      var oViewModel = this.getView().getModel("view");
      var oFilters = oViewModel.getProperty("/filters");
      var oTable = this.byId("orderTable");
      var oModel = this._getODataModel();
      var aFilters = [];

      if (oFilters.AUFNR) {
        aFilters.push(new Filter(this._mProdHeadFields.AUFNR, FilterOperator.EQ, oFilters.AUFNR));
      }
      if (oFilters.MATNR) {
        aFilters.push(new Filter(this._mProdHeadFields.MATNR, FilterOperator.Contains, oFilters.MATNR));
      }
      if (oFilters.WERKS) {
        aFilters.push(new Filter(this._mProdHeadFields.WERKS, FilterOperator.EQ, oFilters.WERKS));
      }
      if (oFilters.AUFST) {
        aFilters.push(new Filter(this._mProdHeadFields.AUFST, FilterOperator.EQ, oFilters.AUFST));
      }
      if (oFilters.ERDAT_FROM && oFilters.ERDAT_TO) {
        aFilters.push(new Filter(this._mProdHeadFields.ERDAT, FilterOperator.BT, oFilters.ERDAT_FROM, oFilters.ERDAT_TO));
      } else if (oFilters.ERDAT_FROM) {
        aFilters.push(new Filter(this._mProdHeadFields.ERDAT, FilterOperator.GE, oFilters.ERDAT_FROM));
      } else if (oFilters.ERDAT_TO) {
        aFilters.push(new Filter(this._mProdHeadFields.ERDAT, FilterOperator.LE, oFilters.ERDAT_TO));
      }

      if (!oTable.getBinding("items")) {
        oTable.setModel(oModel);
        oTable.bindItems({
          path: this._sProductionOrderSet,
          template: this._createOrderItemTemplate()
        });
      }

      oTable.getBinding("items").filter(aFilters);
    },

    onSelectionChange: function () {
      var aSelectedOrders = this._getSelectedOrders();
      var bSelected = aSelectedOrders.length > 0;
      var oViewModel = this.getView().getModel("view");

      oViewModel.setProperty("/formEnabled", bSelected);
      oViewModel.setProperty("/quality", this._getInitialQuality());

      if (aSelectedOrders.length === 1) {
        this._applyDefaultConfirmationFromOrder(aSelectedOrders[0]);
        this._loadQualityHistory(aSelectedOrders[0]);
      } else {
        oViewModel.setProperty("/confirmation", this._getInitialConfirmation());
      }

      this._updateConfirmEnabled();
    },

    onConfirmationInputChange: function () {
      this._applyAutoVcode();
      this._updateConfirmEnabled();
    },

    onConfirm: function () {
      var aSelectedOrders = this._getSelectedOrders();
      var oValidation = this._validateConfirmation(aSelectedOrders);

      if (!oValidation.valid) {
        MessageBox.error(oValidation.message);
        return;
      }

      if (aSelectedOrders.length > 1) {
        MessageBox.warning("선택된 오더에 동일한 값이 적용됩니다. 계속하시겠습니까?", {
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          emphasizedAction: MessageBox.Action.OK,
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.OK) {
              this._confirmSelectedOrders(aSelectedOrders);
            }
          }.bind(this)
        });
        return;
      }

      this._confirmSelectedOrders(aSelectedOrders);
    },

    onReset: function () {
      var oViewModel = this.getView().getModel("view");
      oViewModel.setProperty("/confirmation", this._getInitialConfirmation());
      oViewModel.setProperty("/quality", this._getInitialQuality());
      oViewModel.setProperty("/canConfirm", false);
      this.byId("orderTable").removeSelections(true);
      oViewModel.setProperty("/formEnabled", false);
    },

    onClearFilters: function () {
      var oViewModel = this.getView().getModel("view");
      var oBinding = this.byId("orderTable").getBinding("items");
      oViewModel.setProperty("/filters", this._getInitialFilters());
      if (oBinding) {
        oBinding.filter([]);
      }
    },

    onClose: function () {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      MessageToast.show("닫을 이전 화면이 없습니다.");
    },

    onMaterialValueHelp: function () {
      MessageToast.show("자재 F4 도움말은 Gateway Search Help 또는 ValueList 서비스 연결 후 구현합니다.");
    },

    formatNumber: function (vValue) {
      if (vValue === null || vValue === undefined || vValue === "") {
        return "";
      }
      return Number(vValue).toLocaleString();
    },

    formatUnit: function (sMeins) {
      return sMeins || "";
    },

    formatDate: function (vDate) {
      if (!vDate) {
        return "";
      }
      if (typeof vDate === "string") {
        return vDate.substring(0, 10);
      }
      if (vDate instanceof Date) {
        return vDate.toISOString().substring(0, 10);
      }
      return String(vDate);
    },

    formatStatusText: function (sStatus) {
      return sStatus || "";
    },

    formatStatusState: function (sStatus) {
      if (sStatus === "REL") {
        return "Success";
      }
      if (sStatus === "TECO") {
        return "Information";
      }
      return "None";
    },

    formatConfirmIcon: function (sConfirmYn) {
      return sConfirmYn === "Y" ? "sap-icon://accept" : "sap-icon://decline";
    },

    formatConfirmColor: function (sConfirmYn) {
      return sConfirmYn === "Y" ? "#107e3e" : "#6a6d70";
    },

    _confirmSelectedOrders: function (aOrders) {
      var oModel = this._getODataModel();
      var oConfirmation = this.getView().getModel("view").getProperty("/confirmation");
      var aRequests = aOrders.map(function (oOrder) {
        return this._submitConfirmation(oModel, oOrder, oConfirmation);
      }, this);

      Promise.all(aRequests).then(function () {
        MessageToast.show("생산 실적 확정이 완료되었습니다.");
        this.onReset();
        this.onSearch();
      }.bind(this)).catch(function (oError) {
        MessageBox.error(this._getODataErrorText(oError));
      }.bind(this));
    },

    _submitConfirmation: function (oModel, oOrder, oConfirmation) {
      var oPayload = {
        Aufnr: oOrder[this._mProdHeadFields.AUFNR],
        Matnr: oOrder[this._mProdHeadFields.MATNR],
        YieldQty: this._toNumber(oConfirmation.YIELD_QTY),
        ScrapQty: this._toNumber(oConfirmation.SCRAP_QTY),
        ZcrbMeins: oConfirmation.ZCRB_MEINS,
        Vcode: oConfirmation.VCODE,
        InspMode: oConfirmation.INSP_MODE
      };

      return this._createConfirmation(oModel, oPayload);
    },

    _confirmReprocessing: function (oModel, oOrder, oPayload) {
      return new Promise(function (resolve, reject) {
        MessageBox.warning("이미 확정된 오더입니다. 재확정하시겠습니까?", {
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          emphasizedAction: MessageBox.Action.OK,
          onClose: function (sAction) {
            if (sAction !== MessageBox.Action.OK) {
              reject(new Error("재확정이 취소되었습니다."));
              return;
            }

            var sPath = oModel.createKey(this._sConfirmationSet, {
              Aufnr: oOrder[this._mProdHeadFields.AUFNR]
            });
            oModel.update(sPath, oPayload, {
              merge: true,
              success: resolve,
              error: reject
            });
          }
        });
      });
    },

    _createConfirmation: function (oModel, oPayload) {
      return new Promise(function (resolve, reject) {
        oModel.create(this._sConfirmationSet, oPayload, {
          success: resolve,
          error: reject
        });
      });
    },

    _validateConfirmation: function (aSelectedOrders) {
      var oConfirmation = this.getView().getModel("view").getProperty("/confirmation");

      if (!aSelectedOrders.length) {
        return { valid: false, message: "생산오더를 선택하세요." };
      }

      var nYieldQty = this._toNumber(oConfirmation.YIELD_QTY);
      var nScrapQty = this._toNumber(oConfirmation.SCRAP_QTY);
      var nActCarbon = this._toNumber(oConfirmation.ACT_CARBON);

      if (nYieldQty < 0 || nScrapQty < 0 || nActCarbon < 0) {
        return { valid: false, message: "수량과 탄소 배출량은 0 이상이어야 합니다." };
      }
      if (nYieldQty === 0 && nScrapQty === 0) {
        return { valid: false, message: "양품 또는 불량 수량을 1 이상 입력하세요." };
      }
      for (var i = 0; i < aSelectedOrders.length; i += 1) {
        var oOrder = aSelectedOrders[i];
        var nTargetQty = this._toNumber(oOrder[this._mProdHeadFields.GAMNG]);

        if (oOrder[this._mProdHeadFields.AUFST] !== "REL" && oOrder[this._mProdHeadFields.AUFST] !== "CRTD") {
          return { valid: false, message: "CRTD 또는 REL 상태의 오더만 실적 등록 가능합니다." };
        }
        if (nYieldQty + nScrapQty > nTargetQty) {
          return { valid: false, message: "양품+불량 수량이 목표 수량을 초과할 수 없습니다." };
        }
      }

      return { valid: true };
    },

    _applyAutoVcode: function () {
      var oViewModel = this.getView().getModel("view");
      var oConfirmation = oViewModel.getProperty("/confirmation");
      var nYieldQty = this._toNumber(oConfirmation.YIELD_QTY);
      var nScrapQty = this._toNumber(oConfirmation.SCRAP_QTY);
      var nTotalQty = nYieldQty + nScrapQty;

      if (nTotalQty <= 0) {
        return;
      }

      var nScrapRate = nScrapQty / nTotalQty * 100;
      var sVcode = "ACC";

      if (nScrapRate >= 10) {
        sVcode = "REJ";
      } else if (nScrapRate >= 3) {
        sVcode = "PAR";
      }

      oViewModel.setProperty("/confirmation/VCODE", sVcode);
    },

    _updateConfirmEnabled: function () {
      var aSelectedOrders = this._getSelectedOrders();
      var bEnabled = aSelectedOrders.length > 0;

      this.getView().getModel("view").setProperty("/canConfirm", bEnabled);
    },

    _getSelectedOrders: function () {
      return this.byId("orderTable").getSelectedItems().map(function (oItem) {
        return oItem.getBindingContext().getObject();
      });
    },

    _getODataModel: function () {
      if (!this._oODataModel) {
        this._oODataModel = new sap.ui.model.odata.v2.ODataModel(this._sServiceUrl, {
          defaultBindingMode: "TwoWay",
          defaultCountMode: "Inline",
          useBatch: false
        });
      }
      return this._oODataModel;
    },

    _loadQualityHistory: function (oOrder) {
      var sAufnr = oOrder[this._mProdHeadFields.AUFNR];
      var oViewModel = this.getView().getModel("view");

      if (!sAufnr) {
        return;
      }

      this._getODataModel().read(this._sQualitySet, {
        filters: [
          new Filter("Aufnr", FilterOperator.EQ, sAufnr)
        ],
        success: function (oData) {
          var aResults = oData && oData.results ? oData.results : [];

          if (!aResults.length) {
            MessageToast.show("해당 생산오더의 품질검사 이력이 없습니다.");
            return;
          }

          var oQuality = aResults[0];
          oViewModel.setProperty("/quality", oQuality);
          oViewModel.setProperty("/confirmation/INSP_MODE", oQuality.InspMode || "AUTO");
          oViewModel.setProperty("/confirmation/VCODE", oQuality.Vcode || "ACC");
        },
        error: function (oError) {
          MessageBox.error(this._getODataErrorText(oError));
        }.bind(this)
      });
    },

    _loadCalculatedOrderValues: function (oOrder) {
      var sAufnr = oOrder[this._mProdHeadFields.AUFNR];
      var sMandt = oOrder.Mandt || oOrder.MANDT || "100";
      var oViewModel = this.getView().getModel("view");
      var oModel = this._getODataModel();
      var sPath;

      if (!sAufnr) {
        return;
      }

      sPath = oModel.createKey(this._sProductionOrderSet, {
        Mandt: sMandt,
        Aufnr: sAufnr
      });

      oModel.read(sPath, {
        success: function (oData) {
          oViewModel.setProperty("/confirmation/WORK_TIME", this._getFirstValue(oData, ["Worktime", "WorkTime", "WORK_TIME", "Work_Time"]));
          oViewModel.setProperty("/confirmation/ACT_CARBON", this._getFirstValue(oData, ["Act_Carbon", "ActCarbon", "ACT_CARBON", "Actcarbon"]));
        }.bind(this),
        error: function () {
          oViewModel.setProperty("/confirmation/WORK_TIME", this._getFirstValue(oOrder, ["Worktime", "WorkTime", "WORK_TIME", "Work_Time"]));
          oViewModel.setProperty("/confirmation/ACT_CARBON", this._getFirstValue(oOrder, ["Act_Carbon", "ActCarbon", "ACT_CARBON", "Actcarbon"]));
        }.bind(this)
      });
    },

    _applyDefaultConfirmationFromOrder: function (oOrder) {
      var oViewModel = this.getView().getModel("view");
      var oConfirmation = this._getInitialConfirmation();
      var vWorkTime = this._getFirstValue(oOrder, ["Worktime", "WorkTime", "WORK_TIME", "Work_Time"]);
      var vActCarbon = this._getFirstValue(oOrder, ["Act_Carbon", "ActCarbon", "ACT_CARBON", "Actcarbon"]);

      oConfirmation.YIELD_QTY = this._toNumber(oOrder[this._mProdHeadFields.GAMNG]);
      oConfirmation.SCRAP_QTY = 0;
      oConfirmation.WORK_TIME = this._normalizeNumberString(vWorkTime);
      oConfirmation.ACT_CARBON = this._normalizeNumberString(vActCarbon);

      oViewModel.setProperty("/confirmation", oConfirmation);
      this._applyAutoVcode();
    },

    _createOrderItemTemplate: function () {
      return new ColumnListItem({
        cells: [
          new Text({ text: "{Aufnr}" }),
          new Text({ text: "{Plnum}" }),
          new Text({ text: "{Matnr}" }),
          new Text({ text: "{Maktx}" }),
          new Text({ text: "{Werks}" }),
          new Text({ text: "{Plnnr}" }),
          new ObjectNumber({ number: { path: "Gamng", formatter: this.formatNumber.bind(this) } }),
          new Text({ text: { path: "Meins", formatter: this.formatUnit.bind(this) } }),
          new ObjectNumber({ number: { path: "Worktime", formatter: this.formatNumber.bind(this) } }),
          new ObjectNumber({ number: { path: "Act_Carbon", formatter: this.formatNumber.bind(this) } }),
          new ObjectStatus({
            text: { path: "Aufst", formatter: this.formatStatusText.bind(this) },
            state: { path: "Aufst", formatter: this.formatStatusState.bind(this) }
          })
        ]
      });
    },

    _toNumber: function (vValue) {
      var nValue = Number(vValue);
      return Number.isFinite(nValue) ? nValue : 0;
    },

    _normalizeNumberString: function (vValue) {
      var sValue;
      var nValue;

      if (vValue === null || vValue === undefined || vValue === "") {
        return "";
      }

      sValue = String(vValue).trim().replace(/,/g, "");
      nValue = Number(sValue);

      if (!Number.isFinite(nValue)) {
        return "";
      }

      return sValue;
    },

    _getFirstValue: function (oSource, aNames) {
      for (var i = 0; i < aNames.length; i += 1) {
        if (oSource[aNames[i]] !== null && oSource[aNames[i]] !== undefined && oSource[aNames[i]] !== "") {
          return oSource[aNames[i]];
        }
      }
      return "";
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
      return "서버와의 통신 중 오류가 발생했습니다. 네트워크를 확인하세요.";
    },

    _getInitialViewState: function () {
      return {
        filters: this._getInitialFilters(),
        confirmation: this._getInitialConfirmation(),
        quality: this._getInitialQuality(),
        formEnabled: false,
        canConfirm: false
      };
    },

    _getInitialFilters: function () {
      return {
        AUFNR: "",
        MATNR: "",
        WERKS: "",
        AUFST: "",
        ERDAT_FROM: "",
        ERDAT_TO: ""
      };
    },

    _getInitialConfirmation: function () {
      return {
        YIELD_QTY: "",
        SCRAP_QTY: "",
        WORK_TIME: "",
        ACT_CARBON: "",
        ZCRB_MEINS: "KG",
        VCODE: "ACC",
        INSP_MODE: "AUTO"
      };
    },

    _getInitialQuality: function () {
      return {
        Prueflos: "",
        Aufnr: "",
        Qtype: "",
        InspMode: "",
        Lifnr: "",
        Matnr: "",
        Vcode: "",
        Charg: ""
      };
    }
  });
});
