//const { indexof } = require('@cap-js/postgres/lib/func');
const cds = require('@sap/cds');
const { v4: uuidv4 } = require('uuid');


module.exports = cds.service.impl(async function(){
    const Accountingapi = await cds.connect.to('API_OPLACCTGDOCITEMCUBE_SRV');
    const {ext,Accounting,Items}=this.entities
    this.on('READ','ext', async req => {
        
        const query = req.query
        .where({ AccountingDocumentType: { in: ['RV', 'RE', 'DR', 'KR', 'DG', 'KG'] } })
        .and({ CompanyCodeCurrency: 'INR' });
    
    const result = await Accountingapi.run(query);
    
    return result;
    });
    this.before('READ', 'Accounting', async (req) => {
        const query = SELECT.from(ext)
            .columns('CompanyCode', 'FiscalYear', 'FiscalPeriod', 'AccountingDocument', 'AccountingDocumentType')
            .where({ AccountingDocumentType: { in: ['RV', 'RE', 'DR', 'KR', 'DG', 'KG'] } })
            .and({ CompanyCodeCurrency: 'INR' });
    
        const res = await Accountingapi.run(query);
        //console.log('Fetched records:', res);
    
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
            //console.log('Inserted new records:', newRecords);
        } else {
            //console.log('No new records to insert.');
        }
    }); 

    })