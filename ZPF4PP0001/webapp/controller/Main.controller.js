sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], (Controller, Filter, FilterOperator, JSONModel, MessageBox, MessageToast) => {
    "use strict";

    return Controller.extend("zpf4pp0001.controller.Main", {
        onInit() {
            this.getView().setModel(new JSONModel({
                selected: {},
                input: this._getEmptyInput()
            }), "view");
        },

        onSearch: function () {
            const sAufnr = this.byId("filterAufnr").getValue().trim();
            const sMatnr = this.byId("filterMatnr").getValue().trim();
            const sWerks = "1000";
            const oErdat = this.byId("filterErdat").getDateValue();
            const aFilters = [
                new Filter("Aufst", FilterOperator.EQ, "REL")
            ];
            if (sAufnr) {
                aFilters.push(new Filter("Aufnr", FilterOperator.Contains, sAufnr));
            }
            if (sMatnr) {
                aFilters.push(new Filter("Matnr", FilterOperator.Contains, sMatnr));
            }
            if (sWerks) {
                aFilters.push(new Filter("Werks", FilterOperator.EQ, sWerks));
            }
            if (oErdat) {
                aFilters.push(new Filter("Erdat", FilterOperator.EQ, oErdat));
            }

            const oBinding = this.byId("HeaderTable").getBinding("items");

            if (oBinding) {
                oBinding.filter(aFilters);
            }
        },

        onResetFilters() {
            this.byId("filterAufnr").setValue("");
            this.byId("filterMatnr").setValue("");
            this.byId("filterErdat").setValue("");
            this.byId("filterErdat").setDateValue(null);

            this.onSearch();
        },

        onScrollToTop: function () {
            const oPage = this.byId("dynamicPage");

            if (!oPage) {
                return;
            }

            oPage.setHeaderExpanded(true);

            setTimeout(() => {
                const oScrollDelegate = oPage.getScrollDelegate();

                if (oScrollDelegate) {
                    oScrollDelegate.scrollTo(0, 0, 500);
                }
            }, 0);
        },

        onPressEvent(oEvent) {
            const oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                return;
            }

            const oModel = this.getView().getModel();
            const oViewModel = this.getView().getModel("view");
            const oTable = this.byId("HeaderTable");
            const oKeyProperties = this._getKeyProperties(
                oModel,
                oContext,
                "esProdOrderSet"
            );
            const sOrderPath = oModel.createKey("esProdOrderSet", oKeyProperties);

            oTable.setBusy(true);

            oModel.read(`/${sOrderPath}`, {
                success: (oOrder) => {
                    oTable.setBusy(false);
                    oViewModel.setProperty("/selected", Object.assign({}, oOrder));
                    oViewModel.setProperty("/input", this._getEmptyInput(oOrder));
                    this.byId("executionDialog").open();
                },
                error: (oError) => {
                    oTable.setBusy(false);
                    MessageBox.error(this._getErrorMessage(oError));
                }
            });
        },

        onScrapQtyChange(oEvent) {
            const oViewModel = this.getView().getModel("view");
            const fPlanQty = Number(oViewModel.getProperty("/selected/Gamng") || 0);
            const fScrapQty = Number(oEvent.getParameter("value") || 0);

            if (fScrapQty >= 0 && fScrapQty <= fPlanQty) {
                oViewModel.setProperty("/input/ScrapQty", fScrapQty);
                oViewModel.setProperty("/input/YieldQty", fPlanQty - fScrapQty);
            }
        },

        onCloseExecution() {
            this.byId("executionDialog").close();
        },

        onSaveExecution() {
            const oViewModel = this.getView().getModel("view");
            const oOrder = oViewModel.getProperty("/selected");
            const oInput = oViewModel.getProperty("/input");
            const fYieldQty = Number(oInput.YieldQty || 0);
            const fScrapQty = Number(oInput.ScrapQty || 0);
            const fWorkTime = Number(oInput.WorkTime || 0);
            const fPlanQty = Number(oOrder.Gamng || 0);

            if (fYieldQty <= 0) {
                MessageBox.error("양품 수량은 0보다 커야 합니다.");
                return;
            }
            if (fScrapQty < 0) {
                MessageBox.error("불량 수량은 0 이상이어야 합니다.");
                return;
            }
            if (fYieldQty + fScrapQty > fPlanQty) {
                MessageBox.error("실적 수량 합계가 계획 수량을 초과합니다.");
                return;
            }
            if (fWorkTime <= 0) {
                MessageBox.error("실제 작업 시간을 입력하세요.");
                return;
            }
            if (!oInput.Vcode) {
                MessageBox.error("검사 결과를 선택하세요.");
                return;
            }

            if (fYieldQty + fScrapQty < fPlanQty) {
                MessageBox.warning(
                    "계획 수량 대비 실적이 미달입니다. 계속 진행하시겠습니까?",
                    {
                        actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                        emphasizedAction: MessageBox.Action.OK,
                        onClose: (sAction) => {
                            if (sAction === MessageBox.Action.OK) {
                                this._confirmAndSave(oOrder, oInput);
                            }
                        }
                    }
                );
                return;
            }

            this._confirmAndSave(oOrder, oInput);
        },

        _confirmAndSave(oOrder, oInput) {
            const sSummary = [
                `생산오더: ${oOrder.Aufnr}`,
                `양품: ${oInput.YieldQty} ${oOrder.Meins}`,
                `불량: ${oInput.ScrapQty || 0} ${oOrder.Meins}`,
                `작업시간: ${oInput.WorkTime} H`,
                `검사결과: ${oInput.Vcode === "ACC" ? "합격" : "불합격"}`
            ].join("\n");

            MessageBox.confirm(sSummary, {
                title: "생산실행 저장 확인",
                emphasizedAction: MessageBox.Action.OK,
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        this._saveExecution(oOrder, oInput);
                    }
                }
            });
        },

        _saveExecution(oOrder, oInput) {
            const oModel = this.getView().getModel();
            const oDialog = this.byId("executionDialog");

            oDialog.setBusy(true);

            oModel.create("/esProdResultSet", {
                    Aufnr: oOrder.Aufnr,
                    YieldQty: String(oInput.YieldQty),
                    ScrapQty: String(oInput.ScrapQty || 0),
                    Vcode: oInput.Vcode
                }, {
                success: (oData) => {
                    oDialog.setBusy(false);
                    oDialog.close();
                    MessageToast.show(
                        `생산오더 ${oOrder.Aufnr} 실행이 정상적으로 완료되었습니다.`
                    );
                    const oTableBinding = this.byId("HeaderTable").getBinding("items");

                    this.getView().getModel("view").setProperty("/selected", {});
                    this.getView().getModel("view").setProperty(
                        "/input",
                        this._getEmptyInput()
                    );

                    this.onScrollToTop();

                    if (oTableBinding) {
                        oTableBinding.attachEventOnce("dataReceived", () => {
                            this.onScrollToTop();
                        });
                        oTableBinding.refresh(true);
                    }
                },
                error: (oError) => {
                    oDialog.setBusy(false);
                    MessageBox.error(this._getErrorMessage(oError));
                }
            });
        },

        _getEmptyInput(oOrder = {}) {
            return {
                YieldQty: Number(oOrder.Gamng || 0),
                ScrapQty: 0,
                SampleQty: Math.ceil(Number(oOrder.Gamng || 0) * 5 / 1000),
                WorkTime: this._getNumericProperty(oOrder, [
                    "WorkTime",
                    "Worktime",
                    "WORK_TIME"
                ]),
                Vcode: ""
            };
        },

        _getNumericProperty(oData, aPropertyNames) {
            const sPropertyName = aPropertyNames.find((sName) =>
                Object.prototype.hasOwnProperty.call(oData, sName)
            );

            return sPropertyName ? Number(oData[sPropertyName]) : "";
        },

        _getKeyProperties(oModel, oContext, sEntitySetName) {
            const oMetaModel = oModel.getMetaModel();
            const oEntitySet = oMetaModel.getODataEntitySet(sEntitySetName);
            const oEntityType = oMetaModel.getODataEntityType(oEntitySet.entityType);

            return oEntityType.key.propertyRef.reduce((oKeys, oKey) => {
                oKeys[oKey.name] = oContext.getProperty(oKey.name);
                return oKeys;
            }, {});
        },

        _getErrorMessage(oError) {
            const sResponseText = oError.responseText || oError.response?.body || "";

            try {
                const oResponse = JSON.parse(sResponseText);
                const oGatewayError = oResponse.error || {};
                const aDetails = oGatewayError.innererror?.errordetails || [];
                const sMainMessage = oGatewayError.message?.value;
                const oDetail = aDetails.find((oItem) =>
                    oItem.message && oItem.message !== sMainMessage
                );

                return oDetail?.message ||
                    sMainMessage ||
                    "Gateway 처리 중 오류가 발생했습니다.";
            } catch (oParseError) {
                if (sResponseText) {
                    const oXml = new DOMParser().parseFromString(
                        sResponseText,
                        "application/xml"
                    );
                    const oMessage = oXml.getElementsByTagName("message")[0];

                    if (oMessage?.textContent) {
                        return oMessage.textContent.trim();
                    }
                }

                return oError.message ||
                    oError.statusText ||
                    "생산실행 저장 중 오류가 발생했습니다.";
            }
        }
    });
});
