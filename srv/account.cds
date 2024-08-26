using { com.teju.cloudapps as db } from '../db/schema';
using { API_OPLACCTGDOCITEMCUBE_SRV as external } from './external/API_OPLACCTGDOCITEMCUBE_SRV';

service accountsrv {
  // Define the external service projection
  entity Accounting as projection on db.Accounting;
  entity Items as projection on db.Items;
  action fetch () returns String;
  action Status() returns String;
  // Projection on the external service entity
  entity ext as projection on external.A_OperationalAcctgDocItemCube
  {
    CompanyCode,
    FiscalYear,
    FiscalPeriod,
    AccountingDocument,
    AccountingDocumentItem,
    AccountingDocumentType,
    TaxCode,
    GLAccount,
    LastChangeDate
  }
}

// Enable draft support for the Accounting entity
annotate accountsrv.Accounting @odata.draft.enabled;

// Annotate the Accounting entity for UI representation
annotate accountsrv.Accounting with @(
  UI.LineItem: [
    { Label: 'Company Code', Value: CompanyCode },
    { Label: 'Fiscal Year', Value: FiscalYear },
    { Label: 'Fiscal Period', Value: FiscalPeriod },
    { Label: 'Accounting Document', Value: AccountingDocument },
    { Label: 'Document Type', Value: AccountingDocumentType }
  ],
  UI.FieldGroup #account: {
    $Type: 'UI.FieldGroupType',
    Data: [
      { Label: 'Company Code', Value: CompanyCode },
      { Label: 'Fiscal Year', Value: FiscalYear },
      { Label: 'Fiscal Period', Value: FiscalPeriod },
      { Label: 'Accounting Document', Value: AccountingDocument },
      { Label: 'Document Type', Value: AccountingDocumentType }
    ]
  },
  UI.Facets: [
    {
      $Type: 'UI.ReferenceFacet',
      ID: 'doc_facet',
      Label: 'Document',
      Target: '@UI.FieldGroup#account'
    },
    {
      $Type: 'UI.ReferenceFacet',
      ID: 'doc_items_facet',
      Label: 'Document Items',
      Target: 'Items/@UI.LineItem'
    }
  ]
);

// Annotate the Items entity for UI representation
annotate accountsrv.Items with @(
  UI.LineItem: [
            { Label: 'Company Code', Value: CompanyCode },
            { Label: 'Fiscal Year', Value: FiscalYear },
            { Label: 'Accounting Document', Value: AccountingDocument },
            { Label: 'Accounting Document Item', Value: AccountingDocumentItem },
            { Label: 'GL Account', Value: GLAccount },
            { Label: 'Tax Code', Value: TaxCode },
            { Label: 'GST Amount in INR', Value: AmountInTransactionCurrency }
    ],
    UI.FieldGroup #Items : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { Label: 'Company Code', Value: CompanyCode },
            { Label: 'Fiscal Year', Value: FiscalYear },
            { Label: 'Accounting Document', Value: AccountingDocument },
            { Label: 'Accounting Document Item', Value: AccountingDocumentItem },
            { Label: 'GL Account', Value: GLAccount },
            { Label: 'Tax Code', Value: TaxCode },
            { Label: 'GST Amount in INR', Value: AmountInTransactionCurrency }
        ]
    },
  UI.Facets: [
    {
      $Type: 'UI.ReferenceFacet',
      ID: 'doc_items_facet',
      Label: 'Document Items',
      Target: '@UI.FieldGroup#Items'
    }
  ]
);