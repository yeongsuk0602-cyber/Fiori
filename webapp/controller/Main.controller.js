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
  "sap/m/ObjectStatus",
  "sap/m/SelectDialog",
  "sap/m/StandardListItem"
], function (Controller, Filter, FilterOperator, JSONModel, MessageBox, MessageToast, ColumnListItem, Text, ObjectNumber, ObjectStatus, SelectDialog, StandardListItem) {
  "use strict";

  return Controller.extend("zrf4pp0002.controller.Main", {
    _sServiceUrl: "/sap/opu/odata/sap/ZGWF4PP0001_SRV/",
    _sProductionOrderSet: "/esProdHeadSet",
    _sConfirmationSet: "/esPerfoSet",
    _sSettlementSet: "/esAdjustSet",
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
      ERDAT: "Erdat",
      VERPR: "Verpr",
      NETWR: "Netwr"
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
        oViewModel.setProperty("/settlement", this._getInitialSettlement());
        this._applyDefaultConfirmationFromOrder(aSelectedOrders[0]);
        this._loadCalculatedOrderValues(aSelectedOrders[0]);
        this._loadPerformanceHistory(aSelectedOrders[0]);
        this._loadSettlementHistory(aSelectedOrders[0]);
        this._loadQualityHistory(aSelectedOrders[0]);
      } else {
        oViewModel.setProperty("/confirmation", this._getInitialConfirmation());
        oViewModel.setProperty("/settlement", this._getInitialSettlement());
      }

      this._updateConfirmEnabled();
    },

    onConfirmationInputChange: function () {
      this._applyAutoVcode();
      this._updateSettlementPreview(this._getSelectedOrders()[0]);
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
      oViewModel.setProperty("/settlement", this._getInitialSettlement());
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

    onProductionOrderValueHelp: function () {
      this._openValueHelp("AUFNR");
    },

    onMaterialValueHelp: function () {
      this._openValueHelp("MATNR");
    },

    _openValueHelp: function (sType) {
      var oDialog = this._createValueHelpDialog(sType);
      var oHelpModel = new JSONModel({
        items: this._getValueHelpItemsFromTable(sType)
      });

      oDialog.setModel(oHelpModel, "valueHelp");
      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    _createValueHelpDialog: function (sType) {
      var bProductionOrder = sType === "AUFNR";
      var sTitle = bProductionOrder ? "생산오더 선택" : "제품번호 선택";

      return new SelectDialog({
        title: sTitle,
        noDataText: "조회 결과가 없습니다.",
        rememberSelections: false,
        items: {
          path: "valueHelp>/items",
          template: new StandardListItem({
            title: "{valueHelp>title}",
            description: "{valueHelp>description}",
            info: "{valueHelp>info}",
            type: "Active"
          })
        },
        search: function (oEvent) {
          this._filterValueHelpItems(oEvent.getParameter("value"), oEvent.getSource());
        }.bind(this),
        liveChange: function (oEvent) {
          this._filterValueHelpItems(oEvent.getParameter("value"), oEvent.getSource());
        }.bind(this),
        confirm: function (oEvent) {
          var oSelectedItem = oEvent.getParameter("selectedItem");
          var oContext = oSelectedItem && oSelectedItem.getBindingContext("valueHelp");
          var oItem = oContext && oContext.getObject();

          if (!oItem) {
            return;
          }

          this.getView().getModel("view").setProperty(
            bProductionOrder ? "/filters/AUFNR" : "/filters/MATNR",
            oItem.key
          );
        }.bind(this),
        afterClose: function (oEvent) {
          oEvent.getSource().destroy();
        }
      });
    },

    _filterValueHelpItems: function (sValue, oDialog) {
      var oBinding = oDialog && oDialog.getBinding("items");
      var aFilters = [];

      if (sValue) {
        aFilters.push(new Filter({
          filters: [
            new Filter("title", FilterOperator.Contains, sValue),
            new Filter("description", FilterOperator.Contains, sValue),
            new Filter("info", FilterOperator.Contains, sValue)
          ],
          and: false
        }));
      }

      if (oBinding) {
        oBinding.filter(aFilters);
      }
    },

    _getValueHelpItemsFromTable: function (sType) {
      var oTable = this.byId("orderTable");
      var oBinding = oTable && oTable.getBinding("items");
      var aContexts = oBinding ? oBinding.getCurrentContexts() : [];
      var bProductionOrder = sType === "AUFNR";
      var mSeen = {};

      return aContexts.reduce(function (aItems, oContext) {
        var oRow = oContext && oContext.getObject();
        var sAufnr;
        var sMatnr;
        var sMaktx;
        var sAufst;
        var sGamng;
        var sMeins;
        var sKey;

        if (!oRow) {
          return aItems;
        }

        sAufnr = this._getFirstValue(oRow, ["Aufnr", "AUFNR"]);
        sMatnr = this._getFirstValue(oRow, ["Matnr", "MATNR"]);
        sMaktx = this._getFirstValue(oRow, ["Maktx", "MAKTX"]);
        sAufst = this._getFirstValue(oRow, ["Aufst", "AUFST"]);
        sGamng = this._getFirstValue(oRow, ["Gamng", "GAMNG"]);
        sMeins = this._getFirstValue(oRow, ["Meins", "MEINS"]);
        sKey = bProductionOrder ? sAufnr : sMatnr;

        if (!sKey || mSeen[sKey]) {
          return aItems;
        }

        mSeen[sKey] = true;
        aItems.push({
          key: sKey,
          title: sKey,
          description: bProductionOrder ? [sMatnr, sMaktx].filter(Boolean).join(" / ") : sMaktx,
          info: bProductionOrder ? [sAufst, this.formatNumber(sGamng), sMeins].filter(Boolean).join(" / ") : sMeins
        });

        return aItems;
      }.bind(this), []);
    },

    _loadValueHelpData: function (sType) {
      var oModel = this._getODataModel();

      return new Promise(function (resolve, reject) {
        oModel.read(this._sProductionOrderSet, {
          filters: this._getValueHelpReadFilters(sType),
          urlParameters: {
            "$top": 200
          },
          success: function (oData) {
            resolve(this._mapValueHelpItems(sType, oData && oData.results ? oData.results : []));
          }.bind(this),
          error: reject
        });
      }.bind(this));
    },

    _getValueHelpReadFilters: function (sType) {
      var oFilters = this.getView().getModel("view").getProperty("/filters") || {};
      var aFilters = [];

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
      if (sType === "AUFNR" && oFilters.MATNR) {
        aFilters.push(new Filter(this._mProdHeadFields.MATNR, FilterOperator.Contains, oFilters.MATNR));
      }
      if (sType === "MATNR" && oFilters.AUFNR) {
        aFilters.push(new Filter(this._mProdHeadFields.AUFNR, FilterOperator.EQ, oFilters.AUFNR));
      }

      return aFilters;
    },

    _mapValueHelpItems: function (sType, aRows) {
      var bProductionOrder = sType === "AUFNR";
      var mSeen = {};

      return aRows.reduce(function (aItems, oRow) {
        var sAufnr = this._getFirstValue(oRow, ["Aufnr", "AUFNR"]);
        var sMatnr = this._getFirstValue(oRow, ["Matnr", "MATNR"]);
        var sMaktx = this._getFirstValue(oRow, ["Maktx", "MAKTX"]);
        var sAufst = this._getFirstValue(oRow, ["Aufst", "AUFST"]);
        var sGamng = this._getFirstValue(oRow, ["Gamng", "GAMNG"]);
        var sMeins = this._getFirstValue(oRow, ["Meins", "MEINS"]);
        var sKey = bProductionOrder ? sAufnr : sMatnr;

        if (!sKey || mSeen[sKey]) {
          return aItems;
        }

        mSeen[sKey] = true;
        aItems.push({
          key: sKey,
          title: sKey,
          description: bProductionOrder ? [sMatnr, sMaktx].filter(Boolean).join(" / ") : sMaktx,
          info: bProductionOrder ? [sAufst, this.formatNumber(sGamng), sMeins].filter(Boolean).join(" / ") : sMeins
        });

        return aItems;
      }.bind(this), []);
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
        var sAufnr = aOrders.length === 1 ? aOrders[0][this._mProdHeadFields.AUFNR] : "";
        MessageToast.show(sAufnr ? "생산오더(" + sAufnr + ")의 생산실적 및 오더정산 등록이 완료되었습니다." : "생산실적 및 오더정산 등록이 완료되었습니다.");
        this.onReset();
        this.onSearch();
      }.bind(this)).catch(function (oError) {
        if (aOrders.length !== 1) {
          MessageBox.error(this._getODataErrorText(oError));
          return;
        }

        this._verifyConfirmationSaved(aOrders[0]).then(function () {
          var sAufnr = aOrders[0][this._mProdHeadFields.AUFNR];
          MessageToast.show("생산오더(" + sAufnr + ")의 생산실적 및 오더정산 등록이 완료되었습니다.");
          this.onReset();
          this.onSearch();
        }.bind(this)).catch(function () {
          MessageBox.error(this._getODataErrorText(oError));
        }.bind(this));
      }.bind(this));
    },

    _submitConfirmation: function (oModel, oOrder, oConfirmation) {
      var oPayload = {
        Aufnr: oOrder[this._mProdHeadFields.AUFNR],
        Matnr: oOrder[this._mProdHeadFields.MATNR],
        YieldQty: this._toODataDecimal(oConfirmation.YIELD_QTY),
        ScrapQty: this._toODataDecimal(oConfirmation.SCRAP_QTY),
        ActCarbon: String(Math.round(this._toNumber(oConfirmation.ACT_CARBON) || 0)),
        Meins: oOrder[this._mProdHeadFields.MEINS],
        ZcrbMeins: "KG",
        Insp_mode: oConfirmation.INSP_MODE || "AUTO",
        Vcode: oConfirmation.VCODE || "ACC"
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
          error: function (oError) {
            var iStatus = Number(oError && (oError.statusCode || oError.status));

            if (iStatus >= 200 && iStatus < 300) {
              resolve(oError);
              return;
            }

            reject(oError);
          }
        });
      }.bind(this));
    },

    _verifyConfirmationSaved: function (oOrder) {
      var oModel = this._getODataModel();
      var sAufnr = oOrder && oOrder[this._mProdHeadFields.AUFNR];

      return new Promise(function (resolve, reject) {
        if (!sAufnr) {
          reject();
          return;
        }

        oModel.read(this._sProductionOrderSet, {
          filters: [
            new Filter(this._mProdHeadFields.AUFNR, FilterOperator.EQ, sAufnr)
          ],
          urlParameters: {
            "$top": 1
          },
          success: function (oData) {
            var aResults = oData && oData.results;
            var oSavedOrder = aResults && aResults[0];

            if (oSavedOrder && oSavedOrder[this._mProdHeadFields.AUFST] === "TECO") {
              resolve(oSavedOrder);
              return;
            }

            reject();
          }.bind(this),
          error: reject
        });
      }.bind(this));
    },

    _validateConfirmationLegacy: function (aSelectedOrders) {
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

        if (oOrder[this._mProdHeadFields.AUFST] !== "CNF") {
          return { valid: false, message: "CNF 상태의 생산오더만 생산실적 및 오더정산 등록이 가능합니다." };
        }
        if (nYieldQty + nScrapQty > nTargetQty) {
          return { valid: false, message: "양품+불량 수량이 목표 수량을 초과할 수 없습니다." };
        }
      }

      return { valid: true };
    },

    _applyAutoVcodeLegacy: function () {
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

    _validateConfirmation: function (aSelectedOrders) {
      var oConfirmation = this.getView().getModel("view").getProperty("/confirmation");
      var nScrapQty = this._toNumber(oConfirmation.SCRAP_QTY);
      var nActCarbon = this._toNumber(oConfirmation.ACT_CARBON);

      if (!aSelectedOrders.length) {
        return { valid: false, message: "생산오더를 선택하세요." };
      }

      if (nScrapQty < 0 || nActCarbon < 0) {
        return { valid: false, message: "불량 수량과 탄소 배출량은 0 이상이어야 합니다." };
      }

      for (var i = 0; i < aSelectedOrders.length; i += 1) {
        var oOrder = aSelectedOrders[i];
        var nTargetQty = this._toNumber(oOrder[this._mProdHeadFields.GAMNG]);

        if (oOrder[this._mProdHeadFields.AUFST] !== "CNF") {
          return { valid: false, message: "CNF 상태의 생산오더만 생산실적 및 오더정산 등록이 가능합니다." };
        }
        if (nTargetQty <= 0) {
          return { valid: false, message: "생산오더의 목표 수량이 없습니다." };
        }
        if (nScrapQty > nTargetQty) {
          return { valid: false, message: "불량 수량은 목표 수량을 초과할 수 없습니다." };
        }
      }

      return { valid: true };
    },

    _applyAutoVcode: function () {
      var oViewModel = this.getView().getModel("view");
      var oConfirmation = oViewModel.getProperty("/confirmation");
      var nTargetQty = this._toNumber(oConfirmation.YIELD_QTY);
      var nScrapQty = this._toNumber(oConfirmation.SCRAP_QTY);
      var nScrapRate;
      var sVcode = "ACC";

      if (nTargetQty <= 0) {
        return;
      }

      nScrapRate = nScrapQty / nTargetQty * 100;

      if (nScrapRate >= 10) {
        sVcode = "REJ";
      } else if (nScrapRate >= 3) {
        sVcode = "PAR";
      }

      oViewModel.setProperty("/confirmation/VCODE", sVcode);
    },

    _updateConfirmEnabled: function () {
      var aSelectedOrders = this._getSelectedOrders();
      var bEnabled = aSelectedOrders.length === 1 &&
        aSelectedOrders[0][this._mProdHeadFields.AUFST] === "CNF";

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

          var aLotFields = [
            "Prueflos",
            "PRUEFLOS",
            "PruefLos",
            "Pruef_Los",
            "InspectionLot",
            "InspectionLotNo",
            "InspLot",
            "InspLotNo",
            "LotNo",
            "Qmnum",
            "QMNUM"
          ];
          var oQuality = aResults.find(function (oItem) {
            return !!this._getFirstValue(oItem, aLotFields);
          }.bind(this)) || aResults[0];

          oQuality.Prueflos = this._getFirstValue(oQuality, aLotFields) || oQuality.Prueflos || "";
          oQuality.Charg = this._getFirstValue(oQuality, ["Charg", "CHARG", "Batch", "BatchNo", "CCharg", "C_Charg"]) || oQuality.Charg || "";
          oViewModel.setProperty("/quality", oQuality);
          oViewModel.setProperty("/quality/Prueflos", oQuality.Prueflos);
          oViewModel.setProperty("/confirmation/INSP_MODE", oQuality.InspMode || "AUTO");
          oViewModel.setProperty("/confirmation/VCODE", oQuality.Vcode || "ACC");
        }.bind(this),
        error: function (oError) {
          jQuery.sap.log.warning("품질검사 이력 조회 실패", this._getODataErrorText(oError), "zrf4pp0002.controller.Main");
        }.bind(this)
      });
    },

    _loadPerformanceHistory: function (oOrder) {
      var sAufnr = oOrder[this._mProdHeadFields.AUFNR];
      var oViewModel = this.getView().getModel("view");

      if (!sAufnr) {
        return;
      }

      this._getODataModel().read(this._sConfirmationSet, {
        filters: [
          new Filter("Aufnr", FilterOperator.EQ, sAufnr)
        ],
        success: function (oData) {
          var aResults = oData && oData.results ? oData.results : [];
          var oPerformance;
          var oConfirmation;
          var vCarbon;

          if (!aResults.length) {
            return;
          }

          oPerformance = aResults.reduce(function (oLatest, oCurrent) {
            var sLatestKey = String(this._getFirstValue(oLatest, ["Erdat", "ERDAT"])) + String(this._getFirstValue(oLatest, ["Erzet", "ERZET"]));
            var sCurrentKey = String(this._getFirstValue(oCurrent, ["Erdat", "ERDAT"])) + String(this._getFirstValue(oCurrent, ["Erzet", "ERZET"]));
            return sCurrentKey >= sLatestKey ? oCurrent : oLatest;
          }.bind(this), aResults[0]);

          oConfirmation = oViewModel.getProperty("/confirmation") || this._getInitialConfirmation();
          oConfirmation.YIELD_QTY = this._normalizeNumberString(oOrder[this._mProdHeadFields.GAMNG]) || oConfirmation.YIELD_QTY;
          oConfirmation.SCRAP_QTY = this._normalizeNumberString(this._getFirstValue(oPerformance, ["ScrapQty", "SCRAP_QTY", "Scrap_Qty"])) || "0";
          oConfirmation.WORK_TIME = this._normalizeNumberString(this._getFirstValue(oPerformance, ["WorkTime", "Worktime", "WORK_TIME", "Work_Time"])) || oConfirmation.WORK_TIME;

          vCarbon = this._getFirstValue(oPerformance, ["ActCarbon", "Act_Carbon", "ACT_CARBON", "Actcarbon"]);
          if (this._toNumber(vCarbon) > 0) {
            oConfirmation.ACT_CARBON = this._normalizeNumberString(vCarbon);
          }

          oConfirmation.ZCRB_MEINS = this._getFirstValue(oPerformance, ["ZcrbMeins", "ZCRB_MEINS", "Zcrb_Meins"]) || oConfirmation.ZCRB_MEINS || "KG";
          oViewModel.setProperty("/confirmation", oConfirmation);
          this._applyAutoVcode();
          this._updateSettlementPreview(oOrder);
          this._loadSettlementHistory(oOrder);
          this._updateConfirmEnabled();
        }.bind(this),
        error: function (oError) {
          jQuery.sap.log.warning("생산실적 이력 조회 실패", this._getODataErrorText(oError), "zrf4pp0002.controller.Main");
        }.bind(this)
      });
    },

    _loadSettlementHistory: function (oOrder) {
      var sAufnr = oOrder && oOrder[this._mProdHeadFields.AUFNR];

      if (!sAufnr) {
        return;
      }

      this._getODataModel().read(this._sSettlementSet, {
        filters: [
          new Filter("Aufnr", FilterOperator.EQ, sAufnr)
        ],
        success: function (oData) {
          var aResults = oData && oData.results ? oData.results : [];
          var oSettlement;

          if (!aResults.length) {
            return;
          }

          oSettlement = aResults.reduce(function (oLatest, oCurrent) {
            var sLatestKey = String(this._getFirstValue(oLatest, ["Erdat", "ERDAT"])) +
              String(this._getFirstValue(oLatest, ["Erzet", "ERZET"])) +
              String(this._getFirstValue(oLatest, ["SettleId", "SETTLE_ID"]));
            var sCurrentKey = String(this._getFirstValue(oCurrent, ["Erdat", "ERDAT"])) +
              String(this._getFirstValue(oCurrent, ["Erzet", "ERZET"])) +
              String(this._getFirstValue(oCurrent, ["SettleId", "SETTLE_ID"]));

            return sCurrentKey >= sLatestKey ? oCurrent : oLatest;
          }.bind(this), aResults[0]);

          this._applySettlementFromBackend(oSettlement);
        }.bind(this),
        error: function (oError) {
          jQuery.sap.log.warning("오더 정산 이력 조회 실패", this._getODataErrorText(oError), "zrf4pp0002.controller.Main");
        }.bind(this)
      });
    },

    _applySettlementFromBackend: function (oSettlement) {
      var oViewModel = this.getView().getModel("view");
      var nNetwr = this._toNumber(this._getFirstValue(oSettlement, ["Netwr", "NETWR", "netwr"]));
      var nCost01 = this._toNumber(this._getFirstValue(oSettlement, ["ActCost01", "ACT_COST01", "Act_Cost01", "actCost01"]));
      var nCost02 = this._toNumber(this._getFirstValue(oSettlement, ["ActCost02", "ACT_COST02", "Act_Cost02", "actCost02"]));
      var nTotal = this._toNumber(this._getFirstValue(oSettlement, ["TotalAmt", "TOTAL_AMT", "Total_Amt", "totalAmt"]));
      var sWaers = this._getFirstValue(oSettlement, ["Waers", "WAERS", "waers"]) || "KRW";

      if (!nTotal) {
        nTotal = nNetwr + nCost01 + nCost02;
      }

      oViewModel.setProperty("/settlement", {
        NETWR: nNetwr,
        ACT_COST01: nCost01,
        ACT_COST02: nCost02,
        TOTAL_AMT: nTotal,
        WAERS: sWaers,
        IS_BACKEND_SETTLEMENT: true
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
          var vWorkTime = this._getFirstValue(oData, ["Worktime", "WorkTime", "WORK_TIME", "Work_Time"]);
          var vActCarbon = this._getFirstValue(oData, ["Act_Carbon", "ActCarbon", "ACT_CARBON", "Actcarbon"]);
          var oPreviewOrder = this._mergeOrderForPreview(oOrder, oData);

          if (vWorkTime === "") {
            vWorkTime = this._getFirstValue(oOrder, ["Worktime", "WorkTime", "WORK_TIME", "Work_Time"]);
          }
          if (vActCarbon === "") {
            vActCarbon = this._getFirstValue(oOrder, ["Act_Carbon", "ActCarbon", "ACT_CARBON", "Actcarbon"]);
          }

          oViewModel.setProperty("/confirmation/WORK_TIME", this._normalizeNumberString(vWorkTime));
          oViewModel.setProperty("/confirmation/ACT_CARBON", this._normalizeNumberString(vActCarbon));
          this._updateSettlementPreview(oPreviewOrder);
          this._loadSettlementHistory(oOrder);
        }.bind(this),
        error: function () {
          oViewModel.setProperty("/confirmation/WORK_TIME", this._normalizeNumberString(this._getFirstValue(oOrder, ["Worktime", "WorkTime", "WORK_TIME", "Work_Time"])));
          oViewModel.setProperty("/confirmation/ACT_CARBON", this._normalizeNumberString(this._getFirstValue(oOrder, ["Act_Carbon", "ActCarbon", "ACT_CARBON", "Actcarbon"])));
          this._updateSettlementPreview(oOrder);
          this._loadSettlementHistory(oOrder);
        }.bind(this)
      });
    },

    _mergeOrderForPreview: function (oOrder, oData) {
      var oPreviewOrder = Object.assign({}, oOrder || {}, oData || {});
      var vListNetwr = this._getFirstValue(oOrder, [
        this._mProdHeadFields.NETWR,
        "Netwr",
        "NETWR",
        "netwr",
        "NetwrPreview",
        "MaterialCost",
        "MatCost",
        "MatCostAmt",
        "MAT_COST"
      ]);
      var vDetailNetwr = this._getFirstValue(oData, [
        this._mProdHeadFields.NETWR,
        "Netwr",
        "NETWR",
        "netwr",
        "NetwrPreview",
        "MaterialCost",
        "MatCost",
        "MatCostAmt",
        "MAT_COST"
      ]);

      if (this._toNumber(vListNetwr) > 0 && this._toNumber(vDetailNetwr) === 0) {
        oPreviewOrder[this._mProdHeadFields.NETWR] = vListNetwr;
        oPreviewOrder.Netwr = vListNetwr;
      }

      return oPreviewOrder;
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
      this._updateSettlementPreview(oOrder);
    },

    _updateSettlementPreview: function (oOrder) {
      var oViewModel = this.getView().getModel("view");
      var oConfirmation = oViewModel.getProperty("/confirmation") || {};
      var nWorkTime;
      var nNetwr;
      var nCost01;
      var nCost02;
      var nTotal;
      var oCurrentSettlement;
      var vBackendNetwr;
      var vBackendCost01;
      var vBackendCost02;
      var vBackendTotal;

      if (!oOrder) {
        oViewModel.setProperty("/settlement", this._getInitialSettlement());
        return;
      }

      nWorkTime = this._toNumber(oConfirmation.WORK_TIME || this._getFirstValue(oOrder, ["Worktime", "WorkTime", "WORK_TIME", "Work_Time"]));
      // Backend NETWR is component-based; do not derive it from finished-good VERPR.
      oCurrentSettlement = oViewModel.getProperty("/settlement") || {};

      if (oCurrentSettlement.IS_BACKEND_SETTLEMENT && this._getFirstValue(oOrder, [this._mProdHeadFields.AUFST, "Aufst", "AUFST"]) === "TECO") {
        return;
      }

      vBackendNetwr = this._getFirstValue(oOrder, [
        this._mProdHeadFields.NETWR,
        "Netwr",
        "NETWR",
        "netwr",
        "NetwrPreview",
        "MaterialCost",
        "MatCost",
        "MatCostAmt",
        "MAT_COST"
      ]);
      nNetwr = this._resolvePreviewNetwr(vBackendNetwr, oCurrentSettlement);
      vBackendCost01 = this._getFirstValue(oOrder, ["ActCost01", "ACT_COST01", "Act_Cost01", "actCost01"]);
      vBackendCost02 = this._getFirstValue(oOrder, ["ActCost02", "ACT_COST02", "Act_Cost02", "actCost02"]);
      vBackendTotal = this._getFirstValue(oOrder, ["TotalAmt", "TOTAL_AMT", "Total_Amt", "totalAmt"]);
      nCost01 = vBackendCost01 === "" ? this._toNumber(oCurrentSettlement.ACT_COST01) : this._toNumber(vBackendCost01);
      nCost02 = vBackendCost02 === "" ? this._toNumber(oCurrentSettlement.ACT_COST02) : this._toNumber(vBackendCost02);
      nTotal = vBackendTotal === "" ? nNetwr + nCost01 + nCost02 : this._toNumber(vBackendTotal);

      oViewModel.setProperty("/settlement", {
        NETWR: nNetwr,
        ACT_COST01: nCost01,
        ACT_COST02: nCost02,
        TOTAL_AMT: nTotal,
        WAERS: "KRW",
        IS_BACKEND_SETTLEMENT: false
      });
    },

    _resolvePreviewNetwr: function (vBackendNetwr, oCurrentSettlement) {
      var nBackendNetwr = this._toNumber(vBackendNetwr);
      var nCurrentNetwr = this._toNumber(oCurrentSettlement && oCurrentSettlement.NETWR);

      if (vBackendNetwr === "") {
        return nCurrentNetwr;
      }

      if (nBackendNetwr === 0 && nCurrentNetwr > 0) {
        return nCurrentNetwr;
      }

      return nBackendNetwr;
    },

    _createOrderItemTemplate: function () {
      return new ColumnListItem({
        cells: [
          new Text({ text: "{Aufnr}" }),
          new Text({ text: "{Matnr}" }),
          new Text({ text: "{Maktx}" }),
          new Text({ text: "{Werks}" }),
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
      var nValue = Number(String(vValue || "").replace(/,/g, ""));
      return Number.isFinite(nValue) ? nValue : 0;
    },

    _toODataDecimal: function (vValue) {
      return String(this._toNumber(vValue));
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

      return String(nValue);
    },

    _getFirstValue: function (oSource, aNames) {
      if (!oSource) {
        return "";
      }
      for (var i = 0; i < aNames.length; i += 1) {
        if (oSource[aNames[i]] !== null && oSource[aNames[i]] !== undefined && oSource[aNames[i]] !== "") {
          return oSource[aNames[i]];
        }
      }
      return "";
    },

    _getODataErrorText: function (oError) {
      var sResponseText = oError && (oError.responseText || (oError.response && oError.response.body));
      var oResponse;
      var aDetails;
      var oDetail;
      var aXmlMessage;

      if (sResponseText) {
        try {
          oResponse = JSON.parse(sResponseText);

          if (oResponse && oResponse.error) {
            aDetails = oResponse.error.innererror && oResponse.error.innererror.errordetails;
            if (aDetails && aDetails.length) {
              oDetail = aDetails.find(function (oItem) {
                return oItem && oItem.message;
              }) || aDetails[0];

              if (oDetail && oDetail.message) {
                return oDetail.message;
              }
            }

            if (oResponse.error.message) {
              return oResponse.error.message.value || oResponse.error.message;
            }
          }
        } catch (e) {
          aXmlMessage = String(sResponseText).match(/<message[^>]*>([\s\S]*?)<\/message>/i);
          if (aXmlMessage && aXmlMessage[1]) {
            return aXmlMessage[1];
          }

          return sResponseText;
        }
      }

      if (oError && oError.message && !oError.responseText) {
        return oError.message;
      }
      if (oError && oError.responseText) {
        try {
          var oResponse = JSON.parse(oError.responseText);
          return (oResponse.error && oResponse.error.message && (oResponse.error.message.value || oResponse.error.message)) || oError.responseText;
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
        settlement: this._getInitialSettlement(),
        quality: this._getInitialQuality(),
        formEnabled: false,
        canConfirm: false
      };
    },

    _getInitialFilters: function () {
      return {
        AUFNR: "",
        MATNR: "",
        WERKS: "1000",
        AUFST: "CNF",
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

    _getInitialSettlement: function () {
      return {
        NETWR: "",
        ACT_COST01: "",
        ACT_COST02: "",
        TOTAL_AMT: "",
        WAERS: "KRW",
        IS_BACKEND_SETTLEMENT: false
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
