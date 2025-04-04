const express = require("express");
const router = express.Router();
const userController = require('../controllers/user');

const multer = require("multer");

router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).json({ success: false, message: "Logout failed" });
    }

    // Clear session cookie
    res.clearCookie("connect.sid", { path: "/" });

    // Redirect to login page
    res.redirect("/");
  });
});
router.post('/registration', userController.registration);
router.post('/login', userController.login);
router.post('/company', userController.company);
router.post('/accountconfiguration', userController.accountconfiguration);
router.get('/user', userController.user);
router.get("/customer", userController.customer);
router.post("/customer", userController.customeradd);
router.put("/customeredit/:id", userController.customeredit);
router.delete("/customerdelete/:id", userController.customerdelete);
router.get("/manufacturer", userController.manufacturer);
router.post("/manufacturer", userController.manufactureradd);
router.put("/manufactureredit/:id", userController.manufactureredit);
router.delete("/manufacturerdelete/:id", userController.manufacturerdelete);
router.get("/customerdisc", userController.customerdisc);
router.post("/customerdisc", userController.customerdiscadd);
router.put("/customerdiscedit/:id", userController.customerdiscedit);
router.delete("/customerdiscdelete/:id", userController.customerdiscdelete);
router.get("/product", userController.product);
router.get("/product/getproduct", userController.getproduct);
router.post("/product", userController.productadd);
router.put("/productedit/:id", userController.productedit);
router.delete("/productdelete/:id", userController.productdelete);
router.get("/producttype", userController.producttype);
router.get("/productcategory/category", userController.getcategory);
router.get("/uom/getuom", userController.getuom);
router.get("/drugtype", userController.drugtype);
router.get("/drugtype/getdrugtype", userController.getdrugtype);
router.post("/drugtype", userController.drugtypeadd);
router.put("/drugtypeedit/:id", userController.drugtypeedit);
router.delete("/drugtypedelete/:id", userController.drugtypedelete);
router.get("/producttype/type", userController.gettype);
router.post("/producttype", userController.producttypeadd);    
router.put("/producttypeedit/:id", userController.producttypeedit);
router.delete("/producttypedelete/:id", userController.producttypedelete);
router.get("/productcategory", userController.productcategory);
router.post("/productcategory", userController.productcategoryadd);
router.put("/productcategoryedit/:id", userController.productcategoryedit);
router.delete("/productcategorydelete/:id", userController.productcategorydelete);
router.get("/uom", userController.uom);
router.post("/uom", userController.uomadd);
router.put("/uomedit/:id", userController.uomedit);
router.delete("/uomdelete/:id", userController.uomdelete);
router.get("/stockob", userController.stockob);
router.post("/stockob", userController.stockobadd);
router.put("/stockobedit/:id", userController.stockobedit);
router.delete("/stockobdelete/:id", userController.stockobdelete);
router.get("/salesman", userController.salesman);
router.post("/salesman", userController.salesmanadd);
router.put("/salesmanedit/:id", userController.salesmanedit);
router.delete("/salesmandelete/:id", userController.salesmandelete);
router.get("/supplier", userController.supplier);
router.post("/supplier", userController.supplieradd);
router.put("/supplieredit/:id", userController.supplieredit);
router.delete("/supplierdelete/:id", userController.supplierdelete);
router.get("/ledger", userController.ledger);
router.post("/ledger", userController.ledgeradd);
router.put("/ledgeredit/:id", userController.ledgeredit);
router.delete("/ledgerdelete/:id", userController.ledgerdelete);
router.get("/subgroup", userController.subgroup);
router.post("/subgroup", userController.subgroupadd);
router.put("/subgroupedit/:id", userController.subgroupedit);
router.delete("/subgroupdelete/:id", userController.subgroupdelete);
router.get("/multireceiptselect/:id", userController.multireceiptselect);
router.get("/multipaymentselect/:id", userController.multipaymentselect);
router.get("/multireceipt", userController.multireceipt);
router.post("/multireceipt", userController.multireceiptadd);
router.put("/multireceiptedit/:id", userController.multireceiptedit);
router.delete("/multireceiptdelete/:id", userController.multireceiptdelete);
router.delete("/multireceipttransdelete/:transId", userController.multireceipttransdelete);
router.delete("/multipaymenttransdelete/:transId", userController.multipaymenttransdelete);
router.get("/multireceipt/dr", userController.getDr);
router.get("/multireceipt/cr", userController.getCr);
router.get("/multipayment", userController.multipayment);
router.post("/multipayment", userController.multipaymentadd);
router.put("/multipaymentedit/:id", userController.multipaymentedit);
router.delete("/multipaymentdelete/:id", userController.multipaymentdelete);
router.get("/multipayment/dr", userController.getPaymentDr);
router.get("/multipayment/cr", userController.getPaymentCr);
router.get("/receipt", userController.receipt);
router.post("/receipt", userController.receiptadd);
router.put("/receiptedit/:id", userController.receiptedit);
router.delete("/receiptdelete/:id", userController.receiptdelete);
router.get("/recipt/dr", userController.receiptDr);
router.get("/recipt/cr", userController.receiptCr);
router.get("/payment", userController.payment);
router.post("/payment", userController.paymentadd);
router.put("/paymentedit/:id", userController.paymentedit);
router.delete("/paymentdelete/:id", userController.paymentdelete);
router.get("/payment/dr", userController.paymentDr);
router.get("/payment/cr", userController.paymentCr);
router.get("/ledgerob", userController.ledgerob);
router.get("/ledgerData", userController.ledgerData);
router.get("/journal", userController.journal);
router.post("/journal", userController.journaladd);
router.put("/journaledit/:id", userController.journaledit);
router.delete("/journaldelete/:id", userController.journaldelete);
router.get("/journal/particulars", userController.journalparticulars);
router.get("/creditnote", userController.creditnote);
router.post("/creditnote", userController.creditnoteadd);
router.put("/creditnoteedit/:id", userController.creditnoteedit);  
router.delete("/creditnotedelete/:id", userController.creditnotedelete);
router.get("/creditnote/particulars", userController.creditnoteparticulars);
router.get("/contra", userController.contra);
router.post("/contra", userController.contraadd);
router.put("/contraedit/:id", userController.contraedit);
router.delete("/contradelete/:id", userController.contradelete);
router.get("/contra/dr", userController.contraDr);
router.get("/contra/cr", userController.contraCr);
router.put('/color/:id', userController.color);
router.post('/purchase',userController.purchaseadd);
router.get("/purchase/suppliername", userController.suppliername);
router.get("/purchase",userController.purchase);
router.get("/purchase/productname",userController.productname);
router.get("/purchase/productlastdetails", userController.productlastdetails);
router.get("/purchase/selectedsupplier",userController.getDataBySupplier);
router.get("/purchaseregister",userController.purchaseregister);
router.get("/purchasedraftregister",userController.purchasedraftregister);
router.put("/purchaseEdit/:id", userController.purchaseEdit);  
router.delete("/purchasedelete/:id", userController.purchasedelete);
router.delete("/purchasetransdelete/:id", userController.purchasetransdelete);
router.get("/purchase/PurchaseId",userController.PurchaseId);
router.get('/purchase/purchaseids', userController.purchaseids);
router.get('/purchase/purchaseDetails', userController.purchaseDetails);
router.get(
  "/purchase/GetSupplierInvoiceData",
  userController.GetSupplierInvoiceData
);
router.get("/salesretail/checkMobileNumber", userController.checkMobileNumber);
router.get("/checkMobileNumberavini", userController.checkMobileNumberavini);

