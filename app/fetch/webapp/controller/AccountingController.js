sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast"
], function (Controller, Fragment, MessageToast) {
    "use strict";

    return Controller.extend("com.teju.cloudapps.controller.AccountingController", {
        onInit: function () {
            // Initialization if needed
        },

        onOpenDialog: function () {
            var oView = this.getView();

            // Create and open dialog if it does not exist
            if (!this._oDialog) {
                this._oDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.teju.cloudapps.view.AccountingView",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._oDialog.then(function (oDialog) {
                oDialog.open();
                // Fetch records after the dialog opens
                this._fetchAccountingRecords();
            }.bind(this));
        },

        _fetchAccountingRecords: function () {
            var oModel = this.getView().getModel();

            // Call your backend service to fetch records
            oModel.read("/Accounting", {
                success: function (oData) {
                    var oDialog = this.byId("accountingDialog");
                    oDialog.setModel(new sap.ui.model.json.JSONModel(oData), "accountingRecords");
                }.bind(this),
                error: function () {
                    MessageToast.show("Failed to fetch records.");
                }
            });
        },

        onDialogClose: function () {
            this.byId("accountingDialog").close();
        }
    });
});
