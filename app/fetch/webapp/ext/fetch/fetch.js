sap.ui.define([
    "sap/m/MessageBox",
    "sap/ui/core/library",
    'sap/ui/core/BusyIndicator',
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/Text",
    "sap/m/Button"
], function (MessageBox, coreLibrary, BusyIndicator, MessageToast, Dialog, Text, Button) {
    "use strict";
    
    return {
        fetch: function (oBindingContext, aSelectedContexts) {
            const batchSize = 5000; // Number of records per batch
            let processedRecords = 0;
            let totalRecords = 0; // Initialize total records to zero

            // Create and open the dialog
            let oDialog = new Dialog({
                title: "Fetching Records",
                content: [
                    new Text({ id: "progressText", text: `Fetching: 0/0` })
                ],
                beginButton: new Button({
                    text: "Close",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });
            oDialog.open();
            
            function fetchBatch(skip) {
                // Make AJAX call to fetch the batch
                $.ajax({
                    url: "/odata/v4/accountsrv/fetch", // Ensure this URL is correct
                    type: "POST",
                    contentType: "application/json",
                    data: JSON.stringify({
                        context: oBindingContext,
                        selectedContexts: aSelectedContexts,
                        $skip: skip,
                        $top: batchSize
                    }),
                    success: function (data) {
                        const fetchedCount = data.value.records ? data.value.records.length : 0;
                        if (totalRecords === 0 && data.value.totalRecords) {
                            totalRecords = data.value.totalRecords;
                        }
                        processedRecords += fetchedCount;
                        
                        // Update the progress text in the dialog
                        sap.ui.getCore().byId("progressText").setText(`Fetching: ${processedRecords}/${totalRecords}`);

                        if (fetchedCount >= batchSize && processedRecords < totalRecords) {
                            // Fetch the next batch
                            fetchBatch(processedRecords);
                        } else {
                            // All records processed
                            MessageToast.show("All records have been processed.");
                            oDialog.close();
                        }
                    },
                    error: function (xhr, status, error) {
                        console.error("Error executing action:", error);
                        MessageBox.error("Failed to execute action.");
                        oDialog.close();
                    },
                    complete: function () {
                        BusyIndicator.hide();
                    }
                });
            }

            // Start fetching records with the first batch
            BusyIndicator.show(0);
            fetchBatch(0);
        }
    };
});