router.get("/purchase/checkInvoiceNumber", userController.checkInvoiceNumber);
router.get('/city',userController.city);
router.get('/purchase/productid',userController.productid);
router.get('/purchase/companystate',userController.companystate);
router.get('/company/getcity',userController.getcity);
router.get('/purchase/supplierstate',userController.supplierstate);
router.get('/purchase/discmode',userController.discmode);
router.get('/manufacturer/getcity',userController.getcity);
router.get('/customer/getcity',userController.getcity);
router.get('/salesman/getcity',userController.getcity);
router.get('/supplier/getcity',userController.getcity);
router.get('/company/getcompany',userController.getcompany);
router.put('/company/updatecompany',userController.updatecompany);
router.get("/editPurchase/productname",userController.productname);
router.get('/editPurchase/discmode',userController.discmode);
router.put("/editPurchase/purchaseEdit/:purchaseId", userController.purchaseEdit);


router.get(
  "/salesprintpage/productdetails",
  userController.getSalesProductDetails
);
router.get("/salesprintpage/salesdetails", userController.salesDetails);

router.get(
  "/salesretailprint/productdetails",
  userController.getSalesretailProductDetails
);
router.get("/salesretailprint/salesdetails", userController.salesretaildetails);


router.get('/Purchasereturn/PurchasereturnDetails', userController.PurchasereturnDetails);
router.post('/Purchasereturn',userController.Purchasereturnadd);
router.put("/PurchasereturnEdit/:id", userController.PurchasereturnEdit); 
router.get('/Purchasereturn/Purchasereturnids', userController.Purchasereturnids);
router.delete("/Purchasereturndelete/:id", userController.Purchasereturndelete);
router.delete("/Purchasereturntransdelete/:id", userController.Purchasereturntransdelete);
router.get("/Purchasereturn/PurchasereturnId",userController.PurchasereturnId);   
router.get('/Purchasereturn/Purchasereturnids', userController.Purchasereturnids);
router.get('/Purchasereturn/productreturnid',userController.productreturnid);
router.get("/Purchasereturnregister",userController.Purchasereturnregister);

