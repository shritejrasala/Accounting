const cds = require('@sap/cds');
const { v4: uuidv4 } = require('uuid');

module.exports = cds.service.impl(async function() {
    const Accountingapi = await cds.connect.to('API_OPLACCTGDOCITEMCUBE_SRV');
    const { ext, Accounting, Items } = this.entities;

    // Handle READ operation on the correct entity set
    this.on('READ', 'ext', async req => {
        try {
            const query = req.query
                .where({ AccountingDocumentType: { in: ['RV', 'RE', 'DR', 'KR', 'DG', 'KG'] } })
                .and({ CompanyCodeCurrency: 'INR' });

            const result = await Accountingapi.run(query);
            return result;
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
    });

    // Handle before READ operation on 'Accounting' entity
    this.before('READ', 'Accounting', async (req) => {
        try {
            const query = SELECT.from(ext) // Use correct entity name
                .columns('CompanyCode', 'FiscalYear', 'FiscalPeriod', 'AccountingDocument', 'AccountingDocumentType')
                .where({ AccountingDocumentType: { in: ['RV', 'RE', 'DR', 'KR', 'DG', 'KG'] } })
                .and({ CompanyCodeCurrency: 'INR' });

            const res = await Accountingapi.run(query);

            // Group records by CompanyCode, FiscalYear, and AccountingDocument
            const groupMap = new Map();
            res.forEach(item => {
                const groupKey = `${item.CompanyCode}-${item.FiscalYear}-${item.AccountingDocument}`;
                if (!groupMap.has(groupKey)) {
                    item.ID = uuidv4();
                    groupMap.set(groupKey, item);  // Store only one record per group
                }
            });

            const groupedData = [];
            groupMap.forEach(group => groupedData.push(group));
            console.log('Grouped records:', groupedData);

            // Perform a bulk UPSERT using a single operation
            const existingRecords = await cds.run(
                SELECT.from(Accounting)
                    .columns('CompanyCode', 'FiscalYear', 'AccountingDocument')
                    .where({
                        CompanyCode: { in: groupedData.map(r => r.CompanyCode) },
                        FiscalYear: { in: groupedData.map(r => r.FiscalYear) },
                        AccountingDocument: { in: groupedData.map(r => r.AccountingDocument) }
                    })
            );

            // Filter out the already existing records
            const newRecords = groupedData.filter(groupedRecord => {
                return !existingRecords.some(existingRecord =>
                    existingRecord.CompanyCode === groupedRecord.CompanyCode &&
                    existingRecord.FiscalYear === groupedRecord.FiscalYear &&
                    existingRecord.AccountingDocument === groupedRecord.AccountingDocument
                );
            });

            if (newRecords.length > 0) {
                await cds.run(UPSERT.into(Accounting).entries(newRecords));
                console.log('Inserted new records:', newRecords);
            } else {
                console.log('No new records to insert.');
            }
        } catch (error) {
            console.error('Error processing Accounting records:', error);
            throw error;
        }
    });

    // Handle before READ operation on 'Items' entity
    this.before('READ', 'Items', async (req) => {
        try {
            // Fetch records from the external API
            const query = SELECT.from(ext) // Use correct entity name
                .columns('AccountingDocument', 'TaxCode', 'GLAccount')
                .where({ AccountingDocumentType: { in: ['RV', 'RE', 'DR', 'KR', 'DG', 'KG'] } })
                .and({ CompanyCodeCurrency: 'INR' });

            const sourceRecords = await Accountingapi.run(query);
            console.log('Fetched records:', sourceRecords);

            // Add UUID to each record and set ID for association
            const recordsWithUUID = sourceRecords.map(record => ({
                ...record,
                ID: uuidv4(), // Generate UUID for each record
                id: record.AccountingDocument // Set association with Accounting (if the association field is 'id')
            }));

            // Fetch existing records from the Items table
            const existingRecords = await cds.run(
                SELECT.from(Items)
                    .columns('AccountingDocument')
                    .where({
                        AccountingDocument: { in: recordsWithUUID.map(r => r.AccountingDocument) }
                    })
            );

            // Convert existing records to a map for fast lookup
            const existingMap = new Map();
            existingRecords.forEach(record => {
                existingMap.set(record.AccountingDocument, record);
            });

            // Filter out records that already exist in the table
            const newRecords = recordsWithUUID.filter(record => {
                return !existingMap.has(record.AccountingDocument);
            });

            if (newRecords.length > 0) {
                // Perform the UPSERT operation
                await cds.run(UPSERT.into(Items).entries(newRecords));
                console.log('Upserted records with UUIDs:', newRecords);
            } else {
                console.log('No new records to upsert.');
            }
        } catch (error) {
            console.error('Error processing Items records:', error);
            throw error;
        }
    });
});
