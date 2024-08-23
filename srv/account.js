const cds = require('@sap/cds');
const { v4: uuidv4 } = require('uuid');

module.exports = cds.service.impl(async function () {
    // Define the fetch action
    this.on('fetch', async (req) => {
        try {
            const Accountingapi = await cds.connect.to('API_OPLACCTGDOCITEMCUBE_SRV');
            const { ext, Accounting, Items } = this.entities;

            // Fetch data from the external service
            const query = SELECT.from(ext)
                .columns('CompanyCode', 'FiscalYear', 'FiscalPeriod', 'AccountingDocument', 'AccountingDocumentType', 'TaxCode', 'GLAccount')
                .where({ AccountingDocumentType: { in: ['RV', 'RE', 'DR', 'KR', 'DG', 'KG'] } })
                .and({ CompanyCodeCurrency: 'INR' });

            const res = await Accountingapi.run(query);

            if (!Array.isArray(res)) {
                console.error('Unexpected data format for fetch action:', res);
                return { message: 'No records found.' };
            }

            // Process Accounting records
            const groupMap = new Map();
            res.forEach(item => {
                const groupKey = `${item.CompanyCode}-${item.FiscalYear}-${item.AccountingDocument}`;
                if (!groupMap.has(groupKey)) {
                    item.ID = uuidv4();
                    groupMap.set(groupKey, item);
                }
            });

            const groupedData = Array.from(groupMap.values());
            //console.log('Grouped records for fetch action:', groupedData);

            // Insert or update Accounting records
            const existingRecords = await cds.run(
                SELECT.from(Accounting)
                    .columns('CompanyCode', 'FiscalYear', 'AccountingDocument')
                    .where({
                        CompanyCode: { in: groupedData.map(r => r.CompanyCode) },
                        FiscalYear: { in: groupedData.map(r => r.FiscalYear) },
                        AccountingDocument: { in: groupedData.map(r => r.AccountingDocument) }
                    })
            );

            const newRecords = groupedData.filter(groupedRecord => {
                return !existingRecords.some(existingRecord =>
                    existingRecord.CompanyCode === groupedRecord.CompanyCode &&
                    existingRecord.FiscalYear === groupedRecord.FiscalYear &&
                    existingRecord.AccountingDocument === groupedRecord.AccountingDocument
                );
            });

            if (newRecords.length > 0) {
                await cds.run(UPSERT.into(Accounting).entries(newRecords));
                console.log('Inserted new records into Accounting via fetch action:', newRecords);
            } else {
                console.log('No new records to insert into Accounting via fetch action.');
            }

            // Process Items records
            const recordsWithUUID = res.map(record => ({
                ...record,
                ID: uuidv4(),
                id: record.AccountingDocument
            }));

            const existingItemsRecords = await cds.run(
                SELECT.from(Items)
                    .columns('AccountingDocument')
                    .where({
                        AccountingDocument: { in: recordsWithUUID.map(r => r.AccountingDocument) }
                    })
            );

            const existingItemsMap = new Map();
            existingItemsRecords.forEach(record => {
                existingItemsMap.set(record.AccountingDocument, record);
            });

            const newItemsRecords = recordsWithUUID.filter(record => {
                return !existingItemsMap.has(record.AccountingDocument);
            });

            if (newItemsRecords.length > 0) {
                await cds.run(UPSERT.into(Items).entries(newItemsRecords));
                console.log('Upserted records with UUIDs into Items via fetch action:', newItemsRecords);
            } else {
                console.log('No new records to upsert into Items via fetch action.');
            }

            // Handle LGSTTaxItem processing
            let lastsyncdate1 = await cds.run(
                SELECT.one.from(Accounting).columns('LastChangeDate').orderBy('LastChangeDate desc')
            );

            let counttaxdocs;

            if (lastsyncdate1 && lastsyncdate1.LastChangeDate) {
                const taxlastsyncdatetime = lastsyncdate1.LastChangeDate.toISOString();
                counttaxdocs = await Accountingapi.send({
                    method: 'GET',
                    path: `A_OperationalAcctgDocItemCube/$count?$filter=LastChangeDate gt datetimeoffset'${taxlastsyncdatetime}'`
                });
            } else {
                counttaxdocs = await Accountingapi.send({
                    method: 'GET',
                    path: 'A_OperationalAcctgDocItemCube/$count'
                });
            }
            function convertSAPDateToISO(dateString) {
                const timestamp = parseInt(dateString.match(/\d+/)[0], 10); // Extract the timestamp
                return new Date(timestamp).toISOString(); // Convert to ISO string
            }
            
            function removeDuplicateEntries(results) {
                const uniqueResults = [];
                const seenIds = new Set();
            
                for (const item of results) {
                    if (!seenIds.has(item.ID)) {
                        uniqueResults.push(item);
                        seenIds.add(item.ID);
                    }
                }
            
                return uniqueResults;
            }
            
            for (let i = 0; i < counttaxdocs; i += 5000) {
                const taxdocitemsQuery = {
                    method: 'GET',
                    path: `A_OperationalAcctgDocItemCube?$skip=${i}&$top=5000`
                };
            
                let results = await Accountingapi.send(taxdocitemsQuery);
            
                results = results.map(item => {
                    // Ensure LastChangeDate is in ISO format
                    if (item.LastChangeDate) {
                        item.LastChangeDate = convertSAPDateToISO(item.LastChangeDate);
                    }
            
                    // Ensure ID is not null
                    if (!item.ID) {
                        item.ID = generateUniqueID(item); // Optionally generate a unique ID if missing
                    }
            
                    return item;
                });
            
                // Remove duplicate entries
                results = removeDuplicateEntries(results);
            
                if (results.length > 0) { // Only attempt UPSERT if there are valid records
                    console.log("In Batch ", i, " of ", counttaxdocs, " records");
                    await cds.run(UPSERT.into(Accounting).entries(results));
                } else {
                    console.log("Skipping Batch ", i, " due to missing or duplicate IDs");
                }
            }
            
            function generateUniqueID(item) {
                return `${item.CompanyCode}-${item.FiscalYear}-${item.AccountingDocument}-${item.FiscalPeriod}`;
            }

            console.log('Count of new tax documents:', counttaxdocs);

            // Fetch and process GST tax items if needed
            // ...

            return { message: 'Fetch action completed successfully.' };
        } catch (error) {
            console.error('Error in fetch action:', error);
            throw error;
        }
    });

});