router.get('/sales/salesDetails', userController.salesDetails);
router.get("/sales/salesproductname", userController.salesproductname);
router.post('/sales',userController.salesadd);
router.put("/salesEdit/:id", userController.salesEdit); 
router.get('/sales/salesids', userController.salesids);     
router.delete("/salesdelete/:id", userController.salesdelete);
router.delete("/salestransdelete/:id", userController.salestransdelete);
router.get('/sales/saleproductid',userController.saleproductid);
router.get("/salesregister",userController.salesregister);
router.get("/salesdraftregister", userController.salesdraftregister);
router.get("/sales/customername",userController.customername);
router.get("/sales/salesmanname", userController.salesmanname);
router.post('/sales/batchDetails/:selectedProductId', userController.batchDetails);

router.get('/salesReturn/salesReturnDetails', userController.salesReturnDetails);
router.post('/salesReturn',userController.salesReturnadd);
router.put("/salesReturnEdit/:id", userController.salesReturnEdit); 
router.get('/salesReturn/salesReturnids', userController.salesReturnids);
router.delete("/salesReturndelete/:id", userController.salesReturndelete);
router.delete("/salesReturntransdelete/:id", userController.salesReturntransdelete);
router.get('/salesReturn/salesReturnproductid',userController.salesReturnproductid);
router.get("/salesReturnregister",userController.salesReturnregister);
router.get("/salesReturn/customername",userController.customername);
router.post('/salesReturn/batchDetails/:selectedProductId', userController.batchDetails);

router.get('/sidebar/companyTitle', userController.companyTitle);

router.get('/index/supplierCount', userController.supplierCount);
router.get('/index/customerCount', userController.customerCount);
router.get('/index/productCount', userController.productCount);
router.get('/index/purchaseCount', userController.purchaseCount);
router.get('/index/salesData', userController.salesData);
router.get('/index/masterdata', userController.masterdata);

router.get('/gstpurchase', userController.gstPurchase);
router.get('/gstsales', userController.gstsales);
router.get('/hsnpurchase', userController.hsnPurchase);
router.get('/hsnsales', userController.hsnsales);      

router.get('/balancesheet', userController.balancesheet);
router.get('/profitandloss', userController.profitandloss);
router.get('/trailbalance', userController.trailbalance);
router.get('/creditbook', userController.creditbook);
router.get('/journalbook', userController.journalbook);
router.get('/daybook', userController.daybook);
router.get('/cashbook', userController.cashbook);
router.get('/bankbook', userController.bankbook);
router.get('/ledgerbook',userController.ledgerbook);
router.get('/ledgerbook/ledgerDr',userController.ledgerDr);
router.get('/billwise', userController.billwise);
router.get('/salesoutstanding', userController.salesoutstanding);
router.get('/purchaseoutstanding', userController.purchaseoutstanding);
router.get('/productwisepurcsale', userController.productwisepurcsale);
router.get('/currentstock', userController.currentstock);
router.get('/batchsummary', userController.batchsummary);
router.get('/stocksummary', userController.stocksummary);
router.get('/stockanalysis', userController.stockanalysis);

