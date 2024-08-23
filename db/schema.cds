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

    // Association to Accounting
    //Accounting: Association to Accounting;

    @title: 'AccountingDocument'
    AccountingDocument : String(50);

    @title: 'GLAccount'
    GLAccount : String(50);

    @title: 'TaxCode'
    TaxCode : String(50);

}
