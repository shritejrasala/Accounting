sap.ui.require(
    [
        'sap/fe/test/JourneyRunner',
        'fetch/test/integration/FirstJourney',
		'fetch/test/integration/pages/AccountingList',
		'fetch/test/integration/pages/AccountingObjectPage',
		'fetch/test/integration/pages/ItemsObjectPage'
    ],
    function(JourneyRunner, opaJourney, AccountingList, AccountingObjectPage, ItemsObjectPage) {
        'use strict';
        var JourneyRunner = new JourneyRunner({
            // start index.html in web folder
            launchUrl: sap.ui.require.toUrl('fetch') + '/index.html'
        });

       
        JourneyRunner.run(
            {
                pages: { 
					onTheAccountingList: AccountingList,
					onTheAccountingObjectPage: AccountingObjectPage,
					onTheItemsObjectPage: ItemsObjectPage
                }
            },
            opaJourney.run
        );
    }
);