router.get('/purchaseprintpage/productdetails', userController.getProductDetails);
router.get('/purchaseprintpage/purchasedetails', userController.purchasedetails);

router.get('/purchaseoutstanding', userController.purchaseoutstanding);

router.get('/salesprintpage/productdetails', userController.getSalesProductDetails);
router.get('/salesprintpage/salesretaildetails', userController.salesretailDetails);

router.get('/salesretailprint/productdetails', userController.getSalesretailProductDetails);
router.get('/salesretailprint/salesretailDetails', userController.salesretailDetails);

router.get('/user/getrole', userController.getrole);
router.post('/user/create', userController.create);
router.post('/user/updateUser', userController.updateUser);
router.delete('/user/deleteUser/:id', userController.deleteUser);
router.get('/menuaccess', userController.menuaccess);
router.post('/menuaccess/updateCheckbox/:id', userController.updateCheckbox);

router.get('/sidebar', userController.sidebar);

router.get("/salesretail/salesretailDetails", userController.salesretailDetails);
router.post("/salesretail", userController.salesretailadd);
router.put("/salesretailEdit/:id", userController.salesretailEdit); 
router.get("/salesretail/salesretailids", userController.salesretailids);     
router.delete("/salesretaildelete/:id", userController.salesretaildelete);
router.delete( "/salesretailtransdelete/:id",userController.salesretailtransdelete);
router.get("/salesretail/salesretailproductid",userController.salesretailproductid);
router.get("/salesretailregister", userController.salesretailregister);
router.get("/salesretaildraft", userController.salesretaildraft);
router.get("/salesretail/customername", userController.customername);
router.post(
  "/salesretail/retailbatchDetails/:selectedProductId",
  userController.retailbatchDetails
);
router.get("/salesretail/checkMobile", userController.checkMobileNumber);

router.get(
  "/salesretail/checkStockAvailability/:productId/:batchNo/:quantity/:expiryDate",
  userController.checkStockAvailability
);

router.get(
  "/sales/checksalesStockAvailability/:productId/:batchNo/:quantity/:expiryDate",
  userController.checksalesStockAvailability
);

router.get("/molecules", userController.molecules);
router.post("/molecules", userController.moleculesadd);
router.put("/moleculesedit/:id", userController.moleculesedit);
router.delete("/moleculesdelete/:id", userController.moleculesdelete);  

router.get("/combinedmolecules", userController.combinedmolecules);
router.post("/combinedmolecules", userController.combinedmoleculesadd);
router.put("/combinedmoleculesedit/:id", userController.combinedmoleculesedit);
router.delete(
  "/combinedmoleculesdelete/:id",
  userController.combinedmoleculesdelete
);

router.get(
  "/product/moleculescombination",
  userController.moleculescombination
);



router.get("/package", userController.package);
router.post("/package", userController.packageadd);
router.put("/packageedit/:id", userController.packageedit);
router.delete("/packagedelete/:id", userController.packagedelete);

router.get("/index/dashboardinfo", userController.dashboardinfo);


router.get("/salesretailreturn", userController.salesretailreturn);
router.get(
  "/salesretailreturn/salesretailreturnDetails",
  userController.salesretailDetails
);
router.post("/salesretailreturn", userController.salesretailreturnadd);
router.put("/salesretailreturnEdit/:id", userController.salesretailreturnEdit);
router.get(
  "/salesretailreturn/salesretailreturnids",
  userController.salesretailreturnids
);
router.delete(
  "/salesretailreturndelete/:id",
  userController.salesretailreturndelete
);
router.delete(
  "/salesretailreturntransdelete/:id",
  userController.salesretailreturntransdelete
);

router.get(
  "/salesretailreturn/salesretailreturnproductid",
  userController.salesretailreturnproductid
);
router.get(
  "/salesretailreturnregister",
  userController.salesretailreturnregister
);

router.get("/salesretailreturn/customername", userController.customername);
router.post(
  "/salesretailreturn/retailbatchDetails/:selectedProductId",
  userController.retailbatchDetails
);


