const cds = require('@sap/cds');
const { v4: uuidv4 } = require('uuid');

module.exports = cds.service.impl(async function () {
    const Accountingapi = await cds.connect.to('API_OPLACCTGDOCITEMCUBE_SRV');
    //const gsttaxapi = await cds.connect.to('API_OPLACCTGDOCITEMCUBE_SRV'); // Replace with your GST tax API connection
    const { ext, Accounting, Items } = this.entities;

    // Handle READ operation on the ext entity to filter based on specific criteria
    this.on('READ', 'ext', async (req) => {
        try {
            const query = req.query
                .where({ AccountingDocumentType: { in: ['RV', 'RE', 'DR', 'KR', 'DG', 'KG'] } })
                .and({ CompanyCodeCurrency: 'INR' });

            const result = await Accountingapi.run(query);

            if (!Array.isArray(result)) {
                console.error('Unexpected data format for ext entity:', result);
                return [];
            }

            return result;
        } catch (error) {
            console.error('Error fetching data from ext entity:', error);
            throw error;
        }
    });

    // Handle before READ operation on 'Accounting' entity to fetch and insert new records
    this.before('READ', 'Accounting', async (req) => {
        try {
            const query = SELECT.from(ext)
                .columns('CompanyCode', 'FiscalYear', 'FiscalPeriod', 'AccountingDocument', 'AccountingDocumentType')
                .where({ AccountingDocumentType: { in: ['RV', 'RE', 'DR', 'KR', 'DG', 'KG'] } })
                .and({ CompanyCodeCurrency: 'INR' });

            const res = await Accountingapi.run(query);

            if (!Array.isArray(res)) {
                console.error('Unexpected data format for Accounting records:', res);
                return;
            }

            const groupMap = new Map();
            res.forEach(item => {
                const groupKey = `${item.CompanyCode}-${item.FiscalYear}-${item.AccountingDocument}`;
                if (!groupMap.has(groupKey)) {
                    item.ID = uuidv4();
                    groupMap.set(groupKey, item);
                }
            });

            const groupedData = Array.from(groupMap.values());
            console.log('Grouped records:', groupedData);

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
                console.log('Inserted new records into Accounting:', newRecords);
            } else {
                console.log('No new records to insert into Accounting.');
            }
        } catch (error) {
            console.error('Error processing Accounting records:', error);
            throw error;
        }
    });

    // Handle before READ operation on 'Items' entity to fetch and insert new records
    this.before('READ', 'Items', async (req) => {
        try {
            const query = SELECT.from(ext)
                .columns('AccountingDocument', 'TaxCode', 'GLAccount')
                .where({ AccountingDocumentType: { in: ['RV', 'RE', 'DR', 'KR', 'DG', 'KG'] } })
                .and({ CompanyCodeCurrency: 'INR' });

            const sourceRecords = await Accountingapi.run(query);

            if (!Array.isArray(sourceRecords)) {
                console.error('Unexpected data format for Items records:', sourceRecords);
                return;
            }

            const recordsWithUUID = sourceRecords.map(record => ({
                ...record,
                ID: uuidv4(),
                id: record.AccountingDocument
            }));

            const existingRecords = await cds.run(
                SELECT.from(Items)
                    .columns('AccountingDocument')
                    .where({
                        AccountingDocument: { in: recordsWithUUID.map(r => r.AccountingDocument) }
                    })
            );

            const existingMap = new Map();
            existingRecords.forEach(record => {
                existingMap.set(record.AccountingDocument, record);
            });

            const newRecords = recordsWithUUID.filter(record => {
                return !existingMap.has(record.AccountingDocument);
            });

            if (newRecords.length > 0) {
                await cds.run(UPSERT.into(Items).entries(newRecords));
                console.log('Upserted records with UUIDs into Items:', newRecords);
            } else {
                console.log('No new records to upsert into Items.');
            }
        } catch (error) {
            console.error('Error processing Items records:', error);
            throw error;
        }
    });

    // Define the fetch action
    this.on('fetch', async (req) => {
        try {
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
            console.log('Grouped records for fetch action:', groupedData);

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
