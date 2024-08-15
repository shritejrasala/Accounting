//const { indexof } = require('@cap-js/postgres/lib/func');
const cds = require('@sap/cds');

module.exports = cds.service.impl(async function(){
    const Accountingapi = await cds.connect.to('API_OPLACCTGDOCITEMCUBE_SRV');

    this.on('READ','ext', async req => {
        
       
        //console.log(res);
        return await Accountingapi.run(req.query);
    });

    })