router.get(
  "/salesretailreturn/salesretailreturnDetails",
  userController.salesretailreturnDetails
);
router.get(
  "/salesretailreturn/salesretailreturnproductid",
  userController.salesretailreturnproductid
);



router.get("/salesretail/customerretail", userController.customerretail);
router.post("/salesretail/customerretail", userController.customerretailadd);
router.put(
  "/salesretail/customerretailedit/:id",
  userController.customerretailedit
);
router.delete(
  "/salesretail/customerretaildelete/:id",
  userController.customerretaildelete
);
router.get("/drugreport", userController.drugreport);
router.get("/producthistory", userController.producthistory);
router.post('/addCustomeravini',userController.addCustomeravini);

router.get("/checkMobileNumberClinic", userController.checkMobileNumberClinic);
router.post("/addCustomerClinic", userController.addCustomerClinic);

router.get("/getRegCustomers", userController.getRegCustomers);
router.put(
  "/updateRegCustomer/${selectedCustomer.regid}",
  userController.updateRegCustomer
);
router.delete("/deleteRegCustomer/${regid}", userController.deleteRegCustomer);


// router.get("/regmember", userController.manufacturer);
// router.post("/manufacturer", userController.manufactureradd);
// router.put("/manufactureredit/:id", userController.manufactureredit);
// router.delete("/manufacturerdelete/:id", userController.manufacturerdelete);



router.get("/inpatient/checkMobileNumber", userController.checkMobileNumber);
router.get("/inpatient/inpatientDetails", userController.inpatientDetails);
router.post("/inpatient", userController.inpatientadd);

router.put("/inpatientEdit/:id", userController.inpatientEdit);
router.get("/inpatient/inpatientids", userController.inpatientids);
router.delete("/inpatientdelete/:id", userController.inpatientdelete);
router.delete("/inpatienttransdelete/:id", userController.inpatienttransdelete);
router.get(
  "/inpatient/inpatientproductid",
  userController.inpatientproductid
);
router.get("/inpatientregister", userController.inpatientregister);
router.get("/inpatientdraft", userController.inpatientdraft);
router.get("/inpatient/customername", userController.customername);
router.post(
  "/inpatient/retailbatchDetails/:selectedProductId",
  userController.retailbatchDetails
);
router.get("/inpatient/checkMobile", userController.checkMobileNumber);

router.get(
  "/inpatientreg/checkStockAvailability/:productId/:batchNo/:quantity/:expiryDate",
  userController.checkStockAvailability
);



// router.get("/inpatientreturn", userController.inpatientreturn);
router.get(
  "/inpatientreturn/inpatientreturnDetails",
  userController.inpatientreturnDetails
);
router.post("/inpatientreturn", userController.inpatientreturnadd);
router.put("/inpatientreturnEdit/:id", userController.inpatientreturnEdit);
router.get(
  "/inpatientreturn/inpatientreturnids",
  userController.inpatientreturnids
);
router.delete(
  "/inpatientreturndelete/:id",
  userController.inpatientreturndelete
);
router.delete(
  "/inpatientreturntransdelete/:id",
  userController.inpatientreturntransdelete
);

router.get(
  "/inpatientreturn/inpatientreturnproductid",
  userController.inpatientreturnproductid
);
router.get("/inpatientreturnregister", userController.inpatientreturnregister);

router.get("/inpatientreturn/customername", userController.customername);
router.post(
  "/inpatientreturn/retailbatchDetails/:selectedProductId",
  userController.retailbatchDetails
);

router.get(
  "/inpatientreturn/inpatientreturnDetails",
  userController.salesretailreturnDetails
);
router.get(
  "/inpatientreturn/inpatientreturnproductid",
  userController.salesretailreturnproductid
);
router.get(
  "/inpatientbillprint/productdetails",
  userController.getSalesProductDetails
);
router.get("/inpatientbillprint/salesdetails", userController.salesDetails);

router.get(
  "/inpatientbillprint/getinpatientProductDetails",
  userController.getinpatientProductDetails
);
router.get(
  "/inpatientbillprint/inpatientretaildetails",
  userController.inpatientretaildetails
);

 
router.get("/inpatient/Getinpatient", userController.Getinpatient);


router.post("/visitEntry", userController.visitEntry);

module.exports = router;
 