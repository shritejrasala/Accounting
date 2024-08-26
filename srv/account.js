const cds = require('@sap/cds');
const { v4: uuidv4 } = require('uuid');

module.exports = cds.service.impl(async function () {
    const external = await cds.connect.to('API_OPLACCTGDOCITEMCUBE_SRV');

    let fetchStatus = {
        messages: ["Initializing..."],  
        completed: false
    };

    const docTypes = ['RV', 'DR', 'DG', 'RE', 'KR', 'KG']; // Define the document types to filter by

    // Function to handle the data fetching and upserting logic
    async function fetchAndUpsertData() {
        try {
            const { Accounting, Items, ext } = this.entities;

            // Fetch data for Accounting with filtering by AccountingDocumentType
            const qry = SELECT.from(ext)
                .columns([
                    'CompanyCode',
                    'FiscalYear',
                    'AccountingDocument',
                    'AccountingDocumentItem',
                    'AccountingDocumentType',
                    'GLAccount',
                    'TaxCode'
                ])
                .where({ AccountingDocumentType: { in: docTypes } });

            let res = await external.run(qry);
            console.log('Fetched Data:', res);

            const groupMap = new Map();
            res.forEach(item => {
                const groupKey = `${item.CompanyCode}-${item.FiscalYear}-${item.AccountingDocument}`;
                if (!groupMap.has(groupKey)) {
                    item.ID = uuidv4();
                    groupMap.set(groupKey, item);
                }
            });

            const groupedData = Array.from(groupMap.values());

            const existingRecords = await cds.run(
                SELECT.from(Accounting)
                    .columns(['CompanyCode', 'FiscalYear', 'AccountingDocument'])
                    .where({
                        CompanyCode: { in: groupedData.map(r => r.CompanyCode) },
                        FiscalYear: { in: groupedData.map(r => r.FiscalYear) },
                        AccountingDocument: { in: groupedData.map(r => r.AccountingDocument) },
                        AccountingDocumentType: { in: docTypes }
                    })
            );

            const newRecords = groupedData.filter(groupedRecord => {
                return !existingRecords.some(existingRecord =>
                    existingRecord.CompanyCode === groupedRecord.CompanyCode &&
                    existingRecord.FiscalYear === groupedRecord.FiscalYear &&
                    existingRecord.AccountingDocument === groupedRecord.AccountingDocument
                );
            });

            // Upsert Accounting data
            if (newRecords.length > 0) {
                await cds.run(UPSERT.into(Accounting).entries(newRecords));
                fetchStatus.messages.push("Data upserted successfully to Accounting");
            } else {
                fetchStatus.messages.push("No new data to upsert to Accounting.");
            }

            // Fetch data for Items with filtering by AccountingDocumentType
            const qryItems = SELECT.from(ext)
                .columns([
                    'AccountingDocumentItem',
                    'GLAccount',
                    'TaxCode',
                    'CompanyCode',
                    'AccountingDocument',
                    'FiscalYear',
                    'AmountInTransactionCurrency'
                ])
                .where({ AccountingDocumentType: { in: docTypes } });

            let sourceRecords = await external.run(qryItems);
            console.log('Fetched Data for Items:', sourceRecords);

            const recordsWithUUID = sourceRecords.map(record => ({
                ...record,
                ID: record.ID || uuidv4()
            }));

            const existingItemsRecords = await cds.run(
                SELECT.from(Items)
                    .columns(['AccountingDocumentItem', 'FiscalYear'])
                    .where({
                        AccountingDocumentItem: { in: recordsWithUUID.map(r => r.AccountingDocumentItem) },
                        FiscalYear: { in: recordsWithUUID.map(r => r.FiscalYear) }
                    })
            );

            const existingMap = new Map();
            existingItemsRecords.forEach(record => {
                const key = `${record.AccountingDocumentItem}-${record.FiscalYear}`;
                existingMap.set(key, record);
            });

            const newItemsRecords = recordsWithUUID.filter(record => {
                const key = `${record.AccountingDocumentItem}-${record.FiscalYear}`;
                return !existingMap.has(key);
            });

            // Upsert Items data
            if (newItemsRecords.length > 0) {
                await cds.run(UPSERT.into(Items).entries(newItemsRecords));
                fetchStatus.messages.push("Upserted records with UUIDs into Items");
            } else {
                fetchStatus.messages.push("No new records to upsert into Items.");
            }

            // Handle LGSTTaxItem processing with batch processing
            let lastsyncdate1 = await cds.run(
                SELECT.one.from(Accounting).columns('LastChangeDate').orderBy('LastChangeDate desc')
            );

            let counttaxdocs;
            let taxlastsyncdatetime;

            if (lastsyncdate1 && lastsyncdate1.LastChangeDate) {
                taxlastsyncdatetime = lastsyncdate1.LastChangeDate.toISOString();
                counttaxdocs = await external.send({
                    method: 'GET',
                    path: `A_OperationalAcctgDocItemCube/$count?$filter=LastChangeDate gt datetimeoffset'${taxlastsyncdatetime}'`
                });
            } else {
                counttaxdocs = await external.send({
                    method: 'GET',
                    path: 'A_OperationalAcctgDocItemCube/$count'
                });
            }

            if (counttaxdocs === 0) {
                fetchStatus.messages.push('No new tax documents to process.');
                fetchStatus.completed = true;
                return { message: 'No new tax documents to process.', batchResults: [] };
            }

            const batchSize = 5000;
            let count = 1;
            const batchResults = [];
            let newDataFetched = false;

            for (let i = 0; i < counttaxdocs; i += batchSize) {
                // Determine the upper limit of the current batch
                let upperLimit = i + batchSize;
                if (upperLimit > counttaxdocs) {
                    upperLimit = counttaxdocs;  // Adjust if the upper limit exceeds the total count
                }

                const taxdocitemsQuery = {
                    method: 'GET',
                    path: `A_OperationalAcctgDocItemCube?$skip=${i}&$top=${batchSize}`
                };

                let results = await external.send(taxdocitemsQuery);

                results = results.map(item => {
                    if (item.LastChangeDate) {
                        item.LastChangeDate = convertSAPDateToISO(item.LastChangeDate);
                    }
                    item.ID = item.ID || uuidv4();
                    return item;
                });

                results = removeDuplicateEntries(results);

                // Filter results to include only those with desired AccountingDocumentType
                results = results.filter(item => docTypes.includes(item.AccountingDocumentType));

                if (results.length > 0) {
                    newDataFetched = true;
                    fetchStatus.messages.push(`Processing Batch ${count} (${i + 1} to ${upperLimit}) of ${counttaxdocs} records`);
                    await cds.run(UPSERT.into(Accounting).entries(results));
                    batchResults.push(`Batch ${count} processed.`);
                    count += 1;
                } else {
                    fetchStatus.messages.push(`Skipping batch ${count} due to missing or duplicate IDs`);
                }

                if (i === 0 && !newDataFetched) {
                    fetchStatus.messages.push('No new records found in the first batch. Stopping further batch processing.');
                    break;
                }
            }

            if (newDataFetched) {
                fetchStatus.messages.push('All records processed successfully.');
            } else {
                fetchStatus.messages.push('No new data to process after the initial batch. All records are fetched.');
            }

            fetchStatus.completed = true;
            return { message: 'All records processed.', batchResults };
        } catch (error) {
            console.error("Error during data fetch and upsert operation:", error);
            fetchStatus.messages.push("Error during data fetch and upsert operation");
            fetchStatus.completed = true;
            throw error;
        }
    }

    // Register the ListReporter handler
    this.on('fetch', async (req) => {
        try {
            Status = { messages: ["Initializing..."], completed: false }; // Reset status
            const result = await fetchAndUpsertData.call(this);
            console.log("fetch status", Status);
            return true;
        } catch (error) {
            console.error("Error during fetch operation:", error);
            req.error(500, 'Error during data fetch and upsert operation');
        }
    });

    // Register the StatusReporter handler
    this.on('Status', async (req) => {
        console.log(fetchStatus);
        return fetchStatus;
    });
});

function convertSAPDateToISO(dateString) {
    const timestamp = parseInt(dateString.match(/\d+/)[0], 10);
    return new Date(timestamp).toISOString();
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