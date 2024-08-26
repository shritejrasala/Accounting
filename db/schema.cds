namespace com.teju.cloudapps;

using { cuid, managed } from '@sap/cds/common';

// Define the Accounting entity
entity Accounting : cuid, managed {
    key ID : UUID;

    @title: 'CompanyCode'
    CompanyCode : String(20);

    @title: 'FiscalYear'
    FiscalYear : String(4);

    @title: 'FiscalPeriod'
    FiscalPeriod : String(3);

    @title: 'AccountingDocument'
    AccountingDocument : String(15);

    @title: 'AccountingDocumentType'
    AccountingDocumentType : String(15);
   
    @title: 'Lastchange'
    LastChangeDate: DateTime;
    

    // Define the composition relationship with Items
    Items : Composition of many Items on Items.AccountingDocument = $self.AccountingDocument;
}


// Define the Items entity
entity Items : cuid, managed {
    key ID : UUID;
    @title : 'CompanyCode'
    CompanyCode: String(10);
    @title: 'FiscalYear'
    FiscalYear: String(4);
    @title: 'AccountingDocument'
    AccountingDocument: String(10);
    @title: 'Accounting Document Item'
    AccountingDocumentItem: String(4);
    @title: 'GL Account'
    GLAccount: String(10);
    @title: 'Tax Code'
    TaxCode: String(5);
    @title: 'GST Amount in INR'
    AmountInTransactionCurrency : Decimal(15,2);

}