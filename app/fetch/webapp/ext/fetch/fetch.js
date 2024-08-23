sap.ui.define([
    "sap/m/MessageBox",
    "sap/ui/core/library",
    'sap/ui/core/BusyIndicator',
    "sap/m/MessageToast"
],
function (MessageBox, coreLibrary, BusyIndicator, MessageToast) {
    "use strict";
    return {
        fetch: function (oBindingContext, aSelectedContexts) {
            // Show a message or busy indicator before the AJAX call
            BusyIndicator.show(0);
            
            $.ajax({
                url: "/odata/v4/accountsrv/fetch", // Update with the correct URL
                type: "POST", // Use GET or POST depending on the action
                contentType: "application/json", // Ensure correct content type
                data: JSON.stringify({
                    // Include any data needed for the request
                    context: oBindingContext,
                    selectedContexts: aSelectedContexts
                }),
                success: function (result) {
                    // Handle successful response
                    console.log("Action executed successfully.", result);
                    MessageToast.show("Action executed successfully.");
                },
                error: function (xhr, status, error) {
                    // Handle errors
                    console.error("Error executing action:", error);
                    MessageBox.error("Failed to execute action.");
                },
                complete: function () {
                    // Hide the busy indicator after the AJAX call
                    BusyIndicator.hide();
                }
            });
        }
    };
});
