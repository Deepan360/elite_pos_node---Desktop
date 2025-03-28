const sql = require("mssql");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment");

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    enableArithAbort: true,
  },
};

const pool = new sql.ConnectionPool(config);

const poolConnect = async () => {
  try {
    await pool.connect();
    console.log("Connected to the database ");
    return pool;
  } catch (error) {
    console.error("Error connecting to the database:", error.message);
    throw error; // Make sure to rethrow the error to handle it in the calling function
  }
};

function formatDate(dateString) {
  //   // Implement your own date formatting logic here
  return dateString;
}


const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../uploads/prescription");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Ensure the correct directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// Set up multer middleware
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    console.log("File received:", file); // Debugging
    cb(null, true);
  },
}).array("prescriptionImage", 1);

// Ensure this matches the frontend field name

exports.upload = upload;

exports.inpatientadd = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ success: false, message: err.message });
    }
    console.log("Received body:", req.body);
    console.log("Received file:", req.file);

    const {
      saledate,
      ppaymentMode,
      customerId,
      doctorname,
      pamount,
      pigst,
      pcgst,
      psgst,
      psubtotal,
      pcess,
      ptcs,
      proundOff,
      pnetAmount,
      pdiscount,
      pdiscMode_,
      isDraft,
      products: productsString,
    } = req.body;

    let parsedProducts = [];
    const formattedSaleDate = saledate || null;
  const prescriptionImage =
    req.files && req.files.length ? req.files[0].filename : null;


    try {
      await pool.connect();

      parsedProducts = JSON.parse(productsString);

      // Insert into inpatient_Master
      const result = await pool
        .request()
        .input("saledate", sql.DateTime, formattedSaleDate)
        .input("ppaymentMode", sql.VarChar, ppaymentMode)
        .input("customerId", sql.VarChar, customerId)
        .input("doctorname", sql.VarChar, doctorname)
        .input("pamount", sql.Decimal, pamount)
        .input("pcgst", sql.Decimal, pcgst)
        .input("psgst", sql.Decimal, psgst)
        .input("pigst", sql.Decimal, pigst)
        .input("pnetAmount", sql.Decimal, pnetAmount)
        .input("pcess", sql.Decimal, pcess)
        .input("ptcs", sql.Decimal, ptcs)
        .input("pdiscMode_", sql.VarChar, pdiscMode_)
        .input("pdiscount", sql.Decimal, pdiscount)
        .input("psubtotal", sql.Decimal, psubtotal)
        .input("proundOff", sql.Decimal, proundOff)
        .input("isDraft", sql.Int, isDraft)
        .input("prescriptionImage", sql.VarChar, prescriptionImage).query(`
          INSERT INTO inpatient_Master
          ([saledate], [paymentmode], [customername], [doctorname], [amount], [cgst], [sgst], [igst], [netAmount], [cess], [tcs], [discMode], [discount], [subtotal], [roundoff], [isDraft], [prescriptionImage])
          VALUES
          (@saledate, @ppaymentMode, @customerId, @doctorname, @pamount, @pcgst, @psgst, @pigst, @pnetAmount, @pcess, @ptcs, @pdiscMode_, @pdiscount, @psubtotal, @proundOff, @isDraft, @prescriptionImage);
          
          SELECT SCOPE_IDENTITY() as salesId;
        `);

      const salesId = result.recordset[0].salesId;
      console.log("Number of products:", parsedProducts.length);

      for (const product of parsedProducts) {
        const {
          productId,
          batchNo,
          expiryDate,
          tax,
          quantity,
          free,
          uom,
          purcRate,
          mrp,
          rate,
          discMode,
          discount,
          amount,
          cgst,
          sgst,
          igst,
          totalAmount,
        } = product;

        await pool
          .request()
          .input("salesId", sql.Int, salesId)
          .input("productId", sql.Int, productId)
          .input("batchNo", sql.VarChar, batchNo)
          .input("expiryDate", sql.VarChar, expiryDate)
          .input("tax", sql.Decimal, tax)
          .input("quantity", sql.Int, quantity)
          .input("free", sql.Int, free)
          .input("uom", sql.VarChar, uom)
          .input("purcRate", sql.Decimal, purcRate)
          .input("mrp", sql.Decimal, mrp)
          .input("rate", sql.Decimal, rate)
          .input("discMode", sql.VarChar, discMode)
          .input("discount", sql.Decimal, discount)
          .input("amount", sql.Decimal, amount)
          .input("cgst", sql.Decimal, cgst)
          .input("sgst", sql.Decimal, sgst)
          .input("igst", sql.Decimal, igst)
          .input("totalAmount", sql.Decimal, totalAmount).query(`
            INSERT INTO inpatient_Trans
            ([salesId], [product], [batchNo], [expiryDate], [tax], [quantity], [free], [uom], [purcRate], [mrp], [rate], [discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
            VALUES
            (@salesId, @productId, @batchNo, @expiryDate, @tax, @quantity, @free, @uom, @purcRate, @mrp, @rate, @discMode, @discount, @amount, @cgst, @sgst, @igst, @totalAmount);
          `);

        if (Number(isDraft) !== 1) {
          await reduceretailStock(
            productId,
            quantity,
            free,
            batchNo,
            expiryDate
          );
        }
      }

      res
        .status(200)
        .json({ success: true, message: "Sales added successfully" });
    } catch (error) {
      console.error("Error during processing:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  });
};

exports.visitEntry = async (req, res) => {
  const { customerId, reason, doctorName } = req.body; // Removed visitdate since it will be auto-set
  console.log("Received Data:", req.body);
  try {
    await pool
      .request()
      .input("customerId", sql.Int, customerId)
      .input("reason", sql.VarChar, reason)
      .input("doctorName", sql.VarChar, doctorName).query(`
      INSERT INTO [elitePOS_MedWell].[dbo].[visit_entry]
      ([patientid], [doctorname], [dateofvisit], [reasonofvisit])
      VALUES
      (@customerId, @doctorName, GETDATE(), @reason);
      `);

    const visitid = await pool.request().query(`SELECT SCOPE_IDENTITY() AS visitid`);

    res.status(200).json({
      success: true,
      message: "Visit added successfully",
      visitid: visitid,
    });
  } catch (error) {
    console.error("Error during visit entry:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.addCustomerClinic = async (req, res) => {
  const {
    name,
    mobileno,
    dob,
    gender,
    address,
    city,
    state,
    country,
    pincode,
    age,
    
  } = req.body;

  // Get current year (last 2 digits) and month
  const currentYear = new Date().getFullYear().toString().slice(-2); // "25" for 2025
  const currentMonth = (`0` + (new Date().getMonth() + 1)).slice(-2); // "03" for March
  const prefix = `${currentYear}${currentMonth}`; // "2503"

  try {
    // Query to find the latest `regid` for the current month
    const latestRegQuery = `
      SELECT TOP 1 regid 
      FROM [elitePOS_MedWell].[dbo].[reg_patient]
      WHERE regid LIKE '${prefix}%'
      ORDER BY regid DESC
    `;

    const latestRegResult = await pool.request().query(latestRegQuery);

    let nextNumber = "001"; // Default if no record exists

    if (latestRegResult.recordset.length > 0) {
      const lastRegid = latestRegResult.recordset[0].regid;
      const lastNumber = parseInt(lastRegid.slice(-3)); // Extract the last 3 digits
      nextNumber = String(lastNumber + 1).padStart(3, "0"); // Increment and format
    }

    const newRegid = `${prefix}${nextNumber}`; // Generate final `regid`

    // Query to check if both name and mobile number already exist
    const checkQuery = `
      SELECT COUNT(*) AS count
      FROM [elitePOS_MedWell].[dbo].[reg_patient]
      WHERE mobileno = @mobileno AND name = @name AND IsActive = 1
    `;

    const existingCustomer = await pool
      .request()
      .input("mobileno", sql.NVarChar(255), mobileno)
      .input("name", sql.NVarChar(255), name)
      .query(checkQuery);

    if (existingCustomer.recordset[0].count > 0) {
      return res
        .status(400)
        .json({
          error:
            "Customer with the same name and mobile number already exists.",
        });
    }

    // Insert new record with generated `regid`
    const query = `
      INSERT INTO [elitePOS_MedWell].[dbo].[reg_patient]
        ([regid], [name], [mobileno], [address], [city], [state], [country], [pincode], [age], [gender], [dob], [IsActive], [lastvisited])
      VALUES
        (@regid, @name, @mobileno, @address, @city, @state, @country, @pincode, @age, @gender, @dob, 1, GETDATE())
    `;

    await pool
      .request()
      .input("regid", sql.NVarChar(10), newRegid)
      .input("name", sql.NVarChar(255), name)
      .input("mobileno", sql.NVarChar(255), mobileno)
      .input("address", sql.NVarChar(255), address)
      .input("city", sql.NVarChar(255), city)
      .input("state", sql.NVarChar(255), state)
      .input("country", sql.NVarChar(255), country)
      .input("pincode", sql.NVarChar(10), pincode)
      .input("age", sql.Int, age)
      .input("gender", sql.NVarChar(10), gender)
      .input("dob", sql.Date, dob)
      .query(query);

    return res
      .status(200)
      .json({ message: "Customer added successfully", regid: newRegid });
  } catch (error) {
    console.error(
      "Error occurred while processing customer data:",
      error.message || error
    );
    return res
      .status(500)
      .json({ error: "Failed to add customer. Please try again later." });
  }
};

exports.checkMobileNumberClinic = async (req, res) => {
  const mobile = req.query.mobileno; // Ensure this matches the query parameter name
  console.log("Received mobile number:", mobile); // Log the received mobile number

  if (!mobile) {
    return res.status(400).json({ error: "Mobile number is required" });
  }

  try {
    // Query to get all records for the given mobile number
    const result = await pool
      .request()
      .input("mobile", sql.NVarChar(15), mobile) // Ensure NVarChar length is sufficient
      .query(
        "SELECT * FROM [elitePOS_MedWell].[dbo].[reg_patient] WHERE mobileno = @mobile"
      );

    console.log("Query Result:", result.recordset); // Log the result for debugging

    if (result.recordset.length > 0) {
      // Return all matching records
      return res.status(200).json({ data: result.recordset });
    } else {
      // No customer found, return empty array
      return res.status(200).json({ data: [] });
    }
  } catch (error) {
    console.error("Error during query execution:", error); // Log the error
    return res.status(500).json({
      error: "Internal Server Error",
      message: error.message, // Include actual error message
      stack: error.stack, // Optional: Provide stack trace for debugging
    });
  }
};


//salesretailprintpage
exports.getinpatientProductDetails = (req, res) => {
  const salesId = req.query.salesId; // Extract salesId from query parameter

  // Use parameterized query to prevent SQL injection
  const request = pool.request();
  request.input("SalesId", sql.Int, salesId); // Add salesId as a parameter

  request.execute("dbo.getinpatientProductDetails", (err, result) => {
    if (err) {
      console.error("Error executing stored procedure:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // Log the result
    console.log("Product details:", result.recordset);

    // Send the data as JSON response
    res.json({ data: result.recordset });
  });
};

  exports.inpatientretaildetails = (req, res) => {
  const salesId = req.query.salesId; // Extract salesId from query parameter

  // Use parameterized query to prevent SQL injection
  const request = pool.request();
  request.input("SalesId", sql.Int, salesId); // Add salesId as a parameter

  request.execute("dbo.inpatientretaildetails", (err, result) => {
    if (err) {
      console.error("Error executing stored procedure:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // Log the result
    console.log("Sales details:", result.recordset);

    // Send the data as JSON response
    res.json({ data: result.recordset });
  });
  };
//salesretailprintpage


//salesretailreturn retail






exports.inpatientreturnDetails = async (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const query = "SELECT * FROM [elite_pos].[dbo].[inpatientregreturn_Master]";

    pool.query(query, (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      res.json({ data: result.recordset });
    });
  });
};

exports.inpatientreturnadd = async (req, res) => {
  console.log("Received Data:", req.body);

  const {
    id: salesreturnid,
    saledate,
    paymentmode,
    customername,
    pamount,
    pigst,
    pcgst,
    psgst,
    psubtotal,
    pcess,
    ptcs,
    proundOff,
    pnetAmount,
    pdiscount,
    pdiscMode_,
    isDraft,
    products,
  } = req.body;

  if (!Array.isArray(products)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid products data format" });
  }

  let transaction;
  try {
    // Establish connection to the pool
    const poolConnection = await pool.connect();

    // Create and begin a transaction
    transaction = new sql.Transaction(poolConnection);
    await transaction.begin();

    // Insert into master table
    const result = await transaction
      .request()
      .input("salesreturnid", salesreturnid)
      .input("saledate", saledate || null)
      .input("paymentmode", paymentmode)
      .input("customername", customername)
      .input("amount", pamount)
      .input("cgst", pcgst)
      .input("sgst", psgst)
      .input("igst", pigst)
      .input("netAmount", pnetAmount)
      .input("cess", pcess)
      .input("tcs", ptcs)
      .input("discMode", pdiscMode_)
      .input("discount", pdiscount)
      .input("subtotal", psubtotal)
      .input("roundoff", proundOff)
      .input("isDraft", isDraft).query(`
       INSERT INTO [elite_pos].[dbo].[inpatient_Master]
([salesreturnid], [saledate], [paymentmode], [customername], 
[amount],  [cgst], [sgst], [igst], [netAmount], [cess], [tcs], 
[discMode], [discount], [subtotal], [roundoff], [isDraft])
VALUES
(@salesreturnid, @saledate, @paymentmode,  @customername, 
@amount, @cgst, @sgst, @igst, @netAmount, @cess, @tcs, 
@discMode, @discount, @subtotal, @roundoff, @isDraft);
        SELECT SCOPE_IDENTITY() as salesId;
      `);
    const salesId = result.recordset[0].salesId;
    // Insert products into the transaction table
    for (const product of products) {
      const {
        Id,
        productId,
        batchNo,
        expiryDate,
        tax,
        quantity,
        free,
        uom,
        purcRate,
        mrp,
        rate,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;

      await transaction
        .request()
        .input("salesId", salesId)
        .input("product", productId)
        .input("batchNo", batchNo)
        .input("expiryDate", expiryDate)
        .input("tax", tax)
        .input("quantity", quantity)
        .input("free", free)
        .input("uom", uom)
        .input("purcRate", purcRate)
        .input("mrp", mrp)
        .input("rate", rate)
        .input("discMode", discMode)
        .input("discount", discount)
        .input("amount", amount)
        .input("cgst", cgst)
        .input("sgst", sgst)
        .input("igst", igst)
        .input("totalAmount", totalAmount)
        .input("salesreturnid", Id).query(`
          INSERT INTO [elite_pos].[dbo].[inpatient_Trans]
          ([salesId], [product], [batchNo], [expiryDate], [tax], [quantity], 
          [free], [uom], [purcRate], [mrp], [rate], [discMode], [discount], 
          [amount], [cgst], [sgst], [igst], [totalAmount], [salesreturnid])
          VALUES
          (@salesId, @product, @batchNo, @expiryDate, @tax, @quantity, 
          @free, @uom, @purcRate, @mrp, @rate, @discMode, @discount, 
          @amount, @cgst, @sgst, @igst, @totalAmount, @salesreturnid);
        `);

      // Update stock (your function)
      await increaseRetailStock(productId, quantity, free, batchNo, expiryDate);
    }

    // Commit transaction
    await transaction.commit();
    res.status(200).json({
      success: true,
      message: "Sales retail return added successfully",
    });
  } catch (error) {
    console.error("Error during salesretailreturn processing:", error);

    if (transaction) {
      await transaction.rollback(); // Rollback on error
    }

    res.status(500).json({
      success: false,
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

exports.inpatientreturnEdit = async (req, res) => {
  const { purchaseId } = req.params;
  const { purchaseDetails, products } = req.body;
  try {
    console.log("Received request to edit purchase:", req.body);
    await pool.query`
        UPDATE [elite_pos].[dbo].[salesretailreturn_Master]
        SET
            [saledate] = ${purchaseDetails.saledate},
            [paymentmode] = ${purchaseDetails.paymentmode},
            [customermobileno] = ${purchaseDetails.customermobileno},
            [customername] = ${purchaseDetails.customername},
            [amount] = ${purchaseDetails.pamount},
            [cgst] = ${purchaseDetails.pcgst},
            [sgst] = ${purchaseDetails.psgst},
            [igst] = ${purchaseDetails.pigst},
            [netAmount] = ${purchaseDetails.pnetAmount},
            [cess] = ${purchaseDetails.pcess},
            [tcs] = ${purchaseDetails.ptcs},
            [discMode] = ${purchaseDetails.pdiscMode_},
            [discount] = ${purchaseDetails.pdiscount},
            [subtotal] = ${purchaseDetails.psubtotal},
            [roundoff] = ${purchaseDetails.proundOff},
          [isDraft] = ${purchaseDetails.isDraft}
        WHERE
            [id] = ${purchaseDetails.id};
    `;
    for (const product of products) {
      const {
        Id,
        productId,
        batchNo,
        tax,
        quantity,
        free,
        uom,
        purcRate,
        mrp,
        rate,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;
      if (Id) {
        await pool.query`
          UPDATE [elite_pos].[dbo].[inpatientregreturn_Trans]
          SET
              [product] = ${productId},
              [batchNo] = ${batchNo},
              [tax] = ${tax},
              [quantity] = ${quantity},
              [free] = ${free},
              [uom] = ${uom},
              [purcRate]=${purcRate},
               [mrp]=${mrp},
              [rate] = ${rate},
              [discMode] = ${discMode},
              [discount] = ${discount},
              [amount] = ${amount},
              [cgst] = ${cgst},
              [sgst] = ${sgst},
              [igst] = ${igst},
              [totalAmount] = ${totalAmount}
          WHERE
              [Id] = ${Id};
        `;
      } else {
        await pool.query`
          INSERT INTO [elite_pos].[dbo].[inpatientregreturn_Trans] ([salesId], [product], [batchNo], [tax], [quantity], [uom],[purcRate],[mrp], [rate], [discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
          VALUES ( ${purchaseDetails.id}, ${productId}, ${batchNo}, ${tax}, ${quantity}, ${uom},${purcRate},${mrp} ,${rate}, ${discMode}, ${discount}, ${amount}, ${cgst}, ${sgst}, ${igst}, ${totalAmount});
        `;
        await increaseRetailStock(productId, quantity, free, batchNo);
      }
    }
    console.log("salesretailreturn edited successfully");
    res.status(200).json({
      success: true,
      message: "salesretailreturn edited successfully",
    });
  } catch (error) {
    console.error("Error updating salesretailreturn:", error);
    res
      .status(400)
      .json({ success: false, message: "Failed to update salesretailreturn" });
  }
};

exports.inpatientreturnids = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
                  SELECT *
                 
              FROM 
                  [elite_pos].[dbo].[inpatientregreturn_Master] 
                  
              
              `;
    pool.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error("Error in fetching purchase IDs:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      res.header("Content-Type", "application/json");
      res.json({ data: result.recordset });
    });
  });
};

exports.inpatientreturnproductid = (req, res) => {
  const purchaseId = req.query.purchaseId;
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
    SELECT 
    pt.Id,
    pt.product, -- Assuming this is the product ID
    p.productname,
    dm.discMode,
    pt.batchNo,
    pt.tax,
    pt.quantity,
    pt.free,
    pt.uom,
    pt.purcRate,
     pt.mrp,
    pt.rate,
    pt.discount,
    pt.amount,
    pt.cgst,
    pt.sgst,
    pt.igst,
    pt.totalAmount
FROM 
    [elite_pos].[dbo].[inpatientregreturn_Trans] pt
JOIN
    [elite_pos].[dbo].[product] p ON pt.product = p.id
JOIN
    [elite_pos].[dbo].[discmode] dm ON pt.discMode = dm.id
WHERE 
    pt.salesId = '${purchaseId}';
`;

    pool.query(query, (err, result) => {
      connection.release();

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      res.json({
        data: result.recordset.map((row) => ({
          ...row,
          product: row.productname,
        })),
      });
    });
  });
};

exports.inpatientreturndelete = async (req, res) => {
  const salesId = req.params.id;

  try {
    await poolConnect();

    if (!salesId) {
      throw new Error("No salesId provided");
    }

    // Fetch transaction details associated with the salesId
    const transDetailsResult = await pool.query`
      SELECT Id, product, batchNo, quantity,free, tax, uom, rate
      FROM [elite_pos].[dbo].[inpatientregreturn_Trans]
      WHERE [salesId] = ${salesId};
    `;

    const transactions = transDetailsResult.recordset;

    // Iterate through each transaction
    for (const transaction of transactions) {
      const { product, batchNo, free, quantity } = transaction;

      // Increase the stock quantities
      await reduceretailStock(product, quantity, free, batchNo);
    }

    // Delete from sales_Master
    await pool.query`
      DELETE FROM [elite_pos].[dbo].[inpatientregreturn_Master]
      WHERE [id] = ${salesId};
    `;

    // Delete associated products from sales_Trans
    await pool.query`
      DELETE FROM [elite_pos].[dbo].[inpatientregreturn_Trans]
      WHERE [salesId] = ${salesId};
    `;

    res.status(200).json({
      success: true,
      message: "Sales retail and associated products deleted successfully",
    });
  } catch (error) {
    console.error("Error during salesretailreturn deletion:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.inpatientreturntransdelete = async (req, res) => {
  const transactionId = req.params.id;
  try {
    await poolConnect();

    const { recordset } = await pool
      .request()
      .input("transactionId", sql.Int, transactionId)
      .query(
        "SELECT quantity,free, Product, batchNo FROM [elite_pos].[dbo].[inpatientregreturn_Trans] WHERE Id = @transactionId"
      );

    if (recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Purchased product not found" });
    }

    const { quantity, free, Product: productId, batchNo } = recordset[0];

    const result = await pool
      .request()
      .input("transactionId", sql.Int, transactionId)
      .query(
        "DELETE FROM [elite_pos].[dbo].[inpatientregreturn_Trans] WHERE Id = @transactionId"
      );

    // Update the stock in the stock_Ob table based on the productId, batchNo, and retrieved quantity
    await reduceretailStock(productId, quantity, free, batchNo);

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Purchased product deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Purchased product not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.inpatientreturnregister = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
   SELECT 
	SM.* ,SM.subtotal - SRT.totalAmount AS Amt
FROM 
	salesretailreturn_Trans SRT 
	INNER JOIN inpatient_Trans ST ON SRT.salesreturnid = ST.id
	INNER JOIN inpatient_Master SM ON SM.id = ST.salesId
   ;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.inpatientreturndraft = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
    SELECT *
    FROM [elite_pos].[dbo].[inpatientregreturn_Master] 
    where isDraft = 1;
    
   ;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};
//salesretailreturn

//salesretail retail

exports.inpatientDetails = async (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const query = `
      SELECT 
          sm.[id] ,
          sm.[saledate],
          sm.[paymentmode],
          sm.[doctorname],
          rc.[name] as customername,
          rc.[mobileno],
          sm.[saledate],
          sm.[doctorname],
          sm.[amount],
          sm.[cdAmount],  
          sm.[igst],
          sm.[cgst],
          sm.[sgst],
          sm.[subtotal],
          sm.[cess],
          sm.[tcs],
          sm.[discMode],
          sm.[discount],
          sm.[roundoff],
          sm.[netAmount],
          sm.[isDraft]
      FROM 
          [elite_pos].[dbo].[inpatient_Master] sm
      LEFT JOIN 
          [elitePOS_MedWell].[dbo].[reg_patient] rc ON sm.[customername] = rc.[mobileno] -- Change the join condition if needed
    `;

    pool.query(query, (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      res.json({ data: result.recordset });
    });
  });
};

exports.inpatientEdit = async (req, res) => {
  const { id } = req.params;
  const { purchaseDetails, products } = req.body;

  try {
    console.log("Received request to edit purchase:", req.body);

    // Update salesretail_Master
    await pool.query`
      UPDATE inpatient_Master
      SET
          [saledate] = ${purchaseDetails.saledate}, 
          [paymentmode] = ${purchaseDetails.paymentmode},
          [customername] = ${purchaseDetails.customername},
          [doctorname] = ${purchaseDetails.doctorname},
          [amount] = ${purchaseDetails.pamount},
          [cgst] = ${purchaseDetails.pcgst},
          [sgst] = ${purchaseDetails.psgst},
          [igst] = ${purchaseDetails.pigst},
          [netAmount] = ${purchaseDetails.pnetAmount},
          [cess] = ${purchaseDetails.pcess},
          [tcs] = ${purchaseDetails.ptcs},
          [discMode] = ${purchaseDetails.pdiscMode_},
          [discount] = ${purchaseDetails.pdiscount},
          [subtotal] = ${purchaseDetails.psubtotal},
          [roundoff] = ${purchaseDetails.proundOff},
          [isDraft] = ${purchaseDetails.isDraft}
      WHERE
          [id] = ${id};
    `;

    // Iterate through each product in the products array
    for (const product of products) {
      const {
        Id,
        productId,
        batchNo,
        expiryDate,
        tax,
        quantity,
        free,
        uom,
        purcRate,
        mrp,
        rate,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;

      // If the product already exists in the database (i.e., it's being updated)
      if (Id) {
        await pool.query`
          UPDATE inpatient_Trans
          SET
              [product] = ${productId},
              [batchNo] = ${batchNo},
              [expiryDate] = ${expiryDate},
              [tax] = ${tax},
              [quantity] = ${quantity},
              [free] = ${free},
              [uom] = ${uom},
              [purcRate] = ${purcRate},
              [mrp] = ${mrp},
              [rate] = ${rate},
              [discMode] = ${discMode},
              [discount] = ${discount},
              [amount] = ${amount},
              [cgst] = ${cgst},
              [sgst] = ${sgst},
              [igst] = ${igst},
              [totalAmount] = ${totalAmount}
          WHERE
              [Id] = ${Id};
        `;

        if (purchaseDetails.isDraft != 1) {
          // Loose equality check
          console.log("Attempting to reduce stock for existing product...");
          await reduceretailStock(
            productId,
            quantity,
            free,
            batchNo,
            expiryDate
          );
        }
      } else {
        // If the product is being added (i.e., it's a new product in the transaction)
        await pool.query`
          INSERT INTO inpatient_Trans ([salesId], [product], [batchNo], [expiryDate], [tax], [quantity], [uom], [purcRate], [mrp], [rate], [discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
          VALUES (${purchaseDetails.id}, ${productId}, ${batchNo}, ${expiryDate}, ${tax}, ${quantity}, ${uom}, ${purcRate}, ${mrp}, ${rate}, ${discMode}, ${discount}, ${amount}, ${cgst}, ${sgst}, ${igst}, ${totalAmount});
        `;

        if (purchaseDetails.isDraft != 1) {
          // Loose equality check
          console.log("Attempting to reduce stock for new product...");
          await reduceretailStock(
            productId,
            quantity,
            free,
            batchNo,
            expiryDate
          );
        }
      }
    }

    console.log("salesretail edited successfully");
    res
      .status(200)
      .json({ success: true, message: "salesretail edited successfully" });
  } catch (error) {
    console.error("Error updating salesretail:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update salesretail",
    });
  }
};

async function increaseRetailStock(
  productId,
  quantity,
  free,
  batchNo,
  expiryDate
) {
  try {
    // Sum of quantity and free
    const totalQuantity = Number(quantity) + Number(free);

    // Fetch the current stock and retail quantity for the given product, batch number, and expiry date
    const result = await pool.query`
      SELECT op_quantity AS stockQty, retailQty FROM stock_Ob
      WHERE product = ${productId} AND batchNo = ${batchNo} AND expiryDate = ${expiryDate};
    `;

    if (result.recordset.length > 0) {
      let { stockQty, retailQty } = result.recordset[0];

      // Treat stockQty as 0 if it's NULL
      stockQty = stockQty || 0;

      // Treat retailQty as 0 if it's NULL (if needed, modify based on your logic)
      retailQty = retailQty || 0;

      // Calculate the new retail quantity and stock quantity
      const newRetailQty = retailQty + totalQuantity;

      // Avoid division by zero if retailQty is zero
      const stockIncrease =
        retailQty > 0 ? (totalQuantity * stockQty) / retailQty : totalQuantity;

      const newStockQty = stockQty + stockIncrease;

      // Update the stock with new quantities
      await pool.query`
        UPDATE stock_Ob
        SET retailQty = ${newRetailQty}, op_quantity = ${newStockQty}, IsActive = '1'
        WHERE product = ${productId} AND batchNo = ${batchNo} AND expiryDate = ${expiryDate};
      `;

      console.log(
        `Stock updated: New Retail Qty = ${newRetailQty}, New Stock Qty = ${newStockQty}`
      );
    } else {
      console.error(
        "Product or Batch not found in stock_Ob with the given expiry date."
      );
    }
  } catch (error) {
    console.error("Error updating stock:", error);
    throw error;
  }
}

// async function reduceStock(productId, quantity,batchNo) {
//   try {
//     await pool.query`
//         UPDATE [elite_pos].[dbo].[stock_Ob]
//         SET [op_quantity] = [op_quantity] - ${quantity}
//         WHERE [Product] = ${productId} AND [batchNo]=${batchNo};
//     `;
//   } catch (error) {
//     console.error('Error reducing stock:', error);
//     throw error;
//   }
// };
 
const baseImageUrl = "http://localhost:5000/uploads/prescription/"; // Adjust based on your setup

exports.inpatientids = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Database Connection Error:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const query = `
      SELECT 
        sm.[id],
        sm.[saledate],
        sm.[paymentmode],
        sm.[customername] as selectcustomer,
        sm.[doctorname],
        rc.[name] as customername,
        rc.[mobileno],
        sm.[amount],
        sm.[cdAmount],
        sm.[igst],
        sm.[cgst],
        sm.[sgst],
        sm.[subtotal],
        sm.[cess],
        sm.[tcs],
        sm.[discMode],
        sm.[discount],
        sm.[roundoff],
        sm.[netAmount],
        sm.[isDraft],
CASE 
    WHEN sm.[prescriptionimage] IS NOT NULL AND sm.[prescriptionimage] != '' 
    THEN CONCAT('${baseImageUrl}', sm.[prescriptionimage]) 
    ELSE NULL 
END AS prescriptionimage

      FROM 
        [elite_pos].[dbo].[inpatient_Master] sm
      LEFT JOIN 
        [elitePOS_MedWell].[dbo].[reg_patient] rc ON sm.[customername] = rc.[id]
    `;

    pool.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error("Query Execution Error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Debugging: Check if the backend is sending the image URL
      console.log("Backend Response Data:", result.recordset);

      res.json({ data: result.recordset });
    });
  });
};


exports.inpatientproductid = (req, res) => {
  const purchaseId = req.query.purchaseId;
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
SELECT 
  pt.Id,
  pt.product, 
  p.productname,
  dm.discMode,
  pt.batchNo,
  pt.expiryDate,
  pt.tax,
  pt.quantity,
  pt.free,
  pt.uom,
  pt.purcRate,
  pt.mrp,
  pt.rate,
  pt.discount,
  pt.amount,
  pt.cgst,
  pt.sgst,
  pt.igst,
  pt.totalAmount,

  -- Return data fields with COALESCE to handle null values
  COALESCE(rt.salesreturnid, 0) AS salesreturnid,
  COALESCE(rt.quantity, 0) AS returnQuantity,
  COALESCE(rt.free, 0) AS returnFree,
  COALESCE(rt.totalAmount, 0) AS returnTotalAmount
FROM 
  [elite_pos].[dbo].[inpatient_Trans] pt
JOIN
  [elite_pos].[dbo].[product] p ON pt.product = p.id
JOIN
  [elite_pos].[dbo].[discmode] dm ON pt.discMode = dm.id
LEFT JOIN
  [elite_pos].[dbo].[inpatientreturn_Trans] rt ON pt.Id = rt.salesreturnid
WHERE 
  pt.salesId = '${purchaseId}';

`;

    pool.query(query, (err, result) => {
      connection.release();

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      res.json({
        data: result.recordset.map((row) => ({
          ...row,
          product: row.productname,
        })),
      });
    });
  });
};

exports.inpatientdelete = async (req, res) => {
  const salesId = req.params.id;

  try {
    await poolConnect();

    if (!salesId) {
      throw new Error("No salesId provided");
    }

    // Fetch the isDraft status for the salesId
    const salesRecordResult = await pool.query`
      SELECT isDraft 
      FROM inpatient_Master 
      WHERE [id] = ${salesId};
    `;

    if (salesRecordResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sales record not found",
      });
    }

    const { isDraft } = salesRecordResult.recordset[0];
    console.log(`Sales ID ${salesId} isDraft Value:`, isDraft);

    // Ensure correct type for comparison
    if (Number(isDraft) !== 1) {
      console.log(
        `Sales ID ${salesId} is not a draft. Updating stock quantities.`
      );

      // Fetch associated transactions
      const transDetailsResult = await pool.query`
        SELECT Id, product, batchNo, quantity, free,expiryDate
        FROM inpatient_Trans
        WHERE [salesId] = ${salesId};
      `;

      const transactions = transDetailsResult.recordset;

      for (const transaction of transactions) {
        const { product, batchNo, free, quantity, expiryDate } = transaction;

        // Update stock quantities
        await increaseRetailStock(product, quantity, free, batchNo, expiryDate);
      }
    } else {
      console.log(`Sales ID ${salesId} is a draft. Skipping stock updates.`);
    }

    // Delete the master record
    await pool.query`
      DELETE FROM inpatient_Master
      WHERE [id] = ${salesId};
    `;

    // Delete associated transactions
    await pool.query`
      DELETE FROM inpatient_Trans
      WHERE [salesId] = ${salesId};
    `;

    res.status(200).json({
      success: true,
      message: `Sales ID ${salesId} and associated transactions deleted successfully.`,
    });
  } catch (error) {
    console.error("Error during salesretail deletion:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.inpatienttransdelete = async (req, res) => {
  const transactionId = req.params.id;

  try {
    await poolConnect();

    // Check if the parent sales record is in draft mode
    const salesRecordResult = await pool.query`
      SELECT M.isDraft
      FROM inpatient_Trans T
      INNER JOIN inpatient_Master M
      ON T.salesId = M.id
      WHERE T.Id = ${transactionId};
    `;

    if (salesRecordResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaction or parent sales record not found",
      });
    }

    const { isDraft } = salesRecordResult.recordset[0];
    console.log(`Transaction ID ${transactionId}, isDraft Value:`, isDraft);

    // Fetch transaction details
    const transactionDetailsResult = await pool.query`
      SELECT quantity, free, Product AS productId, batchNo,expiryDate
      FROM inpatient_Trans
      WHERE Id = ${transactionId};
    `;

    if (transactionDetailsResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found",
      });
    }

    const { quantity, free, productId, batchNo, expiryDate } =
      transactionDetailsResult.recordset[0];

    // Delete the transaction
    const deleteResult = await pool.query`
      DELETE FROM inpatient_Trans
      WHERE Id = ${transactionId};
    `;

    if (deleteResult.rowsAffected[0] > 0) {
      // Only update stock if the sales record is not in draft mode
      if (isDraft === 0) {
        await increaseRetailStock(
          productId,
          quantity,
          free,
          batchNo,
          expiryDate
        );
        console.log(
          `Stock updated for Product: ${productId}, Batch: ${batchNo}`
        );
      } else {
        console.log(
          `Stock update skipped as the sales record is in draft mode.`
        );
      }

      return res.json({
        success: true,
        message: "Transaction deleted successfully",
      });
    } else {
      return res.status(404).json({
        success: false,
        error: "Failed to delete transaction",
      });
    }
  } catch (error) {
    console.error("Error during transaction deletion:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
};

exports.inpatientregister = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
 SELECT 
    sm.[id] ,
    sm.[saledate],
    sm.[paymentmode],
    sm.[doctorname],
    rc.[name] as customername,
    rc.[mobileno],
    sm.[amount],
    sm.[cdAmount],
    sm.[igst],
    sm.[cgst],
    sm.[sgst],
    sm.[subtotal],
    sm.[cess],
    sm.[tcs],
    sm.[discMode],
    sm.[discount],
    sm.[roundoff],
    sm.[netAmount],
    sm.[isDraft],
     dbo.GetBillMargin(sm.id) as billmargin
FROM 
    [elite_pos].[dbo].[inpatient_Master] sm
LEFT JOIN 
    [elitePOS_MedWell].[dbo].[reg_patient] rc ON sm.[customername] = rc.[id] 

    where  sm.[isDraft]='0';
   ;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.salesretailreturn = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
 SELECT 
    SM.*, 
    RC.customername as customer, 
    RC.mobileno ,
    SM.subtotal - SRT.totalAmount AS Amt
FROM 
    inpatientregreturn_Trans SRT 
INNER JOIN 
    inpatient_Trans ST ON SRT.salesreturnid = ST.id
INNER JOIN 
    inpatient_Master SM ON SM.id = ST.salesId
LEFT JOIN 
    retailcustomer RC ON SM.customername = RC.id; 
    
   ;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.inpatientdraft = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
  SELECT 
    sm.[id] ,
    sm.[saledate],
    sm.[paymentmode],
    sm.[doctorname],
    rc.[customername],
    rc.[mobileno],
    sm.[amount],
    sm.[cdAmount],
    sm.[igst],
    sm.[cgst],
    sm.[sgst],
    sm.[subtotal],
    sm.[cess],
    sm.[tcs],
    sm.[discMode],
    sm.[discount],
    sm.[roundoff],
    sm.[netAmount],
    sm.[isDraft],
     dbo.GetBillMargin(sm.id) as billmargin
FROM 
    inpatient_Master sm
LEFT JOIN 
   retailcustomer rc ON sm.customername = rc.[id]
    where isDraft = 1;
    
   ;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};
//salesretail


/**
 * Get Single RegCustomer by regid
 */
exports.getRegCustomers = async (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      "SELECT * FROM [elitePOS_MedWell].[dbo].[reg_patient] WHERE IsActive = 1 ORDER BY lastvisited DESC;",
      (err, result) => {
        connection.release(); // Release the connection back to the pool

        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};


/**
 * Update RegCustomer Details
 */
exports.updateRegCustomer = async (req, res) => {
  await poolConnect(); // Ensure database connection
  const { regid } = req.params;
  const { name, mobileno, dob, gender, address, city, state, country, pincode, age } = req.body;

  try {
    const query = `
      UPDATE [elitePOS_MedWell].[dbo].[reg_patient]
      SET name = @name, mobileno = @mobileno, dob = @dob, gender = @gender, 
          address = @address, city = @city, state = @state, country = @country, 
          pincode = @pincode, age = @age, lastvisited = GETDATE()
      WHERE regid = @regid AND IsActive = 1
    `;

    const result = await pool
      .request()
      .input("regid", sql.NVarChar(10), regid)
      .input("name", sql.NVarChar(255), name)
      .input("mobileno", sql.NVarChar(255), mobileno)
      .input("dob", sql.Date, dob)
      .input("gender", sql.NVarChar(10), gender)
      .input("address", sql.NVarChar(255), address)
      .input("city", sql.NVarChar(255), city)
      .input("state", sql.NVarChar(255), state)
      .input("country", sql.NVarChar(255), country)
      .input("pincode", sql.NVarChar(10), pincode)
      .input("age", sql.Int, age)
      .query(query);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "RegCustomer not found or not active." });
    }

    return res.status(200).json({ message: "RegCustomer updated successfully." });
  } catch (error) {
    console.error("Error updating RegCustomer:", error);
    return res.status(500).json({ error: "Failed to update RegCustomer." });
  }
};

/**
 * Delete RegCustomer (Soft Delete)
 */
exports.deleteRegCustomer = async (req, res) => {
  await poolConnect(); // Ensure database connection
  const { regid } = req.params;

  try {
    const query = "UPDATE [elitePOS_MedWell].[dbo].[reg_patient] SET IsActive = 0 WHERE regid = @regid";
    const result = await pool.request().input("regid", sql.NVarChar(10), regid).query(query);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "RegCustomer not found." });
    }

    return res.status(200).json({ message: "RegCustomer deleted successfully." });
  } catch (error) {
    console.error("Error deleting RegCustomer:", error);
    return res.status(500).json({ error: "Failed to delete RegCustomer." });
  }
};

///avinilabs

exports.checkMobileNumberavini = (req, res) => {
  const mobile = req.query.mobileno; // Ensure this matches the query parameter name
  console.log("Received mobile number:", mobile); // Log the received mobile number

  if (!mobile) {
    return res.status(400).json({ error: "Mobile number is required" });
  }

  // Connect to the database using the pool
  pool
    .connect()
    .then((connection) => {
      console.log("Database connected successfully");

      // Use the correct sql type for input binding
      return connection
        .request()
        .input("mobile", sql.NVarChar, mobile) // Correctly use sql.NVarChar
        .query(
          "SELECT * FROM [AviniLabs].[dbo].[customers] WHERE mobileno = @mobile"
        );
    })
    .then((result) => {
      console.log("Query Result:", result); // Log the result

      if (result.recordset.length > 0) {
        res.json({ data: result.recordset });
      } else {
        res.json({ data: [] });
      }
    })
    .catch((err) => {
      console.error("Error during query execution:", err); // Log the error message
      res.status(500).json({
        error: "Internal Server Error",
        message: err.message, // Include the actual error message for debugging
        stack: err.stack, // Optionally, include the stack trace
      });
    });
};

exports.addCustomeravini = async (req, res) => {
  const { customername, mobileno, dob, gender, address, city, state } =
    req.body;

  // Check if mobile number already exists in the database
  const checkQuery = `
    SELECT COUNT(*) AS count
    FROM [AviniLabs].[dbo].[customers]
    WHERE mobileno = @mobileno
  `;

  try {
    const existingMobile = await pool
      .request()
      .input("mobileno", sql.NVarChar(255), mobileno)
      .query(checkQuery);

    if (existingMobile.recordset[0].count > 0) {
      return res.status(400).json({ error: "Mobile number already subscribed." });
    }

    // Proceed to add customer if no duplicate found
    const query = `
      INSERT INTO [AviniLabs].[dbo].[customers]
        ([customername], [mobileno], [dob], [gender], [address], [city], [state])
      VALUES
        (@customername, @mobileno, @dob, @gender, @address, @city, @state)
    `;

    // Insert the new customer
    await pool
      .request()
      .input("customername", sql.NVarChar(255), customername)
      .input("mobileno", sql.NVarChar(255), mobileno)
      .input("dob", sql.Date, dob)
      .input("gender", sql.NVarChar(255), gender)
      .input("address", sql.NVarChar(255), address)
      .input("city", sql.NVarChar(255), city)
      .input("state", sql.NVarChar(255), state)
      .query(query);

    return res.status(200).json({ message: "Subscription added successfully" });
  } catch (error) {
    console.error(
      "Error occurred while processing customer data:",
      error.message || error
    );
    return res
      .status(500)
      .json({ error: "Failed to add customer. Please try again later." });
  }
};

/*****customerretail */
exports.checkMobileNumber = async (req, res) => {
  const { mobileno } = req.body;

  // Validate the mobile number
  if (!mobileno || mobileno.length !== 10) {
    return res
      .status(400)
      .json({ error: "Invalid mobile number. It must be 10 digits long." });
  }

  const query =
    "SELECT COUNT(*) as count FROM [elite_pos].[dbo].[retailcustomer] WHERE mobileno = ?";

  try {
    const [result] = await pool.query(query, [mobileno]);
    const exists = result[0].count > 0; // Check if count is greater than 0
    res.json({ exists }); // Return response with exists status
  } catch (err) {
    console.error("Error checking mobile number:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.customerretailadd = async (req, res) => {
  const { customername, mobileno, salesman } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("customername", sql.VarChar(255), customername || null)
      .input("mobileno", sql.NVarChar(255), mobileno || null)
      .input("salesman", sql.NVarChar(255), salesman || null)
      .execute("Addcustomerretail");

    console.log(result);
    console.log(result.toString());

    // Redirect to another route after processing
    return res.redirect("/salesretail");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.customerretaildelete = async (req, res) => {
  const uomId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("uomId", /* Assuming your parameter type is INT */ sql.Int, uomId)
      .execute("Deletecustomerretail");

    if (result.rowsAffected[0] > 0) {
      return res.json({ success: true, message: "uomId deleted successfully" });
    } else {
      return res.status(404).json({ success: false, error: "uomId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.customerretailedit = async (req, res) => {
  const uomId = req.params.id;

  // Extract the product data from the request body
  const { customername, mobileno, salesman } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.query`
      UPDATE [elite_pos].[dbo].[retailcustomer]
      SET
      customername = ${customername},
      mobileno = ${mobileno},
      salesman=${salesman}
      WHERE
        id = ${uomId}
    `;

    console.log(result);
    console.log(result.toString());

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "uomId Type updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., product ID not found)
      return res.status(404).json({ success: false, error: "uomId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.customerretail = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    connection.query("EXEC Getcustomerdetail", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};


exports.Getinpatient = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    connection.query("EXEC Getinpatient", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

/*****customerretail */

//moleculescombination
exports.moleculescombination = async (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    connection.query("EXEC Getmoleculescombination", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

//moleculescombination
//package

exports.packageadd = async (req, res) => {
  const { packagename } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()

      .input("packagename", sql.VarChar(255), packagename || null)
      .execute("Addpackage");

    console.log(result);
    console.log(result.toString());

    // Redirect to another route after processing
    return res.redirect("/package");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.packagedelete = async (req, res) => {
  const uomId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("uomId", /* Assuming your parameter type is INT */ sql.Int, uomId)
      .execute("Deletepackage");

    if (result.rowsAffected[0] > 0) {
      return res.json({ success: true, message: "uomId deleted successfully" });
    } else {
      return res.status(404).json({ success: false, error: "uomId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.packageedit = async (req, res) => {
  const uomId = req.params.id;

  // Extract the product data from the request body
  const { packagename } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.query`
      UPDATE [elite_pos].[dbo].[package]
      SET
     
      packagename = ${packagename}
      WHERE
        id = ${uomId}
    `;

    console.log(result);
    console.log(result.toString());

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "uomId Type updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., product ID not found)
      return res.status(404).json({ success: false, error: "uomId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.package = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    connection.query("EXEC Getpackage", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

//package

//combinemolecules

exports.combinedmoleculesadd = async (req, res) => {
  const { combinationcode, combinationname } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("combinationcode", sql.NVarChar(100), combinationcode || null)
      .input("combinationname", sql.NVarChar(sql.MAX), combinationname || null)
      .execute("Addcombinedmolecules");

    console.log(result);
    console.log(result.toString());

    // Redirect to another route after processing
    return res.redirect("/combinedmolecules");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.combinedmoleculesdelete = async (req, res) => {
  const uomId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("uomId", /* Assuming your parameter type is INT */ sql.Int, uomId)
      .execute("Deletecombinedmolecules");

    if (result.rowsAffected[0] > 0) {
      return res.json({ success: true, message: "uomId deleted successfully" });
    } else {
      return res.status(404).json({ success: false, error: "uomId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.combinedmoleculesedit = async (req, res) => {
  const uomId = req.params.id;

  // Extract the product data from the request body
  const { combinationcode, combinationname } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.query`
      UPDATE [elite_pos].[dbo].[combinationmolecules]
      SET
      combinationcode = ${combinationcode},
      combinationname = ${combinationname}

      WHERE
        id = ${uomId}
    `;

    console.log(result);
    console.log(result.toString());

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "uomId Type updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., product ID not found)
      return res.status(404).json({ success: false, error: "uomId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.combinedmolecules = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    connection.query("EXEC Getcombinedmolecules", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

//combinedmolecules

//molecules

exports.moleculesadd = async (req, res) => {
  const { moleculecode, moleculename } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("moleculecode", sql.NVarChar(100), moleculecode || null)
      .input("moleculename", sql.NVarChar(50), moleculename || null)
      .execute("Addmolecules");

    console.log(result);
    console.log(result.toString());

    // Redirect to another route after processing
    return res.redirect("/molecules");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.moleculesdelete = async (req, res) => {
  const uomId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("uomId", /* Assuming your parameter type is INT */ sql.Int, uomId)
      .execute("DeleteMolecules");

    if (result.rowsAffected[0] > 0) {
      return res.json({ success: true, message: "uomId deleted successfully" });
    } else {
      return res.status(404).json({ success: false, error: "uomId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.moleculesedit = async (req, res) => {
  const uomId = req.params.id;

  // Extract the product data from the request body
  const { moleculecode, moleculename } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.query`
      UPDATE [elite_pos].[dbo].[molecules]
      SET
      moleculecode = ${moleculecode},
      moleculename = ${moleculename}
      WHERE
        id = ${uomId}
    `;

    console.log(result);
    console.log(result.toString());

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "uomId Type updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., product ID not found)
      return res.status(404).json({ success: false, error: "uomId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.molecules = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    connection.query("EXEC GetMolecules", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

//molecules

//salesretailreturn retail

exports.salesretailreturnDetails = async (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const query =
      "SELECT * FROM [elite_pos].[dbo].[salesretailreturn_Master]";

    pool.query(query, (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      res.json({ data: result.recordset });
    });
  });
};

exports.salesretailreturnadd = async (req, res) => {
  console.log("Received Data:", req.body);

  const {
    id: salesreturnid,
    saledate,
    paymentmode,
    customername,
    pamount,
    pigst,
    pcgst,
    psgst,
    psubtotal,
    pcess,
    ptcs,
    proundOff,
    pnetAmount,
    pdiscount,
    pdiscMode_,
    isDraft,
    products,
  } = req.body;

  if (!Array.isArray(products)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid products data format" });
  }

  let transaction;
  try {
    // Establish connection to the pool
    const poolConnection = await pool.connect();

    // Create and begin a transaction
    transaction = new sql.Transaction(poolConnection);
    await transaction.begin();

    // Insert into master table
    const result = await transaction
      .request()
      .input("salesreturnid", salesreturnid)
      .input("saledate", saledate || null)
      .input("paymentmode", paymentmode)
      .input("customername", customername)
      .input("amount", pamount)
      .input("cgst", pcgst)
      .input("sgst", psgst)
      .input("igst", pigst)
      .input("netAmount", pnetAmount)
      .input("cess", pcess)
      .input("tcs", ptcs)
      .input("discMode", pdiscMode_)
      .input("discount", pdiscount)
      .input("subtotal", psubtotal)
      .input("roundoff", proundOff)
      .input("isDraft", isDraft).query(`
       INSERT INTO [elite_pos].[dbo].[salesretailreturn_Master]
([salesreturnid], [saledate], [paymentmode], [customername], 
[amount],  [cgst], [sgst], [igst], [netAmount], [cess], [tcs], 
[discMode], [discount], [subtotal], [roundoff], [isDraft])
VALUES
(@salesreturnid, @saledate, @paymentmode,  @customername, 
@amount, @cgst, @sgst, @igst, @netAmount, @cess, @tcs, 
@discMode, @discount, @subtotal, @roundoff, @isDraft);
        SELECT SCOPE_IDENTITY() as salesId;
      `);
    const salesId = result.recordset[0].salesId;
    // Insert products into the transaction table
    for (const product of products) {
      const {
        Id,
        productId,
        batchNo,
        expiryDate,
        tax,
        quantity,
        free,
        uom,
        purcRate,
        mrp,
        rate,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;

      await transaction
        .request()
        .input("salesId", salesId)
        .input("product", productId)
        .input("batchNo", batchNo)
        .input("expiryDate", expiryDate)
        .input("tax", tax)
        .input("quantity", quantity)
        .input("free", free)
        .input("uom", uom)
        .input("purcRate", purcRate)
        .input("mrp", mrp)
        .input("rate", rate)
        .input("discMode", discMode)
        .input("discount", discount)
        .input("amount", amount)
        .input("cgst", cgst)
        .input("sgst", sgst)
        .input("igst", igst)
        .input("totalAmount", totalAmount)
        .input("salesreturnid", Id).query(`
          INSERT INTO [elite_pos].[dbo].[salesretailreturn_Trans]
          ([salesId], [product], [batchNo], [expiryDate], [tax], [quantity], 
          [free], [uom], [purcRate], [mrp], [rate], [discMode], [discount], 
          [amount], [cgst], [sgst], [igst], [totalAmount], [salesreturnid])
          VALUES
          (@salesId, @product, @batchNo, @expiryDate, @tax, @quantity, 
          @free, @uom, @purcRate, @mrp, @rate, @discMode, @discount, 
          @amount, @cgst, @sgst, @igst, @totalAmount, @salesreturnid);
        `);

      // Update stock (your function)
      await increaseRetailStock(productId, quantity, free, batchNo, expiryDate);
    }

    // Commit transaction
    await transaction.commit();
    res.status(200).json({
      success: true,
      message: "Sales retail return added successfully",
    });
  } catch (error) {
    console.error("Error during salesretailreturn processing:", error);

    if (transaction) {
      await transaction.rollback(); // Rollback on error
    }

    res.status(500).json({
      success: false,
      message: `Internal Server Error: ${error.message}`,
    });
  }
};


// async function reduceretailStock(productId, quantity, free, batchNo) {
//   try {
//     // Sum of quantity and free
//     const totalQuantity = Number(quantity) + Number(free);

//     // Fetch the current stock and retail quantity for the given product and batch number
//     const result = await pool.query`
//       SELECT op_quantity AS stockQty, retailQty FROM [elite_pos].[dbo].[stock_Ob]
//       WHERE product = ${productId} AND batchNo = ${batchNo};
//     `;

//     if (result.recordset.length > 0) {
//       let { stockQty, retailQty } = result.recordset[0];

//       // Calculate the new retail and stock quantities
//       const newRetailQty = retailQty - totalQuantity;
//       const stockReduction = (totalQuantity * stockQty) / retailQty;
//       const newStockQty = stockQty - stockReduction;

//       if (newRetailQty < 0 || newStockQty < 0) {
//         console.error("Calculated stock or retail quantity is negative.");
//         return;
//       }

//       // Update the stock with new quantities
//       await pool.query`
//         UPDATE [elite_pos].[dbo].[stock_Ob]
//         SET retailQty = ${newRetailQty}, op_quantity = ${newStockQty}
//         WHERE product = ${productId} AND batchNo = ${batchNo};
//       `;

//       console.log(
//         `Stock updated: New Retail Qty = ${newRetailQty}, New Stock Qty = ${newStockQty}`
//       );
//     } else {
//       console.error("Product or Batch not found in stock_Ob");
//     }
//   } catch (error) {
//     console.error("Error updating stock:", error);
//     throw error;
//   }
// }

exports.salesretailreturnEdit = async (req, res) => {
  const { purchaseId } = req.params;
  const { purchaseDetails, products } = req.body;
  try {
    console.log("Received request to edit purchase:", req.body);
    await pool.query`
        UPDATE [elite_pos].[dbo].[salesretailreturn_Master]
        SET
            [saledate] = ${purchaseDetails.saledate},
            [paymentmode] = ${purchaseDetails.paymentmode},
            [customermobileno] = ${purchaseDetails.customermobileno},
            [customername] = ${purchaseDetails.customername},
            [amount] = ${purchaseDetails.pamount},
            [cgst] = ${purchaseDetails.pcgst},
            [sgst] = ${purchaseDetails.psgst},
            [igst] = ${purchaseDetails.pigst},
            [netAmount] = ${purchaseDetails.pnetAmount},
            [cess] = ${purchaseDetails.pcess},
            [tcs] = ${purchaseDetails.ptcs},
            [discMode] = ${purchaseDetails.pdiscMode_},
            [discount] = ${purchaseDetails.pdiscount},
            [subtotal] = ${purchaseDetails.psubtotal},
            [roundoff] = ${purchaseDetails.proundOff},
          [isDraft] = ${purchaseDetails.isDraft}
        WHERE
            [id] = ${purchaseDetails.id};
    `;
    for (const product of products) {
      const {
        Id,
        productId,
        batchNo,
        tax,
        quantity,
        free,
        uom,
        purcRate,
        mrp,
        rate,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;
      if (Id) {
        await pool.query`
          UPDATE [elite_pos].[dbo].[salesretailreturn_Trans]
          SET
              [product] = ${productId},
              [batchNo] = ${batchNo},
              [tax] = ${tax},
              [quantity] = ${quantity},
              [free] = ${free},
              [uom] = ${uom},
              [purcRate]=${purcRate},
               [mrp]=${mrp},
              [rate] = ${rate},
              [discMode] = ${discMode},
              [discount] = ${discount},
              [amount] = ${amount},
              [cgst] = ${cgst},
              [sgst] = ${sgst},
              [igst] = ${igst},
              [totalAmount] = ${totalAmount}
          WHERE
              [Id] = ${Id};
        `;
      } else {
        await pool.query`
          INSERT INTO [elite_pos].[dbo].[salesretailreturn_Trans] ([salesId], [product], [batchNo], [tax], [quantity], [uom],[purcRate],[mrp], [rate], [discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
          VALUES ( ${purchaseDetails.id}, ${productId}, ${batchNo}, ${tax}, ${quantity}, ${uom},${purcRate},${mrp} ,${rate}, ${discMode}, ${discount}, ${amount}, ${cgst}, ${sgst}, ${igst}, ${totalAmount});
        `;
        await increaseRetailStock(productId, quantity, free, batchNo);
      }
    }
    console.log("salesretailreturn edited successfully");
    res
      .status(200)
      .json({
        success: true,
        message: "salesretailreturn edited successfully",
      });
  } catch (error) {
    console.error("Error updating salesretailreturn:", error);
    res
      .status(400)
      .json({ success: false, message: "Failed to update salesretailreturn" });
  }
};

// async function reduceStock(productId, quantity,batchNo) {
//   try {
//     await pool.query`
//         UPDATE [elite_pos].[dbo].[stock_Ob]
//         SET [op_quantity] = [op_quantity] - ${quantity}
//         WHERE [Product] = ${productId} AND [batchNo]=${batchNo};
//     `;
//   } catch (error) {
//     console.error('Error reducing stock:', error);
//     throw error;
//   }
// };

// async function increaseRetailStock(productId, quantity, free, batchNo) {
//   try {
//     // Sum of quantity and free
//     const totalQuantity = Number(quantity) + Number(free);

//     // Fetch the current stock and retail quantity for the given product and batch number
//     const result = await pool.query`
//       SELECT op_quantity AS stockQty, retailQty FROM [elite_pos].[dbo].[stock_Ob]
//       WHERE product = ${productId} AND batchNo = ${batchNo};
//     `;

//     if (result.recordset.length > 0) {
//       let { stockQty, retailQty } = result.recordset[0];

//       // Calculate the new retail and stock quantities
//       const newRetailQty = retailQty + totalQuantity;
//       const stockIncrease = (totalQuantity * stockQty) / retailQty;
//       const newStockQty = stockQty + stockIncrease;

//       // Update the stock with new quantities
//       await pool.query`
//         UPDATE [elite_pos].[dbo].[stock_Ob]
//         SET retailQty = ${newRetailQty}, op_quantity = ${newStockQty}
//         WHERE product = ${productId} AND batchNo = ${batchNo};
//       `;

//       console.log(
//         `Stock updated: New Retail Qty = ${newRetailQty}, New Stock Qty = ${newStockQty}`
//       );
//     } else {
//       console.error("Product or Batch not found in stock_Ob");
//     }
//   } catch (error) {
//     console.error("Error updating stock:", error);
//     throw error;
//   }
// }

exports.salesretailreturnids = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
                  SELECT *
                 
              FROM 
                  [elite_pos].[dbo].[salesretailreturn_Master] 
                  
              
              `;
    pool.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error("Error in fetching purchase IDs:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      res.header("Content-Type", "application/json");
      res.json({ data: result.recordset });
    });
  });
};

exports.salesretailreturnproductid = (req, res) => {
  const purchaseId = req.query.purchaseId;
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
    SELECT 
    pt.Id,
    pt.product, -- Assuming this is the product ID
    p.productname,
    dm.discMode,
    pt.batchNo,
    pt.tax,
    pt.quantity,
    pt.free,
    pt.uom,
    pt.purcRate,
     pt.mrp,
    pt.rate,
    pt.discount,
    pt.amount,
    pt.cgst,
    pt.sgst,
    pt.igst,
    pt.totalAmount
FROM 
    [elite_pos].[dbo].[salesretailreturn_Trans] pt
JOIN
    [elite_pos].[dbo].[product] p ON pt.product = p.id
JOIN
    [elite_pos].[dbo].[discmode] dm ON pt.discMode = dm.id
WHERE 
    pt.salesId = '${purchaseId}';
`;

    pool.query(query, (err, result) => {
      connection.release();

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      res.json({
        data: result.recordset.map((row) => ({
          ...row,
          product: row.productname,
        })),
      });
    });
  });
};

exports.salesretailreturndelete = async (req, res) => {
  const salesId = req.params.id;

  try {
    await poolConnect();

    if (!salesId) {
      throw new Error("No salesId provided");
    }

    // Fetch transaction details associated with the salesId
    const transDetailsResult = await pool.query`
      SELECT Id, product, batchNo, quantity,free, tax, uom, rate
      FROM [elite_pos].[dbo].[salesretailreturn_Trans]
      WHERE [salesId] = ${salesId};
    `;

    const transactions = transDetailsResult.recordset;

    // Iterate through each transaction
    for (const transaction of transactions) {
      const { product, batchNo, free, quantity } = transaction;

      // Increase the stock quantities
      await reduceretailStock(product, quantity, free, batchNo);
    }

    // Delete from sales_Master
    await pool.query`
      DELETE FROM [elite_pos].[dbo].[salesretailreturn_Master]
      WHERE [id] = ${salesId};
    `;

    // Delete associated products from sales_Trans
    await pool.query`
      DELETE FROM [elite_pos].[dbo].[salesretailreturn_Trans]
      WHERE [salesId] = ${salesId};
    `;

    res.status(200).json({
      success: true,
      message: "Sales retail and associated products deleted successfully",
    });
  } catch (error) {
    console.error("Error during salesretailreturn deletion:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.salesretailreturntransdelete = async (req, res) => {
  const transactionId = req.params.id;
  try {
    await poolConnect();

    const { recordset } = await pool
      .request()
      .input("transactionId", sql.Int, transactionId)
      .query(
        "SELECT quantity,free, Product, batchNo FROM [elite_pos].[dbo].[salesretailreturn_Trans] WHERE Id = @transactionId"
      );

    if (recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Purchased product not found" });
    }

    const { quantity, free, Product: productId, batchNo } = recordset[0];

    const result = await pool
      .request()
      .input("transactionId", sql.Int, transactionId)
      .query(
        "DELETE FROM [elite_pos].[dbo].[salesretailreturn_Trans] WHERE Id = @transactionId"
      );

    // Update the stock in the stock_Ob table based on the productId, batchNo, and retrieved quantity
    await reduceretailStock(productId, quantity, free, batchNo);

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Purchased product deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Purchased product not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.salesretailreturnregister = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
   SELECT 
	SM.* ,SM.subtotal - SRT.totalAmount AS Amt
FROM 
	salesretailreturn_Trans SRT 
	INNER JOIN salesretail_Trans ST ON SRT.salesreturnid = ST.id
	INNER JOIN salesretail_Master SM ON SM.id = ST.salesId
   ;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.salesretailreturndraft = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
    SELECT *
    FROM [elite_pos].[dbo].[salesretailreturn_Master] 
    where isDraft = 1;
    
   ;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};
//salesretailreturn

//salesretail retail

exports.salesretailDetails = async (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const query = `
      SELECT 
          sm.[id] ,
          sm.[saledate],
          sm.[paymentmode],
          sm.[doctorname],
          rc.[customername],
          rc.[mobileno],
          sm.[saledate],
          sm.[doctorname],
          sm.[amount],
          sm.[cdAmount],  
          sm.[igst],
          sm.[cgst],
          sm.[sgst],
          sm.[subtotal],
          sm.[cess],
          sm.[tcs],
          sm.[discMode],
          sm.[discount],
          sm.[roundoff],
          sm.[netAmount],
          sm.[isDraft]
      FROM 
          [elite_pos].[dbo].[salesretail_Master] sm
      LEFT JOIN 
          [elite_pos].[dbo].[retailcustomer] rc ON sm.[customername] = rc.[mobileno] -- Change the join condition if needed
    `;

    pool.query(query, (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      res.json({ data: result.recordset });
    });
  });
};

exports.salesretailadd = async (req, res) => {
  console.log(req.body);
  const {
    saledate,
    ppaymentMode,
    customerId, // Use customerId received from the client
    doctorname,
    pamount,
    pigst,
    pcgst,
    psgst,
    psubtotal,
    pcess,
    ptcs,
    proundOff,
    pnetAmount,
    pdiscount,
    pdiscMode_,
    isDraft,
    products: productsString,
  } = req.body;

  let parsedProducts = [];
  const formattedSaleDate = saledate ? saledate : null;

  try {
    await poolConnect();

    parsedProducts = JSON.parse(productsString);

    // Make sure customerId is being used correctly
    const result = await pool.query`
      INSERT INTO salesretail_Master
      ([saledate], [paymentmode], [customername],[doctorname] ,[amount], [cgst], [sgst], [igst], [netAmount], [cess], [tcs], [discMode], [discount], [subtotal], [roundoff], [isDraft])
      VALUES
      (${formattedSaleDate}, ${ppaymentMode}, ${customerId},${doctorname}, ${pamount}, ${pcgst}, ${psgst}, ${pigst}, ${pnetAmount}, ${pcess}, ${ptcs}, ${pdiscMode_}, ${pdiscount}, ${psubtotal}, ${proundOff}, ${isDraft});
    
      SELECT SCOPE_IDENTITY() as salesId;
    `;

    const salesId = result.recordset[0].salesId;
    console.log("Number of products:", parsedProducts.length);

    for (const product of parsedProducts) {
      const {
        productId,
        batchNo,
        expiryDate,
        tax,
        quantity,
        free,
        uom,
        purcRate,
        mrp,
        rate,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;

      await pool.query`
        INSERT INTO salesretail_Trans
        ([salesId], [product], [batchNo],[expiryDate], [tax], [quantity],[free], [uom],[purcRate], [mrp],[rate], [discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
        VALUES
        (${salesId}, ${productId}, ${batchNo},${expiryDate}, ${tax}, ${quantity}, ${free}, ${uom}, ${purcRate}, ${mrp}, ${rate}, ${discMode}, ${discount}, ${amount}, ${cgst}, ${sgst}, ${igst}, ${totalAmount});
      `;

      // Only call reduceretailStock if isDraft is 0 (indicating a confirmed sale)
     if (Number(isDraft) !== 1) {
       await reduceretailStock(productId, quantity, free, batchNo, expiryDate);
     }

    }

    res
      .status(200)
      .json({ success: true, message: "salesretail added successfully" });
  } catch (error) {
    console.error("Error during salesretail processing:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


async function reduceretailStock(
  productId,
  quantity,
  free,
  batchNo,
  expiryDate
) {
  try {
    // Sum of quantity and free
    const totalQuantity = Number(quantity) + Number(free);

    // Fetch the current stock and retail quantity for the given product, batch number, and expiry date
    const result = await pool.query`
      SELECT op_quantity AS stockQty, retailQty FROM stock_Ob
      WHERE product = ${productId} AND batchNo = ${batchNo} AND expiryDate = ${expiryDate};
    `;

    if (result.recordset.length > 0) {
      let { stockQty, retailQty } = result.recordset[0];

      // Calculate the new retail and stock quantities
      const newRetailQty = retailQty - totalQuantity;
      const stockReduction = (totalQuantity * stockQty) / retailQty;
      const newStockQty = stockQty - stockReduction;

      if (newRetailQty < 0 || newStockQty < 0) {
        console.error("Calculated stock or retail quantity is negative.");
        return;
      }

      // Update the stock with new quantities
      await pool.query`
        UPDATE stock_Ob
        SET retailQty = ${newRetailQty}, op_quantity = ${newStockQty}
        WHERE product = ${productId} AND batchNo = ${batchNo} AND expiryDate = ${expiryDate};
      `;

      console.log(
        `Stock updated: New Retail Qty = ${newRetailQty}, New Stock Qty = ${newStockQty}`
      );
    } else {
      console.error(
        "Product or Batch not found in stock_Ob with the given expiry date."
      );
    }
  } catch (error) {
    console.error("Error updating stock:", error);
    throw error;
  }
}


exports.salesretailEdit = async (req, res) => {
  const { id } = req.params;
  const { purchaseDetails, products } = req.body;

  try {
    console.log("Received request to edit purchase:", req.body);

    // Update salesretail_Master
    await pool.query`
      UPDATE salesretail_Master
      SET
          [saledate] = ${purchaseDetails.saledate}, 
          [paymentmode] = ${purchaseDetails.paymentmode},
          [customername] = ${purchaseDetails.customername},
          [doctorname] = ${purchaseDetails.doctorname},
          [amount] = ${purchaseDetails.pamount},
          [cgst] = ${purchaseDetails.pcgst},
          [sgst] = ${purchaseDetails.psgst},
          [igst] = ${purchaseDetails.pigst},
          [netAmount] = ${purchaseDetails.pnetAmount},
          [cess] = ${purchaseDetails.pcess},
          [tcs] = ${purchaseDetails.ptcs},
          [discMode] = ${purchaseDetails.pdiscMode_},
          [discount] = ${purchaseDetails.pdiscount},
          [subtotal] = ${purchaseDetails.psubtotal},
          [roundoff] = ${purchaseDetails.proundOff},
          [isDraft] = ${purchaseDetails.isDraft}
      WHERE
          [id] = ${id};
    `;

    // Iterate through each product in the products array
    for (const product of products) {
      const {
        Id,
        productId,
        batchNo,
        expiryDate,
        tax,
        quantity,
        free,
        uom,
        purcRate,
        mrp,
        rate,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;

      // If the product already exists in the database (i.e., it's being updated)
      if (Id) {
        await pool.query`
          UPDATE salesretail_Trans
          SET
              [product] = ${productId},
              [batchNo] = ${batchNo},
              [expiryDate] = ${expiryDate},
              [tax] = ${tax},
              [quantity] = ${quantity},
              [free] = ${free},
              [uom] = ${uom},
              [purcRate] = ${purcRate},
              [mrp] = ${mrp},
              [rate] = ${rate},
              [discMode] = ${discMode},
              [discount] = ${discount},
              [amount] = ${amount},
              [cgst] = ${cgst},
              [sgst] = ${sgst},
              [igst] = ${igst},
              [totalAmount] = ${totalAmount}
          WHERE
              [Id] = ${Id};
        `;

        if (purchaseDetails.isDraft != 1) {
          // Loose equality check
          console.log("Attempting to reduce stock for existing product...");
          await reduceretailStock(
            productId,
            quantity,
            free,
            batchNo,
            expiryDate
          );
        }
      } else {
        // If the product is being added (i.e., it's a new product in the transaction)
        await pool.query`
          INSERT INTO salesretail_Trans ([salesId], [product], [batchNo], [expiryDate], [tax], [quantity], [uom], [purcRate], [mrp], [rate], [discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
          VALUES (${purchaseDetails.id}, ${productId}, ${batchNo}, ${expiryDate}, ${tax}, ${quantity}, ${uom}, ${purcRate}, ${mrp}, ${rate}, ${discMode}, ${discount}, ${amount}, ${cgst}, ${sgst}, ${igst}, ${totalAmount});
        `;

        if (purchaseDetails.isDraft != 1) {
          // Loose equality check
          console.log("Attempting to reduce stock for new product...");
          await reduceretailStock(
            productId,
            quantity,
            free,
            batchNo,
            expiryDate
          );
        }
      }
    }

    console.log("salesretail edited successfully");
    res
      .status(200)
      .json({ success: true, message: "salesretail edited successfully" });
  } catch (error) {
    console.error("Error updating salesretail:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update salesretail",
    });
  }
};


async function increaseRetailStock(
  productId,
  quantity,
  free,
  batchNo,
  expiryDate
) {
  try {
    // Sum of quantity and free
    const totalQuantity = Number(quantity) + Number(free);

    // Fetch the current stock and retail quantity for the given product, batch number, and expiry date
    const result = await pool.query`
      SELECT op_quantity AS stockQty, retailQty FROM stock_Ob
      WHERE product = ${productId} AND batchNo = ${batchNo} AND expiryDate = ${expiryDate};
    `;

    if (result.recordset.length > 0) {
      let { stockQty, retailQty } = result.recordset[0];

      // Treat stockQty as 0 if it's NULL
      stockQty = stockQty || 0;

      // Treat retailQty as 0 if it's NULL (if needed, modify based on your logic)
      retailQty = retailQty || 0;

      // Calculate the new retail quantity and stock quantity
      const newRetailQty = retailQty + totalQuantity;

      // Avoid division by zero if retailQty is zero
      const stockIncrease =
        retailQty > 0 ? (totalQuantity * stockQty) / retailQty : totalQuantity;

      const newStockQty = stockQty + stockIncrease;

      // Update the stock with new quantities
      await pool.query`
        UPDATE stock_Ob
        SET retailQty = ${newRetailQty}, op_quantity = ${newStockQty}, IsActive = '1'
        WHERE product = ${productId} AND batchNo = ${batchNo} AND expiryDate = ${expiryDate};
      `;

      console.log(
        `Stock updated: New Retail Qty = ${newRetailQty}, New Stock Qty = ${newStockQty}`
      );
    } else {
      console.error(
        "Product or Batch not found in stock_Ob with the given expiry date."
      );
    }
  } catch (error) {
    console.error("Error updating stock:", error);
    throw error;
  }
}



// async function reduceStock(productId, quantity,batchNo) {
//   try {
//     await pool.query`
//         UPDATE [elite_pos].[dbo].[stock_Ob]
//         SET [op_quantity] = [op_quantity] - ${quantity}
//         WHERE [Product] = ${productId} AND [batchNo]=${batchNo};
//     `;
//   } catch (error) {
//     console.error('Error reducing stock:', error);
//     throw error;
//   }
// };


exports.salesretailids = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const query = `
            SELECT 
    sm.[id] ,
    sm.[saledate],
    sm.[paymentmode],
    sm.[customername] as selectcustomer,
    sm.[doctorname],
    rc.[customername],
    rc.[mobileno],
    sm.[amount],
    sm.[cdAmount],
    sm.[igst],
    sm.[cgst],
    sm.[sgst],
    sm.[subtotal],
    sm.[cess],
    sm.[tcs],
    sm.[discMode],
    sm.[discount],
    sm.[roundoff],
    sm.[netAmount],
    sm.[isDraft]
FROM 
    [elite_pos].[dbo].[salesretail_Master] sm
LEFT JOIN 
    [elite_pos].[dbo].[retailcustomer] rc ON sm.[customername] = rc.[id] 
        `;

    pool.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error("Error in fetching sales retail IDs:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      res.header("Content-Type", "application/json");
      res.json({ data: result.recordset });
    });
  });
};

exports.salesretailproductid = (req, res) => {
  const purchaseId = req.query.purchaseId;
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
SELECT 
  pt.Id,
  pt.product, 
  p.productname,
  dm.discMode,
  pt.batchNo,
  pt.expiryDate,
  pt.tax,
  pt.quantity,
  pt.free,
  pt.uom,
  pt.purcRate,
  pt.mrp,
  pt.rate,
  pt.discount,
  pt.amount,
  pt.cgst,
  pt.sgst,
  pt.igst,
  pt.totalAmount,

  -- Return data fields with COALESCE to handle null values
  COALESCE(rt.salesreturnid, 0) AS salesreturnid,
  COALESCE(rt.quantity, 0) AS returnQuantity,
  COALESCE(rt.free, 0) AS returnFree,
  COALESCE(rt.totalAmount, 0) AS returnTotalAmount
FROM 
  [elite_pos].[dbo].[salesretail_Trans] pt
JOIN
  [elite_pos].[dbo].[product] p ON pt.product = p.id
JOIN
  [elite_pos].[dbo].[discmode] dm ON pt.discMode = dm.id
LEFT JOIN
  [elite_pos].[dbo].[salesretailreturn_Trans] rt ON pt.Id = rt.salesreturnid
WHERE 
  pt.salesId = '${purchaseId}';

`;

    pool.query(query, (err, result) => {
      connection.release();

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      res.json({
        data: result.recordset.map((row) => ({
          ...row,
          product: row.productname,
        })),
      });
    });
  });
};

exports.salesretaildelete = async (req, res) => {
  const salesId = req.params.id;

  try {
    await poolConnect();

    if (!salesId) {
      throw new Error("No salesId provided");
    }

    // Fetch the isDraft status for the salesId
    const salesRecordResult = await pool.query`
      SELECT isDraft 
      FROM salesretail_Master 
      WHERE [id] = ${salesId};
    `;

    if (salesRecordResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sales record not found",
      });
    }

    const { isDraft } = salesRecordResult.recordset[0];
    console.log(`Sales ID ${salesId} isDraft Value:`, isDraft);

    // Ensure correct type for comparison
    if (Number(isDraft) !== 1) {
      console.log(
        `Sales ID ${salesId} is not a draft. Updating stock quantities.`
      );

      // Fetch associated transactions
      const transDetailsResult = await pool.query`
        SELECT Id, product, batchNo, quantity, free,expiryDate
        FROM salesretail_Trans
        WHERE [salesId] = ${salesId};
      `;

      const transactions = transDetailsResult.recordset;

      for (const transaction of transactions) {
        const { product, batchNo, free, quantity, expiryDate } = transaction;

        // Update stock quantities
        await increaseRetailStock(product, quantity, free, batchNo, expiryDate);
      }
    } else {
      console.log(`Sales ID ${salesId} is a draft. Skipping stock updates.`);
    }

    // Delete the master record
    await pool.query`
      DELETE FROM salesretail_Master
      WHERE [id] = ${salesId};
    `;

    // Delete associated transactions
    await pool.query`
      DELETE FROM salesretail_Trans
      WHERE [salesId] = ${salesId};
    `;

    res.status(200).json({
      success: true,
      message: `Sales ID ${salesId} and associated transactions deleted successfully.`,
    });
  } catch (error) {
    console.error("Error during salesretail deletion:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.salesretailtransdelete = async (req, res) => {
  const transactionId = req.params.id;

  try {
    await poolConnect();

    // Check if the parent sales record is in draft mode
    const salesRecordResult = await pool.query`
      SELECT M.isDraft
      FROM salesretail_Trans T
      INNER JOIN salesretail_Master M
      ON T.salesId = M.id
      WHERE T.Id = ${transactionId};
    `;

    if (salesRecordResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaction or parent sales record not found",
      });
    }

    const { isDraft } = salesRecordResult.recordset[0];
    console.log(`Transaction ID ${transactionId}, isDraft Value:`, isDraft);

    // Fetch transaction details
    const transactionDetailsResult = await pool.query`
      SELECT quantity, free, Product AS productId, batchNo,expiryDate
      FROM salesretail_Trans
      WHERE Id = ${transactionId};
    `;

    if (transactionDetailsResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found",
      });
    }

    const { quantity, free, productId, batchNo,expiryDate } =
      transactionDetailsResult.recordset[0];

    // Delete the transaction
    const deleteResult = await pool.query`
      DELETE FROM salesretail_Trans
      WHERE Id = ${transactionId};
    `;

    if (deleteResult.rowsAffected[0] > 0) {
      // Only update stock if the sales record is not in draft mode
      if (isDraft === 0) {
        await increaseRetailStock(productId, quantity, free, batchNo,expiryDate);
        console.log(
          `Stock updated for Product: ${productId}, Batch: ${batchNo}`
        );
      } else {
        console.log(
          `Stock update skipped as the sales record is in draft mode.`
        );
      }

      return res.json({
        success: true,
        message: "Transaction deleted successfully",
      });
    } else {
      return res.status(404).json({
        success: false,
        error: "Failed to delete transaction",
      });
    }
  } catch (error) {
    console.error("Error during transaction deletion:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
};

exports.salesretailregister = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
 SELECT 
    sm.[id] ,
    sm.[saledate],
    sm.[paymentmode],
    sm.[doctorname],
    rc.[customername],
    rc.[mobileno],
    sm.[amount],
    sm.[cdAmount],
    sm.[igst],
    sm.[cgst],
    sm.[sgst],
    sm.[subtotal],
    sm.[cess],
    sm.[tcs],
    sm.[discMode],
    sm.[discount],
    sm.[roundoff],
    sm.[netAmount],
    sm.[isDraft],
     dbo.GetBillMargin(sm.id) as billmargin
FROM 
    [elite_pos].[dbo].[salesretail_Master] sm
LEFT JOIN 
    [elite_pos].[dbo].[retailcustomer] rc ON sm.[customername] = rc.[id] 

    where  sm.[isDraft]='0';
   ;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.salesretailreturn = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
 SELECT 
    SM.*, 
    RC.customername as customer, 
    RC.mobileno ,
    SM.subtotal - SRT.totalAmount AS Amt
FROM 
    salesretailreturn_Trans SRT 
INNER JOIN 
    salesretail_Trans ST ON SRT.salesreturnid = ST.id
INNER JOIN 
    salesretail_Master SM ON SM.id = ST.salesId
LEFT JOIN 
    retailcustomer RC ON SM.customername = RC.id; 
    
   ;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.salesretaildraft = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
  SELECT 
    sm.[id] ,
    sm.[saledate],
    sm.[paymentmode],
    sm.[doctorname],
    rc.[customername],
    rc.[mobileno],
    sm.[amount],
    sm.[cdAmount],
    sm.[igst],
    sm.[cgst],
    sm.[sgst],
    sm.[subtotal],
    sm.[cess],
    sm.[tcs],
    sm.[discMode],
    sm.[discount],
    sm.[roundoff],
    sm.[netAmount],
    sm.[isDraft],
     dbo.GetBillMargin(sm.id) as billmargin
FROM 
    salesretail_Master sm
LEFT JOIN 
   retailcustomer rc ON sm.customername = rc.[id]
    where isDraft = 1;
    
   ;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};
//salesretail

//menu access/user
exports.updateCheckbox = async (req, res) => {
  try {
    const {
      id,
      Accountant,
      Admin,
      Manager,
      Purchase,
      Sales,
      SuperAdmin,
      User,
    } = req.body;

    // Call the stored procedure
    await updateCheckboxData(
      id,
      Accountant,
      Admin,
      Manager,
      Purchase,
      Sales,
      SuperAdmin,
      User
    );

    res.status(200).send("Checkbox data updated successfully");
  } catch (error) {
    console.error("Error updating checkbox data:", error.message);
    res.status(500).send("Internal server error");
  }
};

// Function to call the stored procedure to update checkbox data
async function updateCheckboxData(
  id,
  Accountant,
  Admin,
  Manager,
  Purchase,
  Sales,
  SuperAdmin,
  User
) {
  try {
    const poolRequest = pool
      .request()
      .input("id", sql.Int, id)
      .input("Accountant", sql.Bit, Accountant)
      .input("Admin", sql.Bit, Admin)
      .input("Manager", sql.Bit, Manager)
      .input("Purchase", sql.Bit, Purchase)
      .input("Sales", sql.Bit, Sales)
      .input("SuperAdmin", sql.Bit, SuperAdmin)
      .input("User", sql.Bit, User);

    await poolRequest.execute("dbo.UpdateCheckboxData");
    console.log("Checkbox data updated successfully");
  } catch (error) {
    console.error("Error updating checkbox data in database:", error.message);
    throw error;
  }
}

// Function to update database with checkbox data
async function updateDatabase(data) {
  try {
    console.log("Data received:", data);

    const query = `
      UPDATE menu_access_rights
      SET 
        Accountant = @Accountant,
        Admin = @Admin,
        Manager = @Manager,
        Purchase = @Purchase,
        Sales = @Sales,
        SuperAdmin = @SuperAdmin,
        [User] = @User
      WHERE id = @id;
    `;

    const poolRequest = pool
      .request()
      .input("Accountant", data.Accountant)
      .input("Admin", data.Admin)
      .input("Manager", data.Manager)
      .input("Purchase", data.Purchase)
      .input("Sales", data.Sales)
      .input("SuperAdmin", data.SuperAdmin)
      .input("User", data.User)
      .input("id", data.id);

    await poolRequest.query(query);

    console.log("Checkbox data updated successfully");
  } catch (error) {
    console.error("Error updating database:", error.message);
    throw error;
  }
}

exports.getrole = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // Call the stored procedure
    const request = new sql.Request(connection);
    request.execute("dbo.GetRoles", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error executing stored procedure:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

exports.menuaccess = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // Call the stored procedure
    const request = new sql.Request(connection);
    request.execute("dbo.GetMenuAccess", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error executing stored procedure:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

//menu access/user
//salesretailprintpage
exports.getSalesretailProductDetails = (req, res) => {
  const salesId = req.query.salesId; // Extract salesId from query parameter

  // Use parameterized query to prevent SQL injection
  const request = pool.request();
  request.input("SalesId", sql.Int, salesId); // Add salesId as a parameter

  request.execute("dbo.GetSalesretailProductDetails", (err, result) => {
    if (err) {
      console.error("Error executing stored procedure:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // Log the result
    console.log("Product details:", result.recordset);

    // Send the data as JSON response
    res.json({ data: result.recordset });
  });
};

exports.salesretaildetails = (req, res) => {
  const salesId = req.query.salesId; // Extract salesId from query parameter

  // Use parameterized query to prevent SQL injection
  const request = pool.request();
  request.input("SalesId", sql.Int, salesId); // Add salesId as a parameter

  request.execute("dbo.GetSalesretailsDetails", (err, result) => {
    if (err) {
      console.error("Error executing stored procedure:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // Log the result
    console.log("Sales details:", result.recordset);

    // Send the data as JSON response
    res.json({ data: result.recordset });
  });
};
//salesretailprintpage

//salesprintpage
exports.getSalesProductDetails = (req, res) => {
  const salesId = req.query.salesId; // Extract salesId from query parameter

  // Use parameterized query to prevent SQL injection
  const request = pool.request();
  request.input("SalesId", sql.Int, salesId); // Add salesId as a parameter

  request.execute("dbo.GetSalesProductDetails", (err, result) => {
    if (err) {
      console.error("Error executing stored procedure:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // Log the result
    console.log("Product details:", result.recordset);

    // Send the data as JSON response
    res.json({ data: result.recordset });
  });
};

exports.salesretailDetails = (req, res) => {
  const salesId = req.query.salesId; // Extract salesId from query parameter

  // Use parameterized query to prevent SQL injection
  const request = pool.request();
  request.input("SalesId", sql.Int, salesId); // Add salesId as a parameter

  request.execute("dbo.GetSalesretailDetails", (err, result) => {
    if (err) {
      console.error("Error executing stored procedure:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // Log the result
    console.log("Sales details:", result.recordset);

    // Send the data as JSON response
    res.json({ data: result.recordset });
  });
};
//salesprintpage

//purchaseprintpage
exports.getProductDetails = (req, res) => {
  const purchaseId = req.query.purchaseId; // Extract purchaseId from query parameter

  // Use parameterized query to prevent SQL injection
  const request = pool.request();
  request.input("PurchaseId", sql.Int, purchaseId); // Add purchaseId as a parameter

  request.execute("dbo.GetProductDetails", (err, result) => {
    if (err) {
      console.error("Error executing stored procedure:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // Log the result
    console.log("Product details:", result.recordset);

    // Send the data as JSON response
    res.json({ data: result.recordset });
  });
};

exports.purchasedetails = (req, res) => {
  const purchaseId = req.query.purchaseId; // Extract purchaseId from query parameter

  // Use parameterized query to prevent SQL injection
  const request = pool.request();
  request.input("PurchaseId", sql.Int, purchaseId); // Add purchaseId as a parameter

  request.execute("dbo.GetPurchasepDetails", (err, result) => {
    if (err) {
      console.error("Error executing stored procedure:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // Log the result
    console.log("Purchase details:", result.recordset);

    // Send the data as JSON response
    res.json({ data: result.recordset });
  });
};
//purchaseprintpage
//purchasesales report
exports.purchaseoutstanding = (req, res) => {
  poolConnect()
    .then((pool) => {
      const request = pool.request();

      request.execute("dbo.GetPurchaseOutstanding", (err, result) => {
        if (err) {
          console.error("Error executing stored procedure:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      });
    })
    .catch((error) => {
      console.error("Error connecting to the database:", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    });
};

//purchasesales report
//batchsummary
exports.currentstock = (req, res) => {
  const productType = req.query.producttype; // Capture the producttype parameter

  // Check if productType is provided, if not return an empty response or handle accordingly
  if (!productType) {
    return res.status(400).json({ error: "Product type is required" });
  }

  poolConnect()
    .then((pool) => {
      const request = pool.request();

      request.input("ProductType", sql.NVarChar, productType);

      request.execute("dbo.GetCurrentStock", (err, result) => {
        if (err) {
          console.error("Error executing stored procedure:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      });
    })
    .catch((error) => {
      console.error("Error connecting to the database:", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    });
};

exports.batchsummary = (req, res) => {
  poolConnect()
    .then((pool) => {
      const request = pool.request();

      request.execute("dbo.GetBatchSummary", (err, result) => {
        if (err) {
          console.error("Error executing stored procedure:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      });
    })
    .catch((error) => {
      console.error("Error connecting to the database:", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    });
};

exports.stocksummary = async (req, res) => {
  console.log("Received query parameters:", req.query);

  // Destructure the date parameters from the request query
  const { ParamFrDate, ParamToDate } = req.query;

  // Validate the date parameters
  if (!ParamFrDate || !ParamToDate) {
    return res.status(400).json({ error: "Missing date parameters." });
  }

  // Check validity of date format without parsing
  if (
    !moment(ParamFrDate, "DD-MM-YYYY", true).isValid() ||
    !moment(ParamToDate, "DD-MM-YYYY", true).isValid()
  ) {
    return res.status(400).json({ error: "Invalid date format." });
  }

  try {
    const pool = await poolConnect(); // Establish database connection
    const request = pool.request();

    // Pass dates as strings (VarChar) in the format dd-MM-YYYY
    request.input("ParamFrDate", sql.VarChar, ParamFrDate);
    request.input("ParamToDate", sql.VarChar, ParamToDate);

    request.execute("dbo.GetStockSummaryNew", (err, result) => {
      if (err) {
        console.error("Error executing stored procedure:", err);
        return res
          .status(500)
          .json({ error: "Internal Server Error", details: err });
      }

      res.json({ data: result.recordset });
    });
  } catch (error) {
    console.error("Error connecting to the database:", error.message);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error });
  }
};

exports.stockanalysis = async (req, res) => {
  console.log("Received query parameters:", req.query);

  // Destructure the query parameters
  const { ParamFrDate, ParamToDate, ParamProdTyp = "" } = req.query;

  // Validate the date parameters
  if (!ParamFrDate || !ParamToDate) {
    return res.status(400).json({ error: "Missing date parameters." });
  }

  if (
    !moment(ParamFrDate, "DD-MM-YYYY", true).isValid() ||
    !moment(ParamToDate, "DD-MM-YYYY", true).isValid()
  ) {
    return res.status(400).json({ error: "Invalid date format." });
  }

  try {
    const pool = await poolConnect(); // Establish database connection
    const request = pool.request();

    // Pass parameters to the stored procedure
    request.input("ParamFrDate", sql.VarChar, ParamFrDate);
    request.input("ParamToDate", sql.VarChar, ParamToDate);
    request.input("ParamProdTyp", sql.VarChar, ParamProdTyp);

    // Execute the stored procedure
    const result = await request.execute("dbo.GetStockSummaryByPT");

    // Handle multiple result sets
    const [table1, table2] = result.recordsets;

    res.json({
      table1, // First result set
      table2, // Second result set
    });
  } catch (error) {
    console.error("Error executing stock analysis:", error.message);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

exports.drugreport = async (req, res) => {
  try {
    const { ParamSaleDate, ParamDrugType = "" } = req.query;

    // Log received parameters for debugging
    console.log("Received parameters:", { ParamSaleDate, ParamDrugType });

    // Validate the sale date parameter with the expected format (DD-MMM-YYYY)
    if (
      !ParamSaleDate ||
      !moment(ParamSaleDate, "DD-MMM-YYYY", true).isValid()
    ) {
      return res
        .status(400)
        .json({ error: "Invalid or missing sale date parameter." });
    }

    // Convert the date to the required format for the database (YYYY-MM-DD)
    const saleDateString = moment(ParamSaleDate, "DD-MMM-YYYY").format(
      "YYYY-MM-DD"
    );

    // Log formatted sale date
    console.log("Formatted Sale Date:", saleDateString);

    // Connect to the database
    const pool = await sql.connect(config); // Use the correct database config
    const request = pool.request();

    // Input parameters for the stored procedure
    request.input("ParamSaleDate", sql.VarChar, saleDateString);
    request.input("ParamDrugType", sql.NVarChar, ParamDrugType);

    // Execute the stored procedure
    console.log("Executing stored procedure with:", {
      saleDateString,
      ParamDrugType,
    });

    const result = await request.execute("dbo.GetDailyDrugReport");

    // Log result for debugging
    console.log("Stored procedure result:", result);

    // Check for empty results
    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ message: "No records found." });
    }

    // Send the result
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error fetching drug report:", error);

    if (error.code === "ECONNREFUSED") {
      res.status(500).json({ error: "Database connection refused" });
    } else if (error.originalError) {
      res.status(500).json({
        error: "Database Error",
        details: error.originalError.message,
      });
    } else {
      res.status(500).json({
        error: "Internal Server Error",
        details: error.message,
      });
    }
  }
};


//batchsummary

//mis
exports.productwisepurcsale = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    let query = `SELECT * FROM TrailBalance`;
    connection.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error(`Error executing query: ${query}`, err);
        return res.status(400).json({ error: "Bad Request" });
      }

      const formattedResult = result.map((row) => ({
        ...row,
        Date: formatDate(row.Date),
      }));
      return res.send(formattedResult);
    });
  });
};

exports.salesoutstanding = (req, res) => {
  poolConnect()
    .then((pool) => {
      const request = pool.request();

      request.execute("dbo.GetSalesOutstanding", (err, result) => {
        if (err) {
          console.error("Error executing stored procedure:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      });
    })
    .catch((error) => {
      console.error("Error connecting to the database:", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    });
};

exports.billwise = (req, res) => {
  poolConnect()
    .then((pool) => {
      const request = pool.request();

      request.execute("dbo.GetBillwise", (err, result) => {
        if (err) {
          console.error("Error executing stored procedure:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      });
    })
    .catch((error) => {
      console.error("Error connecting to the database:", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    });
};

exports.producthistory = async (req, res) => {
  try {
    await poolConnect(); // Ensure the DB connection pool is set up

    const { productId } = req.query; // Retrieve the product ID from the request query

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    // Log the productId to check if it's being passed correctly
    console.log("Selected Product ID:", productId);

    // Execute the stored procedure with the correct input parameter name '@SelectedProduct'
    const result = await pool
      .request()
      .input("SelectedProduct", sql.VarChar, productId)
      .execute("GetProductHistory");

    // Log the result to check all recordsets
    console.log("All Recordsets from stored procedure:", result.recordsets);

    // Initialize quantityData
    const quantityData = result.recordsets[3] || []; // Default to empty array if no data
    console.log("Quantity Data:", quantityData);

    // Check if there are any recordsets and send them as a response
    if (result.recordsets.length > 0) {
      if (quantityData.length > 0) {
        res.json({
          purchaseData: result.recordsets[0],
          salesRetailData: result.recordsets[1],
          salesData: result.recordsets[2],
          quantity: quantityData,
        });
      } else {
        console.log("Quantity Data not found or is empty.");
        res.json({
          purchaseData: result.recordsets[0],
          salesRetailData: result.recordsets[1],
          salesData: result.recordsets[2],
          quantity: [], // Return empty array for quantity
        });
      }
    } else {
      res.json({ data: [] }); // Send an empty array if no data
    }
  } catch (error) {
    console.error(
      "Error in fetching product details with transactions:",
      error
    );
    return res.status(500).json({ error: "Internal Server Error" });
  }
};





//mis

//accounts
exports.ledgerDr = (req, res) => {
  poolConnect()
    .then((pool) => {
      const request = pool.request();

      request.execute("dbo.GetLedgerDr", (err, result) => {
        if (err) {
          console.error("Error executing stored procedure:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      });
    })
    .catch((error) => {
      console.error("Error connecting to the database:", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    });
};

exports.ledgerbook = (req, res) => {
  const selectedLedger = req.query.ledger;

  poolConnect()
    .then((pool) => {
      const sqlQuery = `EXEC  [dbo].[GetDailyTransactions] @selectedLedger='${selectedLedger}'`;

      const request = pool.request();
      request.input("selectedLedger", selectedLedger);
      request.query(sqlQuery, (err, result) => {
        if (err) {
          console.error("Error executing SQL query:", err);
          return res.status(500).json({ error: "Error executing SQL query" });
        }

        if (
          !result ||
          !Array.isArray(result.recordset) ||
          result.recordset.length === 0
        ) {
          console.log("No data found for the selected ledger:", selectedLedger);
          return res
            .status(404)
            .json({ error: "No data found for the selected ledger" });
        }

        // Corrected the variable name here from `recordset` to `result.recordset`
        console.log("recordset result:", result.recordset);

        return res.json({ data: result.recordset });
      });
    })
    .catch((error) => {
      console.error("Error connecting to the database:", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    });
};

exports.bankledgerDr = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const request = connection.request();

    request.execute("dbo.GetBankLedgerDr", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error executing stored procedure:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

exports.bankbook = (req, res) => {
  const selectedLedger = req.query.ledger;

  poolConnect()
    .then((pool) => {
      const request = pool.request();
      request.input("selectedLedger", selectedLedger);

      request.execute("dbo.GetBankbook", (err, result) => {
        if (err) {
          console.error("Error executing stored procedure:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        if (
          !result ||
          !Array.isArray(result.recordset) ||
          result.recordset.length === 0
        ) {
          console.log("No data found for the selected ledger:", selectedLedger);
          return res
            .status(404)
            .json({ error: "No data found for the selected ledger" });
        }

        const formattedResult = result.recordset.map((row) => ({
          vh_no: row.vh_no,
          vh_date: row.vh_date,
          vh_type: row.vh_type,
          dr_amount: row.dr_amount,
          cr_amount: row.cr_amount,
          discount: row.discount,
        }));

        console.log("Formatted result:", formattedResult);

        return res.json({ data: formattedResult });
      });
    })
    .catch((error) => {
      console.error("Error connecting to the database:", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    });
};

exports.cashbook = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const request = connection.request();

    request.execute("dbo.GetCashbooks", (err, result) => {
      if (err) {
        console.error("Error executing stored procedure:", err);
        connection.close();
        return res.status(500).json({ error: "Internal Server Error" });
      }

      const formattedResult = result.recordset.map((row) => ({
        ...row,
        vh_date: row.vh_date,
      }));

      connection.close();
      return res.send(formattedResult);
    });
  });
};

exports.daybook = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const request = connection.request();

    request.execute("dbo.GetDaybook", (err, result) => {
      if (err) {
        console.error("Error executing stored procedure:", err);
        connection.close();
        return res.status(500).json({ error: "Internal Server Error" });
      }

      const formattedResult = result.recordset.map((row) => ({
        ...row,
        vh_date: row.vh_date,
      }));

      connection.close();
      return res.send(formattedResult);
    });
  });
};

exports.journalbook = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    let query = `SELECT * FROM TrailBalance`;
    connection.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error(`Error executing query: ${query}`, err);
        return res.status(400).json({ error: "Bad Request" });
      }

      const formattedResult = result.map((row) => ({
        ...row,
        Date: formatDate(row.Date),
      }));
      return res.send(formattedResult);
    });
  });
};

exports.creditbook = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    let query = `SELECT * FROM TrailBalance`;
    connection.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error(`Error executing query: ${query}`, err);
        return res.status(400).json({ error: "Bad Request" });
      }

      const formattedResult = result.map((row) => ({
        ...row,
        Date: formatDate(row.Date),
      }));
      return res.send(formattedResult);
    });
  });
};

exports.trailbalance = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    let query = `SELECT * FROM TrailBalance`;
    connection.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error(`Error executing query: ${query}`, err);
        return res.status(400).json({ error: "Bad Request" });
      }

      const formattedResult = result.map((row) => ({
        ...row,
        Date: formatDate(row.Date),
      }));
      return res.send(formattedResult);
    });
  });
};

exports.profitandloss = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    let query = `SELECT * FROM BalanceSheet`;
    connection.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error(`Error executing query: ${query}`, err);
        return res.status(400).json({ error: "Bad Request" });
      }

      const formattedResult = result.map((row) => ({
        ...row,
        Date: formatDate(row.Date),
      }));
      return res.send(formattedResult);
    });
  });
};

exports.balancesheet = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    let query = `SELECT * FROM BalanceSheet`;
    connection.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error(`Error executing query: ${query}`, err);
        return res.status(400).json({ error: "Bad Request" });
      }

      const formattedResult = result.map((row) => ({
        ...row,
        Date: formatDate(row.Date),
      }));
      return res.send(formattedResult);
    });
  });
};
//aaccounts
//reports on gst
exports.gstPurchase = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    pool.query("EXEC GetGSTPurchase", (err, result) => {
      connection.release();
      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

exports.gstsales = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    pool.query("EXEC GetGSTSales", (err, result) => {
      connection.release();
      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

exports.hsnPurchase = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    pool.query("EXEC GetHSNPurchase", (err, result) => {
      connection.release();
      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

exports.hsnsales = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    pool.query("EXEC GetHSNSales", (err, result) => {
      connection.release();
      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};
//reports on gst
//dashboard
exports.masterdata = async (req, res) => {
  try {
    const result = await pool.request().execute("GetMasterData");
    if (result.recordset.length > 0) {
      console.log("Master data retrieved successfully");

      // Extract counts from the result
      const customerCount = result.recordset[0].customer_count;
      const supplierCount = result.recordset[0].supplier_count;
      const salesmanCount = result.recordset[0].salesman_count;
      const ledgerCount = result.recordset[0].ledger_count;

      // Send the counts as JSON response
      res.status(200).json({
        success: true,
        customer_count: customerCount,
        supplier_count: supplierCount,
        salesman_count: salesmanCount,
        ledger_count: ledgerCount,
      });
    } else {
      console.log("No master data found");
      res
        .status(404)
        .json({ success: false, message: "Master data not found" });
    }
  } catch (error) {
    console.error("Error fetching master data:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.dashboardinfo = async (req, res) => {
  try {
    const pool = await poolConnect(); // Get the connected pool instance
    const result = await pool.request().execute("GetDashBoardInfo");

    if (result.recordset && result.recordset.length > 0) {
      res.json({
        success: true,
        data: result.recordset[0], // Adjust according to actual data structure
        message: "Data retrieved successfully",
      });
    } else {
      res.status(404).json({ success: false, message: "No data found" });
    }
  } catch (error) {
    console.error("Error fetching dashboard data:", error.message); // Use error.message for more specific error info
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.salesData = async (req, res) => {
  try {
    const result = await pool.request().execute("GetSalesData");
    if (result.recordset.length > 0) {
      console.log("Sales data retrieved successfully");
      const sales = result.recordset.map((sale) => ({
        saledate: sale.saledate,
        subtotal: sale.subtotal,
      }));
      res.status(200).json({ success: true, sales });
    } else {
      console.log("No sales data found");
      res.status(404).json({ success: false, message: "Sales data not found" });
    }
  } catch (error) {
    console.error("Error fetching sales data:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.supplierCount = async (req, res) => {
  try {
    const result = await pool.request().execute("GetSupplierCount");
    if (result.recordset.length > 0) {
      console.log(
        "Supplier count retrieved successfully:",
        result.recordset[0].row_count
      );
      res
        .status(200)
        .json({ success: true, supplierCount: result.recordset[0].row_count });
    } else {
      console.log("No supplier count found");
      res
        .status(404)
        .json({ success: false, message: "Supplier count not found" });
    }
  } catch (error) {
    console.error("Error fetching supplier count:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.customerCount = async (req, res) => {
  try {
    const result = await pool.request().execute("GetCustomerCount");
    if (result.recordset.length > 0) {
      console.log(
        "Customer count retrieved successfully:",
        result.recordset[0].row_count
      );
      res
        .status(200)
        .json({ success: true, customerCount: result.recordset[0].row_count });
    } else {
      console.log("No customer count found");
      res
        .status(404)
        .json({ success: false, message: "Customer count not found" });
    }
  } catch (error) {
    console.error("Error fetching customer count:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.productCount = async (req, res) => {
  try {
    const result = await pool.request().execute("GetProductCount");
    if (result.recordset.length > 0) {
      console.log(
        "Product count retrieved successfully:",
        result.recordset[0].row_count
      );
      res
        .status(200)
        .json({ success: true, row_count: result.recordset[0].row_count });
    } else {
      console.log("No product count found");
      res
        .status(404)
        .json({ success: false, message: "Product count not found" });
    }
  } catch (error) {
    console.error("Error fetching product count:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.purchaseCount = async (req, res) => {
  try {
    const result = await pool.request().execute("GetPurchaseCount");
    if (result.recordset.length > 0) {
      console.log(
        "Purchase count retrieved successfully:",
        result.recordset[0].row_count
      );
      res
        .status(200)
        .json({ success: true, row_count: result.recordset[0].row_count });
    } else {
      console.log("No purchase count found");
      res
        .status(404)
        .json({ success: false, message: "Purchase count not found" });
    }
  } catch (error) {
    console.error("Error fetching purchase count:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
//dashboard
//company title
const initializePool = async () => {
  try {
    await pool.connect();
    console.log("Connected to the database");
  } catch (error) {
    console.error("Error connecting to the database:", error.message);
    throw error;
  }
};

initializePool();

exports.companyTitle = async (req, res) => {
  try {
    const result = await pool.request().execute("GetCompanyDetails");
    if (result.recordset.length > 0) {
      console.log(
        "Company details retrieved successfully:",
        result.recordset[0]
      );
      res
        .status(200)
        .json({ success: true, companyDetails: result.recordset[0] });
    } else {
      console.log("No company details found for the specified ID");
      res.status(404).json({
        success: false,
        message: "Company details not found for the specified ID",
      });
    }
  } catch (error) {
    console.error("Error fetching company details:", error);
    if (
      error.message.includes("connection is closed") ||
      error.code === "ECONNCLOSED"
    ) {
      try {
        await initializePool(); // Attempt to reinitialize the connection pool
        res.status(500).json({
          success: false,
          message: "Database connection closed. Please try again.",
        });
      } catch (reconnectError) {
        console.error("Error reconnecting to the database:", reconnectError);
        res.status(500).json({
          success: false,
          message: "Failed to reconnect to the database.",
        });
      }
    } else {
      // Handle other database errors
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
};
//company

//salesReturn
exports.customername = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      "SELECT [id], [ledgername],[state] FROM [elite_pos].[dbo].[customer]",
      (err, result) => {
        connection.release(); // Release the connection back to the pool

        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

// exports.retailbatchDetails = async (req, res) => {
//   const { selectedProductId } = req.body;
//   try {
//       console.log('Selected Product ID:', selectedProductId);
//       const result = await pool.request()
//         .input('selectedProductId', sql.Int, selectedProductId)
//         .execute('GetretailBatchDetails');
//       if (result.recordset.length > 0) {
//           console.log('Batch details retrieved successfully:', result.recordset);
//           res.status(200).json({ success: true, data: result.recordset });
//       } else {
//           // Return a 404 error if no batch details are found for the product ID
//           console.log('No batch details found for the product ID:', selectedProductId);
//           res.status(404).json({ success: false, message: 'No batch details found for the product ID.' });
//       }
//   } catch (error) {
//       // Handle any errors that occur during database query or processing
//       console.error('Error fetching batch details:', error);
//       res.status(500).json({ success: false, message: 'Internal server error' });
//   }
// };

// exports.batchDetails = async (req, res) => {
//   const { selectedProductId } = req.body;
//   try {
//     console.log("Selected Product ID:", selectedProductId);
//     const result = await pool
//       .request()
//       .input("selectedProductId", sql.Int, selectedProductId)
//       .execute("GetBatchDetails");
//     if (result.recordset.length > 0) {
//       console.log("Batch details retrieved successfully:", result.recordset);
//       res.status(200).json({ success: true, data: result.recordset });
//     } else {
//       // Return a 404 error if no batch details are found for the product ID
//       console.log(
//         "No batch details found for the product ID:",
//         selectedProductId
//       );
//       res
//         .status(404)
//         .json({
//           success: false,
//           message: "No batch details found for the product ID.",
//         });
//     }
//   } catch (error) {
//     // Handle any errors that occur during database query or processing
//     console.error("Error fetching batch details:", error);
//     res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };

exports.salesReturnDetails = async (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const query = "SELECT * FROM [elite_pos].[dbo].[salesReturn_Master]";

    pool.query(query, (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

async function updateOrInsertStock(
  productId,
  batchNo,
  quantity,
  tax,
  rate,
  uom
) {
  try {
    // Check if the product and batch number exist in the stock_Ob table
    const stockResult = await pool.query`
      SELECT Id FROM [elite_pos].[dbo].[stock_Ob] 
      WHERE [Product] = ${productId} AND [batchNo] = ${batchNo};
    `;

    if (stockResult.recordset.length > 0) {
      // If the product and batch number exist, update the op_quantity
      await pool
        .request()
        .input("productId", sql.Int, productId)
        .input("batchNo", sql.NVarChar, batchNo)
        .input("quantity", sql.Int, quantity).query(`
          UPDATE [elite_pos].[dbo].[stock_Ob] 
          SET [op_quantity] = [op_quantity] + @quantity
          WHERE [Product] = @productId AND [batchNo] = @batchNo;
        `);

      console.log(
        "Stock increased successfully for existing product:",
        productId,
        "and batchNo:",
        batchNo
      );
    } else {
      // If the product and batch number don't exist, insert a new record
      await pool
        .request()
        .input("productId", sql.Int, productId)
        .input("batchNo", sql.VarChar, batchNo)
        .input("quantity", sql.Int, quantity)
        .input("tax", sql.VarChar, tax)
        .input("rate", sql.Decimal, rate)
        .input("uom", sql.VarChar, uom).query(`
          INSERT INTO [elite_pos].[dbo].[stock_Ob] (Product, batchNo, quantity, tax, rate, uom, op_quantity)
          VALUES (@productId, @batchNo, @quantity, @tax, @rate, @uom, @quantity);
        `);

      console.log(
        "New product added to stock_Ob: ProductId:",
        productId,
        "BatchNo:",
        batchNo
      );
    }
  } catch (error) {
    console.error("Error updating or inserting stock:", error);
    throw error;
  }
}

exports.salesReturnadd = async (req, res) => {
  console.log(req.body);
  const {
    saledate,
    paymentmode,
    referno,
    transportno,
    customermobileno,
    customername,
    salesmanname,
    pamount,
    pigst,
    pcgst,
    psgst,
    psubtotal,
    pcess,
    ptcs,
    proundOff,
    pnetAmount,
    pdiscount,
    pdiscMode_, // Assuming this corresponds to the discount mode
    products: productsString,
  } = req.body;

  let parsedProducts = [];
  const formattedSaleDate = saledate ? saledate : null;

  try {
    // Establish database connection
    await poolConnect();

    // Parse products array from request body
    parsedProducts = JSON.parse(productsString);

    // Insert salesReturn master record
    const result = await pool.query`
          INSERT INTO [elite_pos].[dbo].[salesReturn_Master]
          ([saledate], [paymentmode], [referno], [transportno], [customermobileno], [customer],[salesman], [amount], [cgst], [sgst], [igst], [netAmount], [cess], [tcs], [discMode], [discount], [subtotal], [roundoff])
          VALUES
          (${formattedSaleDate}, ${paymentmode}, ${referno}, ${transportno}, ${customermobileno}, ${customername},${salesmanname}, ${pamount}, ${pcgst}, ${psgst}, ${pigst}, ${pnetAmount}, ${pcess}, ${ptcs}, ${pdiscMode_}, ${pdiscount}, ${psubtotal}, ${proundOff});

          SELECT SCOPE_IDENTITY() as salesReturnId;
      `;

    const salesReturnId = result.recordset[0].salesReturnId;
    console.log("Number of products:", parsedProducts.length);

    // Inserting Products
    for (const product of parsedProducts) {
      const {
        productId,
        batchNo,
        tax,
        quantity,
        free,
        uom,
        purcRate,
        mrp,
        rate,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;

      await pool.query`
              INSERT INTO [elite_pos].[dbo].[salesReturn_Trans]
              ([salesReturnId], [product], [batchNo], [tax], [quantity],[free], [uom],[purcRate],[mrp], [rate], [discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
              VALUES
              (${salesReturnId}, ${productId}, ${batchNo}, ${tax}, ${quantity},${free}, ${uom},${purcRate} ,${mrp},${rate}, ${discMode}, ${discount}, ${amount}, ${cgst}, ${sgst}, ${igst}, ${totalAmount});
          `;
      await increaseStock(productId, batchNo, quantity, free, uom, rate, tax);
    }

    res
      .status(200)
      .json({ success: true, message: "salesReturn added successfully" });
  } catch (error) {
    console.error("Error during salesReturn processing:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.salesReturnEdit = async (req, res) => {
  const { purchaseId } = req.params;
  const { purchaseDetails, products } = req.body;

  try {
    console.log("Received request to edit purchase:", req.body);

    // Update salesReturn master table
    await pool.query`
        UPDATE [elite_pos].[dbo].[salesReturn_Master]
        SET
            [saledate] = ${purchaseDetails.saledate},
            [paymentmode] = ${purchaseDetails.paymentmode},
            [referno] = ${purchaseDetails.referno},
            [transportno] = ${purchaseDetails.transportno},
            [customermobileno] = ${purchaseDetails.customermobileno},
            [customer] = ${purchaseDetails.customername},
            [salesman] = ${purchaseDetails.salesman},
            [amount] = ${purchaseDetails.pamount},
            [cgst] = ${purchaseDetails.pcgst},
            [sgst] = ${purchaseDetails.psgst},
            [igst] = ${purchaseDetails.pigst},
            [netAmount] = ${purchaseDetails.pnetAmount},
            [cess] = ${purchaseDetails.pcess},
            [tcs] = ${purchaseDetails.ptcs},
            [discMode] = ${purchaseDetails.pdiscMode_},
            [discount] = ${purchaseDetails.pdiscount},
            [subtotal] = ${purchaseDetails.psubtotal},
            [roundoff] = ${purchaseDetails.proundOff}
        WHERE
            [id] = ${purchaseDetails.id};
    `;
    for (const product of products) {
      const {
        Id,
        productId,
        batchNo,
        tax,
        quantity,
        free,
        uom,
        purcRate,
        mrp,
        rate,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;
      if (Id) {
        await pool.query`
          UPDATE [elite_pos].[dbo].[salesReturn_Trans]
          SET
              [product] = ${productId},
              [batchNo] = ${batchNo},
              [tax] = ${tax},
              [quantity] = ${quantity},
              [free]=${free},
              [uom] = ${uom},
              [purcRate]=${purcRate},
              [mrp]=${mrp},
              [rate] = ${rate},
              [discMode] = ${discMode},
              [discount] = ${discount},
              [amount] = ${amount},
              [cgst] = ${cgst},
              [sgst] = ${sgst},
              [igst] = ${igst},
              [totalAmount] = ${totalAmount}
          WHERE
              [Id] = ${Id};
        `;
      } else {
        await pool.query`
          INSERT INTO [elite_pos].[dbo].[salesReturn_Trans] ([salesReturnId], [product], [batchNo], [tax], [quantity],[free], [uom],[purcRate], [rate], [discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
          VALUES ( ${purchaseDetails.id}, ${productId}, ${batchNo}, ${tax}, ${quantity},${free}, ${uom},${purcRate} ,${rate}, ${discMode}, ${discount}, ${amount}, ${cgst}, ${sgst}, ${igst}, ${totalAmount});
        `;
        await increaseStock(productId, batchNo, quantity, free, uom, rate, tax);
      }
    }
    console.log("salesReturn edited successfully");
    res
      .status(200)
      .json({ success: true, message: "salesReturn edited successfully" });
  } catch (error) {
    console.error("Error updating salesReturn:", error);
    res
      .status(400)
      .json({ success: false, message: "Failed to update salesReturn" });
  }
};

exports.salesReturnids = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
    SELECT 
    pt.*,
    s.ledgername AS customername
FROM 
    [elite_pos].[dbo].[salesReturn_Master] pt
JOIN
    [elite_pos].[dbo].[customer] s ON pt.[customer] = s.[id];
 
`;
    pool.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error("Error in fetching purchase IDs:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      res.header("Content-Type", "application/json");
      res.json({ data: result.recordset });
    });
  });
};

exports.salesReturnproductid = (req, res) => {
  const purchaseId = req.query.purchaseId;
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
    SELECT 
    pt.Id,
    pt.product, 
    p.productname,
    dm.discMode,
    pt.batchNo,
    pt.tax,
    pt.quantity,
    pt.free,
    pt.uom,
    pt.purcRate,
    pt.mrp,
    pt.rate,
    pt.discount,
    pt.amount,
    pt.cgst,
    pt.sgst,
    pt.igst,
    pt.totalAmount
FROM 
    [elite_pos].[dbo].[salesReturn_Trans] pt
JOIN
    [elite_pos].[dbo].[product] p ON pt.product = p.id
JOIN
    [elite_pos].[dbo].[discmode] dm ON pt.discMode = dm.id
WHERE 
    pt.salesReturnId = '${purchaseId}';
`;

    pool.query(query, (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      // Send the data as JSON response
      res.json({
        data: result.recordset.map((row) => ({
          ...row,
          product: row.productname,
        })),
      });
    });
  });
};

exports.salesReturndelete = async (req, res) => {
  const purchaseId = req.params.id;
  try {
    await poolConnect();
    if (purchaseId) {
      // Retrieve product IDs and batch numbers from salesReturn_Trans
      const { recordset } = await pool
        .request()
        .input("purchaseId", sql.Int, purchaseId).query(`
                  SELECT product, batchNo, quantity,free
                  FROM [elite_pos].[dbo].[salesReturn_Trans]
                  WHERE [salesReturnId] = @purchaseId
              `);
      // Delete from salesReturn_Master
      await pool
        .request()
        .input("purchaseId", sql.Int, purchaseId)
        .query(
          "DELETE FROM [elite_pos].[dbo].[salesReturn_Master] WHERE [id] = @purchaseId"
        );
      // Delete associated products from salesReturn_Trans
      await pool
        .request()
        .input("purchaseId", sql.Int, purchaseId)
        .query(
          "DELETE FROM [elite_pos].[dbo].[salesReturn_Trans] WHERE [salesReturnId] = @purchaseId"
        );

      // Update stock_Ob based on deleted products and batches
      for (const { product, batchNo, free, quantity } of recordset) {
        await reduceStock(product, quantity, free, batchNo);
      }

      res.status(200).json({
        success: true,
        message: "Purchase and associated products deleted successfully",
      });
    } else {
      throw new Error("No purchaseId provided");
    }
  } catch (error) {
    console.error("Error during purchase deletion:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.salesReturntransdelete = async (req, res) => {
  const manufacturerId = req.params.id;
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();
    const { recordset } = await pool
      .request()
      .input("manufacturerId", sql.Int, manufacturerId)
      .query(
        "SELECT product, quantity,free, batchNo FROM [elite_pos].[dbo].[salesReturn_Trans] WHERE Id = @manufacturerId"
      );

    // Check if a record was found
    if (recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Sales return transaction not found" });
    }

    const { product, quantity, free, batchNo } = recordset[0];

    const result = await pool
      .request()
      .input("manufacturerId", sql.Int, manufacturerId)
      .query(
        "DELETE FROM [elite_pos].[dbo].[salesReturn_Trans] WHERE Id = @manufacturerId"
      );

    await reduceStock(product, quantity, free, batchNo);

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Sales return transaction deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Sales return transaction not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.salesReturnregister = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
      SELECT s.*, c.ledgername as customername
    FROM [elite_pos].[dbo].[salesReturn_Master] s
    JOIN [elite_pos].[dbo].[customer] c ON s.customer = c.id;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};
//salesReturn

//sales

exports.salesmanname = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      "SELECT [id], [ledgername] FROM [elite_pos].[dbo].[salesman]",
      (err, result) => {
        connection.release(); // Release the connection back to the pool

        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.customername = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      "SELECT [id], [ledgername],[state],[mobile] FROM [elite_pos].[dbo].[customer]",
      (err, result) => {
        connection.release(); // Release the connection back to the pool

        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.retailbatchDetails = async (req, res) => {
  const { selectedProductId } = req.body;
  try {
    console.log("Selected Product ID:", selectedProductId);
    const result = await pool.query(`
      SELECT 
        ST.batchNo,
        ST.tax,
        ST.retailQty,
        ST.expiryDate,
        ST.uom,
        ST.retailMrp,
        ST.retailRate,
        ISNULL(PT.profitMargin, 0) AS profitMargin,
        PR.package AS productPackage  -- Assuming 'package' is the column in the product table
      FROM 
        stock_Ob ST
      INNER JOIN product PR ON ST.product = PR.id
      INNER JOIN producttype PT ON PR.productType = PT.producttype
      WHERE 
        ST.isActive = '1' AND 
        ST.product = ${selectedProductId};
    `);

    if (result.recordset.length > 0) {
      console.log("Batch details retrieved successfully:", result.recordset);
      res.status(200).json({ success: true, data: result.recordset });
    } else {
      // Return a 404 error if no batch details are found for the product ID
      console.log(
        "No batch details found for the product ID:",
        selectedProductId
      );
      res.status(404).json({
        success: false,
        message: "No batch details found for the product ID.",
      });
    }
  } catch (error) {
    // Handle any errors that occur during database query or processing
    console.error("Error fetching batch details:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.checkStockAvailability = async (req, res) => {
  const { productId, batchNo, quantity, expiryDate } = req.params;

  try {
    const query = `
            SELECT 
                ST.retailQty AS availableStock,
                P.productname,
                ST.batchNo,
                ST.expiryDate
            FROM 
                product P
            LEFT JOIN 
                stock_Ob ST ON ST.product = P.id AND 
                               ST.batchNo = @batchNo AND 
                               ST.isActive = '1' AND 
                               ST.expiryDate >= @expiryDate
            WHERE 
                P.id = @productId;
        `;

    const result = await pool
      .request()
      .input("productId", productId)
      .input("batchNo", batchNo)
      .input("expiryDate", expiryDate)
      .query(query);

    if (result.recordset.length > 0) {
      const { availableStock, productname, batchNo, expiryDate } =
        result.recordset[0];

      if (availableStock !== null && availableStock >= quantity) {
        res.status(200).json({
          success: true,
          availableStock,
          productName: productname,
          batchNo,
          expiryDate,
        });
      } else {
        res.status(200).json({
          success: false,
          availableStock: availableStock || 0,
          productName: productname,
          batchNo,
          expiryDate,
          message: `Insufficient stock. Available: ${
            availableStock || 0
          }, Requested: ${quantity}`,
        });
      }
    } else {
      res.status(200).json({
        success: false,
        productName: "Unknown Product", // Fallback for missing product names
        message: "No valid stock found or product is expired.",
      });
    }
  } catch (error) {
    console.error("Error checking stock availability:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.batchDetails = async (req, res) => {
  const { selectedProductId } = req.body;
  try {
    console.log("Selected Product ID:", selectedProductId);
    const result = await pool.query(`
SELECT 
      ST.batchNo,ST.tax,CAST(ST.op_quantity AS INT) AS op_quantity,ST.expiryDate,ST.uom,ST.rate ,ST.mrp,ISNULL(PT.profitMargin,0) AS profitMargin
FROM 
      stock_Ob ST
	  INNER JOIN product PR ON ST.product = PR.id
	  INNER JOIN producttype PT ON PR.productType = PT.producttype
WHERE 
      ST.isActive='1' and ST.product = ${selectedProductId} ;
      `);
    if (result.recordset.length > 0) {
      console.log("Batch details retrieved successfully:", result.recordset);
      res.status(200).json({ success: true, data: result.recordset });
    } else {
      // Return a 404 error if no batch details are found for the product ID
      console.log(
        "No batch details found for the product ID:",
        selectedProductId
      );
      res.status(404).json({
        success: false,
        message: "No batch details found for the product ID.",
      });
    }
  } catch (error) {
    // Handle any errors that occur during database query or processing
    console.error("Error fetching batch details:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// exports.salesDetails = async (req, res) => {
//   pool.connect((err, connection) => {
//     if (err) {
//       console.error("Error getting connection from pool:", err);
//       return res.status(500).json({ error: "Internal Server Error" });
//     }

//     const query = "SELECT * FROM [elite_pos].[dbo].[sales_Master]";

//     pool.query(query, (err, result) => {
//       connection.release(); // Release the connection back to the pool

//       if (err) {
//         console.error("Error in listing data:", err);
//         return res.status(500).json({ error: "Internal Server Error" });
//       }

//       console.log("Query Result:", result);

//       res.json({ data: result.recordset });
//     });
//   });
// };

exports.salesproductname = async (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const query =
      " SELECT  DISTINCT p.productname,p.id FROM product p JOIN stock_Ob s ON p.id = s.product";

    pool.query(query, (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      res.json({ data: result.recordset });
    });
  });
};

exports.salesadd = async (req, res) => {
  console.log("Request body:", req.body);
  const {
    saledate,
    paymentmode,
    referno,
    transportno,
    customermobileno,
    customername,
    salesmanname,
    pamount,
    pigst,
    pcgst,
    psgst,
    psubtotal,
    pcess,
    ptcs,
    proundOff,
    pnetAmount,
    pdiscount,
    pdiscMode_,
    isDraft,
    products: productsString,
  } = req.body;

  let parsedProducts = [];
  const formattedSaleDate = saledate ? saledate : null;

  try {
    // Ensure database connection
    await poolConnect();

    // Parse the products array safely
    try {
      parsedProducts = JSON.parse(productsString);
    } catch (parseError) {
      console.error("Error parsing products string:", parseError);
      return res
        .status(400)
        .json({ success: false, message: "Invalid products data format" });
    }

    // Insert into sales master table
    const result = await pool.query`
      INSERT INTO sales_Master
      ([saledate], [paymentmode], [referno], [transportno], [customermobileno], [customer], [salesman], [amount], [cgst], [sgst], [igst], [netAmount], [cess], [tcs], [discMode], [discount], [subtotal], [roundoff], [isDraft])
      VALUES
      (${formattedSaleDate}, ${paymentmode}, ${referno}, ${transportno}, ${customermobileno}, ${customername}, ${salesmanname}, ${pamount}, ${pcgst}, ${psgst}, ${pigst}, ${pnetAmount}, ${pcess}, ${ptcs}, ${pdiscMode_}, ${pdiscount}, ${psubtotal}, ${proundOff}, ${isDraft});

      SELECT SCOPE_IDENTITY() as salesId;
    `;

    if (
      !result.recordset ||
      !result.recordset[0] ||
      !result.recordset[0].salesId
    ) {
      console.error("Failed to retrieve sales ID");
      return res
        .status(500)
        .json({ success: false, message: "Failed to retrieve sales ID" });
    }

    const salesId = result.recordset[0].salesId;
    console.log("Number of products:", parsedProducts.length);

    // Insert each product into sales transaction table
    for (const product of parsedProducts) {
      const {
        productId,
        batchNo,
        expiryDate,
        tax,
        quantity,
        free,
        uom,
        purcRate,
        mrp,
        rate,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;

      try {
        await pool.query`
          INSERT INTO sales_Trans
          ([salesId], [product], [batchNo],[expiryDate] ,[tax], [quantity], [free], [uom], [purcRate], [mrp], [rate], [discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
          VALUES
          (${salesId}, ${productId}, ${batchNo},${expiryDate}, ${tax}, ${quantity}, ${free}, ${uom}, ${purcRate}, ${mrp}, ${rate}, ${discMode}, ${discount}, ${amount}, ${cgst}, ${sgst}, ${igst}, ${totalAmount});
        `;

        if (Number(isDraft) === 0) {
          console.log(`Reducing stock for product ${productId}`);
          await reduceStock(productId, quantity, free, batchNo,expiryDate);
        }
      } catch (productError) {
        console.error(`Error inserting product ${productId}:`, productError);
        return res
          .status(500)
          .json({
            success: false,
            message: `Failed to insert product ${productId}`,
          });
      }
    }

    res
      .status(200)
      .json({ success: true, message: "Sales added successfully" });
  } catch (error) {
    console.error("Error during sales processing:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.salesEdit = async (req, res) => {
  const { purchaseId } = req.params;
  const { purchaseDetails, products } = req.body;
  try {
    console.log("Received request to edit purchase:", req.body);

    // Update sales master table
    await pool.query`
        UPDATE sales_Master
        SET
            [saledate] = ${purchaseDetails.saledate},
            [paymentmode] = ${purchaseDetails.paymentmode},
            [referno] = ${purchaseDetails.referno},
            [transportno] = ${purchaseDetails.transportno},
            [customermobileno] = ${purchaseDetails.customermobileno},
            [customer] = ${purchaseDetails.customername},
            [salesman] = ${purchaseDetails.salesmanname},
            [amount] = ${purchaseDetails.pamount},
            [cgst] = ${purchaseDetails.pcgst},
            [sgst] = ${purchaseDetails.psgst},
            [igst] = ${purchaseDetails.pigst},
            [netAmount] = ${purchaseDetails.pnetAmount},
            [cess] = ${purchaseDetails.pcess},
            [tcs] = ${purchaseDetails.ptcs},
            [discMode] = ${purchaseDetails.pdiscMode_},
            [discount] = ${purchaseDetails.pdiscount},
            [subtotal] = ${purchaseDetails.psubtotal},
            [roundoff] = ${purchaseDetails.proundOff},
            [isDraft] = ${purchaseDetails.isDraft}
        WHERE
            [id] = ${purchaseDetails.id};
    `;

    for (const product of products) {
      const {
        Id,
        productId,
        batchNo,
        expiryDate,
        tax,
        quantity,
        free,
        uom,
        purcRate,
        mrp,
        rate,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;

      if (Id) {
        // Update existing product
        await pool.query`
          UPDATE sales_Trans
          SET
              [product] = ${productId},
              [batchNo] = ${batchNo},
              [expiryDate] = ${expiryDate},
              [tax] = ${tax},
              [quantity] = ${quantity},
              [free] = ${free},
              [uom] = ${uom},
              [purcRate] = ${purcRate},
              [mrp] = ${mrp},
              [rate] = ${rate},
              [discMode] = ${discMode},
              [discount] = ${discount},
              [amount] = ${amount},
              [cgst] = ${cgst},
              [sgst] = ${sgst},
              [igst] = ${igst},
              [totalAmount] = ${totalAmount}
          WHERE
              [Id] = ${Id};
        `;

        if (Number(purchaseDetails.isDraft) === 0) {
          console.log("Reducing stock for updated product...");
          await reduceStock(productId, quantity, free, batchNo,expiryDate);
        }
      } else {
        // Insert new product
        await pool.query`
          INSERT INTO sales_Trans ([salesId], [product], [batchNo],[expiryDate] ,[tax], [quantity], [free], [uom], [purcRate], [mrp], [rate], [discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
          VALUES (${purchaseDetails.id}, ${productId}, ${batchNo},${expiryDate}, ${tax}, ${quantity}, ${free}, ${uom}, ${purcRate}, ${mrp}, ${rate}, ${discMode}, ${discount}, ${amount}, ${cgst}, ${sgst}, ${igst}, ${totalAmount});
        `;

        // Reduce stock if draft is 0
        if (Number(purchaseDetails.isDraft) === 0) {
          console.log("Reducing stock for new product...");
          await reduceStock(productId, quantity, free, batchNo);
        }
      }
    }

    console.log("Sales edited successfully");
    res
      .status(200)
      .json({ success: true, message: "Sales edited successfully" });
  } catch (error) {
    console.error("Error updating sales:", error);
    res.status(400).json({ success: false, message: "Failed to update sales" });
  }
};

exports.checksalesStockAvailability = async (req, res) => {
  const { productId, batchNo, quantity, expiryDate } = req.params;

  try {
    const query = `
            SELECT 
                ST.op_quantity AS availableStock,
                P.productname,
                ST.batchNo,
                ST.expiryDate
            FROM 
                product P
            LEFT JOIN 
                stock_Ob ST ON ST.product = P.id AND 
                               ST.batchNo = @batchNo AND 
                               ST.isActive = '1' AND 
                               ST.expiryDate >= @expiryDate
            WHERE 
                P.id = @productId;
        `;

    const result = await pool
      .request()
      .input("productId", productId)
      .input("batchNo", batchNo)
      .input("expiryDate", expiryDate)
      .query(query);

    if (result.recordset.length > 0) {
      const { availableStock, productname, batchNo, expiryDate } =
        result.recordset[0];

      if (availableStock !== null && availableStock >= quantity) {
        res.status(200).json({
          success: true,
          availableStock,
          productName: productname,
          batchNo,
          expiryDate,
        });
      } else {
        res.status(200).json({
          success: false,
          availableStock: availableStock || 0,
          productName: productname,
          batchNo,
          expiryDate,
          message: `Insufficient stock. Available: ${
            availableStock || 0
          }, Requested: ${quantity}`,
        });
      }
    } else {
      res.status(200).json({
        success: false,
        productName: "Unknown Product", // Fallback for missing product names
        message: "No valid stock found or product is expired.",
      });
    }
  } catch (error) {
    console.error("Error checking stock availability:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

async function reduceStock(productId, quantity, free, batchNo, expiryDate) {
  try {
    // Convert quantity and free to numbers
    const numericQuantity = Number(quantity);
    const numericFree = Number(free);
    const numericProductId = Number(productId);

    // Retrieve the package value for the given productId from the product table
    const result = await pool.query`
      SELECT [package] FROM [elite_pos].[dbo].[product]
      WHERE [id] = ${numericProductId};
    `;

    if (!result.recordset || result.recordset.length === 0) {
      throw new Error(
        `Package value not found for product ID: ${numericProductId}`
      );
    }

    const packageValue = Number(result.recordset[0].package);

    // Calculate the total quantity
    const totalQuantity = numericQuantity + numericFree;

    // Calculate the reduction in retailQty
    const retailQtyReduction = totalQuantity * packageValue;

    // Update both op_quantity and retailQty in the stock_Ob table, filtered by batchNo and expiryDate
    const stockUpdateResult = await pool.query`
      UPDATE [elite_pos].[dbo].[stock_Ob] 
      SET 
        [op_quantity] = [op_quantity] - ${totalQuantity}, 
        [retailQty] = [retailQty] - ${retailQtyReduction}
      WHERE 
        [product] = ${numericProductId} AND 
        [batchNo] = ${batchNo} AND 
        [expiryDate] = ${expiryDate};
    `;

    if (stockUpdateResult.rowsAffected[0] === 0) {
      throw new Error(
        `No stock updated for product ID: ${numericProductId}, batchNo: ${batchNo}, expiryDate: ${expiryDate}`
      );
    }
  } catch (error) {
    console.error("Error reducing stock:", error);
    throw error;
  }
}

exports.salesids = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
                  SELECT 
                  pt.*,
                  s.ledgername AS customername
              FROM 
                  [elite_pos].[dbo].[sales_Master] pt
              JOIN
                  [elite_pos].[dbo].[customer] s ON pt.[customer] = s.[id]
;
              
              `;
    pool.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error("Error in fetching purchase IDs:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      res.header("Content-Type", "application/json");
      res.json({ data: result.recordset });
    });
  });
};

exports.saleproductid = (req, res) => {
  const purchaseId = req.query.purchaseId;
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
    SELECT 
    pt.Id,
    pt.product, -- Assuming this is the product ID
    p.productname,
    dm.discMode,
    pt.batchNo,
    pt.expiryDate,
    pt.tax,
    pt.quantity,
    pt.free,
    pt.uom,
    pt.purcRate,
     pt.mrp,
    pt.rate,
    pt.discount,
    pt.amount,
    pt.cgst,
    pt.sgst,
    pt.igst,
    pt.totalAmount
FROM 
    [elite_pos].[dbo].[sales_Trans] pt
JOIN
    [elite_pos].[dbo].[product] p ON pt.product = p.id
JOIN
    [elite_pos].[dbo].[discmode] dm ON pt.discMode = dm.id
WHERE 
    pt.salesId = '${purchaseId}';
`;

    pool.query(query, (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      // Send the data as JSON response
      res.json({
        data: result.recordset.map((row) => ({
          ...row,
          product: row.productname,
        })),
      });
    });
  });
};

exports.salesdelete = async (req, res) => {
  const salesId = req.params.id;

  try {
    await poolConnect();

    if (!salesId) {
      throw new Error("No salesId provided");
    }

    // Check if the associated sales_Master record has isDraft set to 1
    const masterResult = await pool.query`
      SELECT isDraft
      FROM [elite_pos].[dbo].[sales_Master]
      WHERE [id] = ${salesId};
    `;

    if (masterResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Sales record not found" });
    }

    const { isDraft } = masterResult.recordset[0];

    // If isDraft is not 1, increase the stock; otherwise, skip this step
    // Ensure `isDraft` is checked as a number
    if (Number(isDraft) !== 1) {
      // Get transaction details from sales_Trans
      const transDetailsResult = await pool.query`
        SELECT Id, product, batchNo,expiryDate ,quantity, free, tax, uom, rate, mrp
        FROM [elite_pos].[dbo].[sales_Trans]
        WHERE [salesId] = ${salesId};
      `;

      const transactions = transDetailsResult.recordset;

      if (transactions.length > 0) {
        for (const transaction of transactions) {
          const { product, batchNo,expiryDate, quantity, free, uom, rate, tax, mrp } =
            transaction;

          // Increase stock for each transaction if isDraft is not 1
          await increaseStock(
            product,
            batchNo,
            expiryDate,
            quantity,
            free,
            uom,
            rate,
            tax,
            mrp
          );
        }
      }
    }

    // Delete records from sales_Master and sales_Trans
    await pool.query`
      DELETE FROM [elite_pos].[dbo].[sales_Master]
      WHERE [id] = ${salesId};
    `;

    await pool.query`
      DELETE FROM [elite_pos].[dbo].[sales_Trans]
      WHERE [salesId] = ${salesId};
    `;

    res.status(200).json({
      success: true,
      message: "Sales and associated products deleted successfully",
    });
  } catch (error) {
    console.error("Error during sales deletion:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.salestransdelete = async (req, res) => {
  const manufacturerId = req.params.id;
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const { recordset } = await pool
      .request()
      .input("manufacturerId", sql.Int, manufacturerId)
      .query(
        "SELECT quantity,free, Product, batchNo,expiryDate, uom, rate, tax FROM [elite_pos].[dbo].[sales_Trans] WHERE Id = @manufacturerId"
      );

    // Check if a record was found
    if (recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Purchased product not found" });
    }

    // Extract the quantity, productId, batchNo, uom, rate, and tax values from the recordset
    const {
      quantity,
      free,
      Product: productId,
      batchNo,
      expiryDate,
      uom,
      rate,
      tax,
    } = recordset[0];

    // Log the quantity to inspect its value
    console.log("Quantity:", quantity);

    // Delete the sales transaction
    const result = await pool
      .request()
      .input("manufacturerId", sql.Int, manufacturerId)
      .query(
        "DELETE FROM [elite_pos].[dbo].[sales_Trans] WHERE Id = @manufacturerId"
      );

    // Update the stock in the stock_Ob table based on the productId, batchNo, and retrieved quantity
    await increaseStock(productId, batchNo,expiryDate, quantity, free, uom, rate, tax);

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Purchased product deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Purchased product not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.salesregister = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
        SELECT s.*, c.ledgername,  dbo.GetsalesBillMargin(s.id) as billmargin
    FROM [elite_pos].[dbo].[sales_Master] s
    JOIN [elite_pos].[dbo].[customer] c ON s.customer = c.id
    where isDraft=0;
    
   ;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.salesdraftregister = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
    SELECT s.*, c.ledgername
    FROM [elite_pos].[dbo].[sales_Master] s
    JOIN [elite_pos].[dbo].[customer] c ON s.customer = c.id
    where isDraft=1;
    
   ;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};
//sales

//purchasereturn
exports.PurchasereturnDetails = async (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const query =
      "SELECT * FROM [elite_pos].[dbo].[PurchaseTableReturn_Master]";

    pool.query(query, (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

exports.Purchasereturnadd = async (req, res) => {
  console.log(req.body);
  const {
    purchasedate,
    paymentmode,
    supplierinvoicedate,
    modeoftransport,
    transportno,
    supplierinvoiceamount,
    supplierinvoiceno,
    suppliername,
    pamount,
    pcgst,
    psgst,
    pigst,
    pnetAmount,
    pcess,
    ptcs,
    pdiscMode_,
    pdiscount,
    psubtotal,
    proundOff,

    products: productsString,
  } = req.body;

  let parsedProducts = [];

  const formattedPurchaseDate = purchasedate ? purchasedate : null;
  const formattedsupplierinvoicedate = supplierinvoicedate
    ? supplierinvoicedate
    : null;

  try {
    await poolConnect();

    parsedProducts = JSON.parse(productsString);

    const result = await pool.query`
      INSERT INTO [elite_pos].[dbo].[PurchaseTableReturn_Master]
      ([purchasedate], [paymentmode], [supplierinvoicedate], [modeoftransport], [transportno], [supplierinvoiceamount], [supplierinvoiceno], [suppliername],[amount],[cgst],[sgst],[igst],[netAmount],[cess],[tcs],[discMode],[discount],[subtotal],[roundoff])
      VALUES
      (${formattedPurchaseDate}, ${paymentmode}, ${formattedsupplierinvoicedate}, ${modeoftransport}, ${transportno}, ${supplierinvoiceamount}, ${supplierinvoiceno}, ${suppliername},${pamount},${pcgst},${psgst},${pigst},${pnetAmount},${pcess},${ptcs},${pdiscMode_},${pdiscount},${psubtotal},${proundOff});

      SELECT SCOPE_IDENTITY() as purchaseId;`;

    const purchaseId = result.recordset[0].purchaseId;
    console.log("Number of products:", parsedProducts.length);

    // Inserting Products
    for (const product of parsedProducts) {
      const {
        productId,
        batchNo,
        tax,
        quantity,
        free,
        uom,
        rate,
        mrp,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;

      await pool.query`
          INSERT INTO [elite_pos].[dbo].[PurchaseTableReturn_Trans]
          ([purchaseId], [product], [batchNo], [tax], [quantity],[free], [uom], [rate],[mrp],[discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
          VALUES
          (${purchaseId}, ${productId}, ${batchNo}, ${tax}, ${quantity},${free}, ${uom}, ${rate},${mrp}, ${discMode}, ${discount}, ${amount}, ${cgst}, ${sgst}, ${igst}, ${totalAmount});
      `;
      await reduceStock(productId, quantity, free, batchNo);
    }

    res
      .status(200)
      .json({ success: true, message: "Purchase added successfully" });
  } catch (error) {
    console.error("Error during purchase processing:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.PurchasereturnEdit = async (req, res) => {
  const { purchaseId } = req.params;
  const { purchaseDetails, products } = req.body;

  try {
    console.log("Received request to edit purchase:", req.body);
    await pool.query`
    UPDATE [elite_pos].[dbo].[PurchaseTableReturn_Master]
    SET
        [purchaseDate] = ${purchaseDetails.purchaseDate},
        [paymentMode] = ${purchaseDetails.paymentMode},
        [supplierInvoiceDate] = ${purchaseDetails.supplierInvoiceDate},
        [modeOfTransport] = ${purchaseDetails.modeOfTransport},
        [transportNo] = ${purchaseDetails.transportNo},
        [supplierInvoiceAmount] = ${purchaseDetails.supplierInvoiceAmount},
        [supplierInvoiceNo] = ${purchaseDetails.supplierInvoiceNo},
        [supplierName] = ${purchaseDetails.supplierName},
        [amount] = ${purchaseDetails.pAmount},
        [cgst] = ${purchaseDetails.pCgst},
        [sgst] = ${purchaseDetails.pSgst},
        [igst] = ${purchaseDetails.pIgst},
        [netAmount] = ${purchaseDetails.pNetAmount},
        [cess] = ${purchaseDetails.pCess},
        [tcs] = ${purchaseDetails.pTcs},
        [discMode] = ${purchaseDetails.pdiscMode_},
        [discount] = ${purchaseDetails.pdiscount},
        [subtotal] = ${purchaseDetails.pSubtotal},
        [roundoff] = ${purchaseDetails.proundOff},
        [isDraft] = ${purchaseDetails.isDraft}
    WHERE
        [id] = ${purchaseDetails.id};
    
    `;
    for (const product of products) {
      const {
        Id,
        productId,
        batchNo,
        tax,
        quantity,
        free,
        uom,
        rate,
        mrp,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;
      if (Id) {
        await pool.query`
          UPDATE [elite_pos].[dbo].[PurchaseTableReturn_Trans]
          SET
              [product] = ${productId},
              [batchNo] = ${batchNo},
              [tax] = ${tax},
              [quantity] = ${quantity},
              [free]=${free},
              [uom] = ${uom},
              [rate] = ${rate},
               [mrp] = ${mrp},
              [discMode] = ${discMode},
              [discount] = ${discount},
              [amount] = ${amount},
              [cgst] = ${cgst},
              [sgst] = ${sgst},
              [igst] = ${igst},
              [totalAmount] = ${totalAmount}
          WHERE
              [Id] = ${Id};
        `;
      } else {
        await pool.query`
          INSERT INTO [elite_pos].[dbo].[PurchaseTableReturn_Trans] ([purchaseId], [product], [batchNo], [tax], [quantity],[free], [uom], [rate],[mrp], [discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
          VALUES (${purchaseDetails.id}, ${productId}, ${batchNo}, ${tax}, ${quantity},${free}, ${uom}, ${rate},${mrp}, ${discMode}, ${discount}, ${amount}, ${cgst}, ${sgst}, ${igst}, ${totalAmount});
        `;
        await reduceStock(productId, quantity, free, batchNo);
      }
    }
    console.log("Purchase edited successfully");
    res
      .status(200)
      .json({ success: true, message: "Purchase edited successfully" });
  } catch (error) {
    console.error("Error updating purchase:", error);
    res
      .status(400)
      .json({ success: false, message: "Failed to update purchase" });
  }
};

exports.Purchasereturnids = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
    SELECT 
    pt.*,
    s.ledgername as ledgername
FROM 
    [elite_pos].[dbo].[PurchaseTableReturn_Master] pt
JOIN
    [elite_pos].[dbo].[supplier] s ON pt.[suppliername] = s.[id];
`;
    pool.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error("Error in fetching purchase IDs:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      res.header("Content-Type", "application/json"); // Set Content-Type header
      res.json({ data: result.recordset });
    });
  });
};

exports.PurchasereturnId = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const query = `
   
    SELECT
    pt.id AS purchaseId,
    pt.purchasedate,
    pt.paymentmode,
    pt.supplierinvoicedate,
    pt.modeoftransport,
    pt.transportno,
    pt.supplierinvoiceamount,
    pt.supplierinvoiceno,
    pt.suppliername,
    pr.productId,
    pr.productName,
    pr.batchNo,
    pr.tax,
    pr.kgs,
    pr.nos,
    pr.rate,
    pr.discMode,
    pr.discount,
    pr.amount,
    pr.cgst,
    pr.sgst,
    pr.igst,
    pr.totalAmount
FROM
    [elite_pos].[dbo].[PurchaseTableReturn_Master] AS pt
JOIN
    [elite_pos].[dbo].[PurchaseTableReturn_Trans] AS pr
ON
    pt.id = pr.purchaseId;

    `;

    const request = connection.request();

    request.query(query, (err, result) => {
      connection.release();

      if (err) {
        console.error("Error in fetching data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      res.json({ data: result.recordset });
    });
  });
};

exports.productreturnid = (req, res) => {
  const purchaseId = req.query.purchaseId;
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
    SELECT 
    pt.Id,
    pt.product, -- Assuming this is the product ID
    p.productname,
    dm.discMode,
    pt.batchNo,
    pt.tax,
    pt.quantity,
    pt.free,
    pt.uom,
    pt.rate,
    pt.mrp,
    pt.discount,
    pt.amount,
    pt.cgst,
    pt.sgst,
    pt.igst,
    pt.totalAmount
FROM 
    [elite_pos].[dbo].[PurchaseTableReturn_Trans] pt
JOIN
    [elite_pos].[dbo].[product] p ON pt.product = p.id
JOIN
    [elite_pos].[dbo].[discmode] dm ON pt.discMode = dm.id
WHERE 
    pt.PurchaseId = '${purchaseId}';
`;
    pool.query(query, (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      // Send the data as JSON response
      res.json({
        data: result.recordset.map((row) => ({
          ...row,
          product: row.productname,
        })),
      });
    });
  });
};

exports.Purchasereturndelete = async (req, res) => {
  const purchaseId = req.params.id;
  try {
    await poolConnect();

    if (!purchaseId) {
      throw new Error("No purchaseId provided");
    }

    // Fetch transaction details associated with the purchaseId
    const transDetailsResult = await pool.query`
      SELECT Id, product, batchNo, quantity,free, tax, uom, rate, mrp
      FROM [elite_pos].[dbo].[PurchaseTableReturn_Trans]
      WHERE [purchaseId] = ${purchaseId};
    `;

    // Extract transaction details
    const transactions = transDetailsResult.recordset;

    // Iterate through each transaction
    for (const transaction of transactions) {
      const {
        Id: transactionId,
        product,
        batchNo,
        quantity,
        free,
        tax,
        uom,
        rate,
        mrp,
      } = transaction;

      // Increase stock quantity using the increaseStock function
      await increaseStock(
        product,
        batchNo,
        quantity,
        free,
        uom,
        rate,
        tax,
        mrp
      );
    }

    // Delete from PurchaseTableReturn_Master
    await pool.query`
      DELETE FROM [elite_pos].[dbo].[PurchaseTableReturn_Master]
      WHERE [id] = ${purchaseId};
    `;

    // Delete associated products from PurchaseTableReturn_Trans
    await pool.query`
      DELETE FROM [elite_pos].[dbo].[PurchaseTableReturn_Trans]
      WHERE [purchaseId] = ${purchaseId};
    `;

    res.status(200).json({
      success: true,
      message: "Purchase and associated products deleted successfully",
    });
  } catch (error) {
    console.error("Error during purchase deletion:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.Purchasereturntransdelete = async (req, res) => {
  const manufacturerId = req.params.id;
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const { recordset } = await pool
      .request()
      .input("manufacturerId", sql.Int, manufacturerId)
      .query(
        "SELECT quantity, Product, batchNo, uom, rate,mrp, tax FROM [elite_pos].[dbo].[PurchaseTableReturn_Trans] WHERE Id = @manufacturerId"
      );

    // Check if a record was found
    if (recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Purchased product not found" });
    }

    // Extract the quantity, productId, batchNo, uom, rate, and tax values from the recordset
    const {
      quantity,
      Product: productId,
      batchNo,
      uom,
      rate,
      mrp,
      tax,
    } = recordset[0];

    // Log the quantity to inspect its value
    console.log("Quantity:", quantity);

    // Delete the sales transaction
    const result = await pool
      .request()
      .input("manufacturerId", sql.Int, manufacturerId)
      .query(
        "DELETE FROM [elite_pos].[dbo].[PurchaseTableReturn_Trans] WHERE Id = @manufacturerId"
      );

    // Update the stock in the stock_Ob table based on the productId, batchNo, and retrieved quantity
    await increaseStock(productId, batchNo, quantity, uom, rate, mrp, tax);

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Purchased product deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Purchased product not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

async function increaseStock(
  productId,
  batchNo,
  expiryDate,
  quantity,
  free,
  uom,
  rate,
  tax,
  mrp
) {
  try {
    // Convert inputs to numeric values if needed
    const numericQuantity = Number(quantity);
    const numericFree = Number(free);
    const totalQuantity = numericQuantity + numericFree;

    // Step 1: Retrieve the package value for the product
    const packageQuery = `
      SELECT [package] FROM [elite_pos].[dbo].[product]
      WHERE [id] = @productId;
    `;

    const packageResult = await pool
      .request()
      .input("productId", sql.Int, productId)
      .query(packageQuery);

    if (packageResult.recordset.length === 0) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    const packageValue = Number(packageResult.recordset[0].package);
    const retailQtyIncrease = totalQuantity * packageValue;

    // Step 2: Check if the record exists (includes `expiryDate` in the WHERE clause)
    const checkQuery = `
      SELECT 1 FROM [elite_pos].[dbo].[stock_Ob]
      WHERE [product] = @productId AND [batchNo] = @batchNo AND [expiryDate] = @expiryDate;
    `;

    const checkResult = await pool
      .request()
      .input("productId", sql.Int, productId)
      .input("batchNo", sql.VarChar, batchNo)
      .input("expiryDate", sql.VarChar, expiryDate) // Use expiryDate as-is
      .query(checkQuery);

    if (checkResult.recordset.length > 0) {
      // Step 3: If record exists, update the row
      console.log(
        `Updating stock for productId: ${productId}, batchNo: ${batchNo}, expiryDate: ${expiryDate}`
      );

      const updateQuery = `
        UPDATE [elite_pos].[dbo].[stock_Ob]
        SET 
          [op_quantity] = [op_quantity] + @totalQuantity,
          [retailQty] = ISNULL([retailQty], 0) + @retailQtyIncrease
        WHERE [product] = @productId AND [batchNo] = @batchNo AND [expiryDate] = @expiryDate;
      `;

      const updateResult = await pool
        .request()
        .input("productId", sql.Int, productId)
        .input("batchNo", sql.VarChar, batchNo)
        .input("expiryDate", sql.VarChar, expiryDate) // Use expiryDate as-is
        .input("totalQuantity", sql.Decimal, totalQuantity)
        .input("retailQtyIncrease", sql.Decimal, retailQtyIncrease)
        .query(updateQuery);

      console.log(`Rows affected by update: ${updateResult.rowsAffected[0]}`);
    } else {
      // Step 4: If record doesn't exist, insert a new row
      console.log(
        `Inserting new stock for productId: ${productId}, batchNo: ${batchNo}, expiryDate: ${expiryDate}`
      );

      const insertQuery = `
        INSERT INTO [elite_pos].[dbo].[stock_Ob] 
        ([product], [batchNo], [expiryDate], [quantity], [uom], [rate], [mrp], [tax], [op_quantity], [retailQty])
        VALUES 
        (@productId, @batchNo, @expiryDate, @totalQuantity, @uom, @rate, @mrp, @tax, @totalQuantity, @retailQtyIncrease); 
      `;

      const insertResult = await pool
        .request()
        .input("productId", sql.Int, productId)
        .input("batchNo", sql.VarChar, batchNo)
        .input("expiryDate", sql.VarChar, expiryDate) // Use expiryDate as-is
        .input("totalQuantity", sql.Decimal, totalQuantity)
        .input("uom", sql.VarChar, uom)
        .input("rate", sql.Decimal, rate)
        .input("mrp", sql.Decimal, mrp)
        .input("tax", sql.Decimal, tax)
        .input("retailQtyIncrease", sql.Decimal, retailQtyIncrease)
        .query(insertQuery);

      console.log("New stock record inserted.");
    }
  } catch (error) {
    console.error("Error increasing stock:", error);
    throw error;
  }
}


exports.Purchasereturnregister = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      `
      SELECT P.*, S.ledgername AS suppliername
      FROM [elite_pos].[dbo].[PurchaseTableReturn_Master] AS P
      INNER JOIN [elite_pos].[dbo].[Supplier] AS S ON P.suppliername = S.id;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};
//purchasereturn

//purchase
exports.purchasedelete = async (req, res) => {
  const purchaseId = req.params.id;

  try {
    await poolConnect();

    if (!purchaseId) {
      throw new Error("No purchaseId provided");
    }

    // Fetch the productId, expiryDate, and batchNo of the PurchaseTable_Trans records for the given purchaseId
    const transDetailsResult = await pool.query`
      SELECT product, expiryDate, batchNo
      FROM PurchaseTable_Trans
      WHERE [purchaseId] = ${purchaseId};
    `;

    // Extracting the details from the result
    const transDetails = transDetailsResult.recordset;

    if (transDetails.length === 0) {
      throw new Error("No transaction details found for the given purchaseId");
    }

    // Begin a transaction
    const transaction = await pool.transaction();
    await transaction.begin();

    try {
      // Delete from PurchaseTable_Master
      await transaction
        .request()
        .query(
          `DELETE FROM PurchaseTable_Master WHERE [id] = ${purchaseId}`
        );

      // Delete from PurchaseTable_Trans
      await transaction
        .request()
        .query(
          `DELETE FROM PurchaseTable_Trans WHERE [purchaseId] = ${purchaseId}`
        );

      // Delete corresponding records from stock_Ob using product, expiryDate, and batchNo
      for (const { product: productId, expiryDate, batchNo } of transDetails) {
        await transaction
          .request()
          .input("productId", productId)
          .input("expiryDate", expiryDate)
          .input("batchNo", batchNo)
          .query(
            `DELETE FROM stock_Ob
             WHERE [product] = @productId
             AND [expiryDate] = @expiryDate
             AND [batchNo] = @batchNo`
          );
      }

      // Commit the transaction
      await transaction.commit();

      res.status(200).json({
        success: true,
        message: "Purchase and associated products deleted successfully",
      });
    } catch (error) {
      // Rollback the transaction
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error during purchase deletion:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.purchasetransdelete = async (req, res) => {
  const purchaseTransId = req.params.id;
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Begin a transaction
    const transaction = pool.transaction();
    await transaction.begin();

    // Fetch the batch number and product associated with the purchase transaction
    const productDetailsResult = await transaction
      .request()
      .input("purchaseTransId", sql.Int, purchaseTransId)
      .query(
        "SELECT batchNo, product FROM PurchaseTable_Trans WHERE Id = @purchaseTransId"
      );

    if (productDetailsResult.recordset.length === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, error: "Purchased product not found" });
    }

    const { batchNo, product } = productDetailsResult.recordset[0];

    // Delete from PurchaseTable_Trans
    const deleteTransResult = await transaction
      .request()
      .input("purchaseTransId", sql.Int, purchaseTransId)
      .query("DELETE FROM PurchaseTable_Trans WHERE Id = @purchaseTransId");

    if (deleteTransResult.rowsAffected[0] === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, error: "Failed to delete purchased product" });
    }

    // Attempt to delete from stock_Ob
    const deleteStockResult = await transaction
      .request()
      .input("batchNo", sql.VarChar, batchNo)
      .input("product", sql.VarChar, product)
      .query(
        "DELETE FROM stock_Ob WHERE batchNo = @batchNo AND product = @product"
      );

    if (deleteStockResult.rowsAffected[0] === 0) {
      console.log("No stock found for deletion. Stock remains intact.");
    }

    // Commit the transaction
    await transaction.commit();

    return res.json({
      success: true,
      message:
        "Purchased product and related stock details processed successfully",
    });
  } catch (error) {
    console.error("Error deleting row:", error);
    await transaction.rollback(); // Ensure rollback on error
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.purchaseregister = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    pool.query(
      `SELECT P.*, S.ledgername AS suppliername,DM.discMode AS discModes
      FROM [PurchaseTable_Master] AS P
      LEFT JOIN [Supplier] AS S ON P.suppliername = S.id
       LEFT JOIN 
        [discmode] AS DM ON P.discMode = DM.id 
      where isDraft=0;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.purchasedraftregister = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    pool.query(
      `
      SELECT P.*, S.ledgername AS suppliername
      FROM [elite_pos].[dbo].[PurchaseTable_Master] AS P
      INNER JOIN [elite_pos].[dbo].[Supplier] AS S ON P.suppliername = S.id
      where isDraft=1;
    `,
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.purchaseids = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const query = `
      SELECT 
        pt.*
      FROM 
        [elite_pos].[dbo].[PurchaseTable_Master] pt;
    `;

    pool.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error("Error in fetching purchase IDs:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      res.header("Content-Type", "application/json");
      res.json({ data: result.recordset });
    });
  });
};

exports.PurchaseId = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
    SELECT
    pt.id AS purchaseId,
    pt.purchasedate,
    pt.paymentmode,
    pt.supplierinvoicedate,
    pt.modeoftransport,
    pt.transportno,
    pt.supplierinvoiceamount,
    pt.supplierinvoiceno,
    pt.suppliername,
    pr.productId,
    pr.productName,
    pr.batchNo,
    pr.tax,
    pr.kgs,
    pr.nos,
    pr.rate,
      pr.mrp,
    pr.discMode,
    pr.discount,
    pr.amount,
    pr.cgst,
    pr.sgst,
    pr.igst,
    pr.totalAmount
FROM
    [elite_pos].[dbo].[PurchaseTable_Master] AS pt
JOIN
    [elite_pos].[dbo].[PurchaseTable_Trans] AS pr
ON
    pt.id = pr.purchaseId;
    `;
    const request = connection.request();
    request.query(query, (err, result) => {
      connection.release();
      if (err) {
        console.error("Error in fetching data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

exports.productid = (req, res) => {
  const purchaseId = req.query.purchaseId;
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const query = `
    SELECT 
    pt.Id,
    pt.product, -- Assuming this is the product ID
    p.productname,
    dm.discMode,
    pt.batchNo,
FORMAT(pt.expiryDate,'MM-yyyy') AS expiryDate, 
    pt.tax,
    pt.quantity,
    pt.free,
    pt.package,
    pt.retailQty,
    pt.retailRate,
    pt.retailMrp,
    pt.uom,
    pt.rate,
    pt.mrp,
    pt.discount,
    pt.amount,
    pt.cgst,
    pt.sgst,
    pt.igst,
    pt.totalAmount
FROM 
    [elite_pos].[dbo].[PurchaseTable_Trans] pt
JOIN
    [elite_pos].[dbo].[product] p ON pt.product = p.id
JOIN
    [elite_pos].[dbo].[discmode] dm ON pt.discMode = dm.id
WHERE 
    pt.PurchaseId = '${purchaseId}';
`;
    pool.query(query, (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Query Result:", result);

      // Send the data as JSON response
      res.json({
        data: result.recordset.map((row) => ({
          ...row,
          product: row.productname,
        })),
      });
    });
  });
};

exports.supplierstate = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      "SELECT id,state  FROM [elite_pos].[dbo].[supplier]",
      (err, result) => {
        connection.release(); // Release the connection back to the pool

        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.companystate = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      "SELECT state  FROM [elite_pos].[dbo].[company] where id=1",
      (err, result) => {
        connection.release(); // Release the connection back to the pool

        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.getDataBySupplier = (req, res) => {
  const selectedSupplier = req.query.supplier; // Assuming the supplier is passed as a query parameter

  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const query = `
          SELECT *
          FROM [elite_pos].[dbo].[purchase_Master]
          WHERE suppliername = @suppliername
          ORDER BY id DESC;`;

    const request = connection.request();
    request.input("suppliername", sql.VarChar, selectedSupplier);

    request.query(query, (err, result) => {
      connection.release();

      if (err) {
        console.error("Error in fetching data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

exports.purchase = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      "SELECT *  FROM [elite_pos].[dbo].[purchase_Master]",
      (err, result) => {
        connection.release(); // Release the connection back to the pool

        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.purchaseadd = async (req, res) => {
  const {
    purchasedate,
    paymentmode,
    supplierinvoicedate,
    modeoftransport,
    transportno,
    supplierinvoiceamount,
    supplierinvoiceno,
    suppliername,
    pamount,
    pcgst,
    psgst,
    pigst,
    pnetAmount,
    pcess,
    ptcs,
    pdiscMode_,
    pdiscount,
    psubtotal,
    proundOff,
    isDraft,
    products: productsString,
  } = req.body;

  const formattedPurchaseDate = purchasedate || null;
  const formattedsupplierinvoicedate = supplierinvoicedate || null;

  try {
    await poolConnect();

    const parsedProducts = JSON.parse(productsString);

    const result = await pool.query`
      BEGIN TRANSACTION;
      DECLARE @purchaseId INT;

      INSERT INTO PurchaseTable_Master
      ([purchasedate], [paymentmode], [supplierinvoicedate], [modeoftransport], [transportno], [supplierinvoiceamount], [supplierinvoiceno], [suppliername], [amount], [cgst], [sgst], [igst], [netAmount], [cess], [tcs], [discMode], [discount], [subtotal], [roundoff], [isDraft])
      VALUES
      (${formattedPurchaseDate}, ${paymentmode}, ${formattedsupplierinvoicedate}, ${modeoftransport}, ${transportno}, ${supplierinvoiceamount}, ${supplierinvoiceno}, ${suppliername}, ${pamount}, ${pcgst}, ${psgst}, ${pigst}, ${pnetAmount}, ${pcess}, ${ptcs}, ${pdiscMode_}, ${pdiscount}, ${psubtotal}, ${proundOff}, ${isDraft});

      SET @purchaseId = SCOPE_IDENTITY(); -- Retrieve the SCOPE_IDENTITY() value

      COMMIT TRANSACTION;

      SELECT @purchaseId as purchaseId;
    `;

    const purchaseId = result.recordset[0].purchaseId;

    for (const product of parsedProducts) {
      const {
        productId,
        batchNo,
        expiryDate,
        tax,
        quantity,
        free,
        package,
        retailQty,
        retailRate,
        uom,
        rate,
        mrp,
        retailMrp,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;

      const quantityValue = parseFloat(quantity) || 0;
      const freeValue = parseFloat(free) || 0;
      const formattedExpiryDate = expiryDate
        ? new Date(expiryDate + "-01")
        : null;

      await pool.query`
        INSERT INTO PurchaseTable_Trans
        ([purchaseId], [product], [batchNo], [expiryDate], [tax], [quantity], [free], [package], [retailQty], [retailRate], [uom], [rate], [mrp], [retailMrp], [discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
        VALUES
        (${purchaseId}, ${productId}, ${batchNo}, ${formattedExpiryDate}, ${tax}, ${quantityValue}, ${freeValue}, ${package}, ${retailQty}, ${retailRate}, ${uom}, ${rate}, ${mrp}, ${retailMrp}, ${discMode}, ${discount}, ${amount}, ${cgst}, ${sgst}, ${igst}, ${totalAmount});
      `;

      // Conditionally add stock only if isDraft is 0
      if (isDraft == 0) {
        // Check if the product with the same batchNo and expiryDate already exists in stock_Ob
        const existingStock = await pool.query`
          SELECT * FROM stock_Ob
          WHERE product = ${productId} AND batchNo = ${batchNo} AND expiryDate = ${formattedExpiryDate}
        `;

        if (existingStock.recordset.length > 0) {
          // Update existing record
          await pool.query`
            UPDATE stock_Ob
            SET 
              quantity = quantity + ${quantityValue} + ${freeValue},
              retailQty = retailQty + ${retailQty},
              [op_quantity] = [op_quantity] + ${quantityValue} + ${freeValue},
              [IsActive]=1
            WHERE product = ${productId} AND batchNo = ${batchNo} AND expiryDate = ${formattedExpiryDate}
          `;
        } else {
          // Insert new record if not found
          await pool.query`
            INSERT INTO stock_Ob
            (product, batchNo, expiryDate, quantity, retailQty, retailRate, [op_quantity], tax, uom, rate, mrp, retailMrp, transDate)
            VALUES (${productId}, ${batchNo}, ${formattedExpiryDate}, (${quantityValue} + ${freeValue}), ${retailQty}, ${retailRate}, (${quantityValue} + ${freeValue}), ${tax}, ${uom}, ${rate}, ${mrp}, ${retailMrp}, ${formattedPurchaseDate});
          `;
        }
      }
    }

    res
      .status(200)
      .json({ success: true, message: "Purchase added successfully" });
  } catch (error) {
    console.error("Error during purchase processing:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


async function upsertStockWithExpiryCheck(
  productId,
  batchNo,
  formattedExpiryDate,
  quantityValue,
  freeValue,
  retailQty,
  retailRate,
  tax,
  uom,
  rate,
  mrp,
  retailMrp,
  purchaseDate
) {
  return pool.query`
    IF EXISTS (
      SELECT 1 
      FROM stock_Ob
      WHERE product = ${productId} 
        AND LTRIM(RTRIM(batchNo)) = LTRIM(RTRIM(${batchNo})) 
        AND expiryDate = ${formattedExpiryDate}
    )
    BEGIN
      -- Stock exists with matching expiry date, update it
      UPDATE stock_Ob
      SET 
        [quantity] = [quantity] + ${quantityValue} + ${freeValue},
        [op_quantity] = [op_quantity] + ${quantityValue} + ${freeValue},
        [retailQty] = [retailQty] + ${retailQty},
        [retailRate] = ${retailRate},
        [tax] = ${tax},
        [expiryDate] = ${formattedExpiryDate},
        [rate] = ${rate},
        [mrp] = ${mrp},
        [retailMrp] = ${retailMrp},
        [uom] = ${uom},
        [transDate] = ${purchaseDate}
      WHERE product = ${productId} AND LTRIM(RTRIM(batchNo)) = LTRIM(RTRIM(${batchNo})) AND expiryDate = ${formattedExpiryDate};
    END
    ELSE
    BEGIN
      -- Stock does not exist or expiry date differs, insert a new record
      INSERT INTO stock_Ob
      ([product], [batchNo], [expiryDate], [quantity], [retailQty], [retailRate], [op_quantity], [tax], [uom], [rate], [mrp], [retailMrp], [transDate])
      VALUES
      (${productId}, ${batchNo}, ${formattedExpiryDate}, (${quantityValue} + ${freeValue}), ${retailQty}, ${retailRate}, (${quantityValue} + ${freeValue}), ${tax}, ${uom}, ${rate}, ${mrp}, ${retailMrp}, ${purchaseDate});
    END;
  `;
}


exports.purchaseEdit = async (req, res) => {
  const { purchaseId } = req.params;
  const { purchaseDetails, products } = req.body;
  try {
    console.log("Received request to edit purchase:", req.body);

    // Update purchase master record
    await pool.query`
      UPDATE PurchaseTable_Master
      SET
          [purchaseDate] = ${purchaseDetails.purchaseDate},
          [paymentmode] = ${purchaseDetails.paymentMode},
          [supplierInvoiceDate] = ${purchaseDetails.supplierInvoiceDate},
          [modeOfTransport] = ${purchaseDetails.modeOfTransport},
          [transportNo] = ${purchaseDetails.transportNo},
          [supplierInvoiceAmount] = ${purchaseDetails.supplierInvoiceAmount},
          [supplierInvoiceNo] = ${purchaseDetails.supplierInvoiceNo},
          [supplierName] = ${purchaseDetails.supplierName},
          [amount] = ${purchaseDetails.pAmount},
          [cgst] = ${purchaseDetails.pCgst},
          [sgst] = ${purchaseDetails.pSgst},
          [igst] = ${purchaseDetails.pIgst},
          [netAmount] = ${purchaseDetails.pNetAmount},
          [cess] = ${purchaseDetails.pCess},
          [tcs] = ${purchaseDetails.pTcs},
          [discMode] = ${purchaseDetails.pdiscMode_},
          [discount] = ${purchaseDetails.pdiscount},
          [subtotal] = ${purchaseDetails.pSubtotal},
          [roundoff] = ${purchaseDetails.proundOff},
          [isDraft] = ${purchaseDetails.isDraft}
      WHERE
          [id] = ${purchaseDetails.id};
    `;

    // Process each product
    for (const product of products) {
      const {
        Id,
        productId,
        batchNo,
        expiryDate,
        tax,
        quantity,
        free,
        package,
        retailQty,
        retailRate,
        uom,
        rate,
        mrp,
        retailMrp,
        discMode,
        discount,
        amount,
        cgst,
        sgst,
        igst,
        totalAmount,
      } = product;

      const formattedExpiryDate = expiryDate
        ? new Date(expiryDate + "-01")
        : null;
      const quantityValue = parseFloat(quantity) || 0;
      const freeValue = parseFloat(free) || 0;

      let purchaseTransId;

      if (Id) {
        // Update existing product in PurchaseTable_Trans
        await pool.query`
          UPDATE PurchaseTable_Trans
          SET
              [product] = ${productId},
              [batchNo] = ${batchNo},
              [expiryDate] = ${formattedExpiryDate},
              [tax] = ${tax},
              [quantity] = ${quantity},
              [free] = ${free},
              [package] = ${package},
              [retailQty] = ${retailQty},
              [retailRate] = ${retailRate},
              [uom] = ${uom},
              [rate] = ${rate},
              [mrp] = ${mrp},
              [retailMrp] = ${retailMrp},
              [discMode] = ${discMode},
              [discount] = ${discount},
              [amount] = ${amount},
              [cgst] = ${cgst},
              [sgst] = ${sgst},
              [igst] = ${igst},
              [totalAmount] = ${totalAmount}
          WHERE
              [Id] = ${Id};
        `;
        purchaseTransId = Id;
      } else {
        // Insert new product into PurchaseTable_Trans
        const insertProductResult = await pool.query`
          INSERT INTO PurchaseTable_Trans
          ([purchaseId], [product], [batchNo], [expiryDate], [tax], [quantity], [free], [package], [retailQty], [retailRate], [uom], [rate], [mrp], [retailMrp], [discMode], [discount], [amount], [cgst], [sgst], [igst], [totalAmount])
          VALUES
          (${purchaseDetails.id}, ${productId}, ${batchNo}, ${formattedExpiryDate}, ${tax}, ${quantity}, ${free}, ${package}, ${retailQty}, ${retailRate}, ${uom}, ${rate}, ${mrp}, ${retailMrp}, ${discMode}, ${discount}, ${amount}, ${cgst}, ${sgst}, ${igst}, ${totalAmount});
          
          SELECT SCOPE_IDENTITY() AS insertedId;
        `;
        purchaseTransId = insertProductResult.recordset[0].insertedId;
      }

      // Conditionally update or insert stock only if isDraft is 0
      if (purchaseDetails.isDraft === "") {
        await pool.query`
        -- Conditionally update or insert stock only if isDraft is 0
 IF EXISTS (
      SELECT 1 
      FROM stock_Ob 
      WHERE product = ${productId} 
        AND LTRIM(RTRIM(batchNo)) = LTRIM(RTRIM(${batchNo})) 
        AND expiryDate = ${formattedExpiryDate}
    )
    BEGIN
      -- Stock exists with matching expiry date, update it
      UPDATE stock_Ob
      SET 
        [quantity] = [quantity] + ${quantityValue} + ${freeValue},
        [op_quantity] = [op_quantity] + ${quantityValue} + ${freeValue},
        [retailQty] = [retailQty] + ${retailQty},
        [retailRate] = ${retailRate},
        [tax] = ${tax},
        [expiryDate] = ${formattedExpiryDate},
        [rate] = ${rate},
        [mrp] = ${mrp},
        [retailMrp] = ${retailMrp},
        [uom] = ${uom},
        [transDate] = ${purchaseDetails.purchaseDate},
         [IsActive]=1
      WHERE product = ${productId} AND LTRIM(RTRIM(batchNo)) = LTRIM(RTRIM(${batchNo})) AND expiryDate = ${formattedExpiryDate};
    END
    ELSE
    BEGIN
      -- Stock does not exist or expiry date differs, insert a new record
      INSERT INTO stock_Ob
      ([product], [batchNo], [expiryDate], [quantity], [retailQty], [retailRate], [op_quantity], [tax], [uom], [rate], [mrp], [retailMrp], [transDate])
      VALUES
      (${productId}, ${batchNo}, ${formattedExpiryDate}, (${quantityValue} + ${freeValue}), ${retailQty}, ${retailRate}, (${quantityValue} + ${freeValue}), ${tax}, ${uom}, ${rate}, ${mrp}, ${retailMrp},${purchaseDetails.purchaseDate});
    END;
        `;
      }
    }

    console.log("Purchase edited successfully");
    res
      .status(200)
      .json({ success: true, message: "Purchase edited successfully" });
  } catch (error) {
    console.error("Error updating purchase:", error);
    res
      .status(400)
      .json({ success: false, message: "Failed to update purchase" });
  }
};

exports.purchaseDetails = async (req, res) => {
  try {
    await poolConnect();

    const result = await pool.request().execute("GetPurchaseDetails");

    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.salesDetails = async (req, res) => {
  try {
    await poolConnect();

    // Extract salesId from the query string (for GET requests)
    const { salesId } = req.query;

    if (!salesId) {
      return res.status(400).json({ error: "salesId parameter is required" });
    }

    // Pass the salesId parameter to the stored procedure
    const result = await pool
      .request()
      .input("salesId", sql.Int, salesId) // Assuming salesId is an integer
      .execute("GetSalespDetails");

    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.GetSupplierInvoiceData = async (req, res) => {
  try {
    await poolConnect();

    // Extract the suppliername from the query parameters
    const suppliername = parseInt(req.query.suppliername, 10);

    // Ensure suppliername is a number
    if (isNaN(suppliername)) {
      return res.status(400).json({ error: "Invalid suppliername" });
    }

    const result = await pool
      .request()
      .input("suppliername", sql.Numeric, suppliername) // Pass the parameter to the stored procedure
      .execute("GetSupplierInvoiceData");

    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Controller to check if the mobile number exists in the database
exports.checkMobileNumber = async (req, res) => {
  const mobileNo = req.query.mobileNo;

  const query = `
        SELECT COUNT(1) AS count 
        FROM [elite_pos].[dbo].[retailcustomer] 
        WHERE mobileno = @mobileNo
    `;

  try {
    const result = await pool
      .request()
      .input("mobileNo", mobileNo) // Bind the mobile number
      .query(query);

    const exists = result.recordset[0].count > 0;
    res.json({ exists }); // Return true if mobile number exists
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({ exists: false });
  }
};

exports.checkInvoiceNumber = async (req, res) => {
  const invoiceNo = req.query.invoiceNo;
  const supplierId = req.query.supplierId;
  const query = `
        SELECT COUNT(1) AS count 
        FROM [elite_pos].[dbo].[PurchaseTable_Master] 
        WHERE supplierinvoiceno = @invoiceNo and suppliername=@supplierId
    `;

  try {
    // Use pool.request() for parameterized queries
    const result = await pool
      .request()
      .input("invoiceNo", invoiceNo)
      .input("supplierId", supplierId) // Bind the parameter
      .query(query);

    const exists = result.recordset[0].count > 0;
    res.json({ exists: exists });
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({ exists: false });
  }
};

exports.productname = async (req, res) => {
  try {
    await poolConnect();

    const result = await pool.request().execute("GetProductName");

    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.productlastdetails = async (req, res) => {
  try {
    await poolConnect();

    const { productId } = req.query; // Retrieve the product ID from the request query

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    const result = await pool
      .request()
      .input("ProductId", productId) // Pass the ProductId as an input to the stored procedure
      .execute("GetProductDetailsWithTransactions");

    // If result.recordsets has more than one recordset, pick the first one or combine them as needed
    if (result.recordsets.length > 0) {
      res.json({ data: result.recordsets[0] }); // Send only the first recordset
    } else {
      res.json({ data: [] }); // Send an empty array if no data
    }
  } catch (error) {
    console.error(
      "Error in fetching product details with transactions:",
      error
    );
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


exports.discmode = async (req, res) => {
  try {
    await poolConnect();
    const result = await pool.request().execute("GetDiscModes");
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.suppliername = async (req, res) => {
  try {
    await poolConnect();
    const result = await pool.request().execute("GetSupplierNames");
    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//purchase

//contra//
exports.contraCr = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();
    const result = await pool.request().execute("GetContraCr");
    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.contraDr = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();
    const result = await pool.request().execute("GetContraDr");
    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.contraadd = async (req, res) => {
  console.log(req.body);
  const { contradate, cr, dr, billno, amount, discount, remarks } = req.body;
  // Handle date values
  const formattedcontraDate = contradate ? contradate : null;
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();
    const result = await pool
      .request()
      .input("contradate", sql.Date, formattedcontraDate)
      .input("cr", sql.VarChar(255), cr || null)
      .input("dr", sql.VarChar(255), dr || null)
      .input("billno", sql.VarChar(255), billno || null)
      .input("amount", sql.Decimal(18, 2), amount || null)
      .input("discount", sql.Decimal(18, 2), discount || null)
      .input("remarks", sql.VarChar(255), remarks || null)
      .execute("AddContra");
    console.log("Formatted contra Date:", formattedcontraDate);
    console.log("DR Value:", dr);
    console.log(result);
    // Redirect to another route after processing
    return res.redirect("/contra");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.contradelete = async (req, res) => {
  const manufacturerId = req.params.id;
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();
    const result = await pool
      .request()
      .input("manufacturerId", sql.Int, manufacturerId)
      .execute("DeleteContra");
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Contra deleted successfully",
      });
    } else {
      return res
        .status(200)
        .json({ success: true, message: "Contra not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.contraedit = async (req, res) => {
  const manufacturerId = req.params.id;
  const { contradate, cr, dr, billno, amount, discount, remarks } = req.body;
  // Handle date values
  const formattedcontraDate = contradate ? contradate : null;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Call the stored procedure to update the contra
    const result = await pool
      .request()
      .input("manufacturerId", sql.Int, manufacturerId)
      .input("contradate", sql.Date, formattedcontraDate)
      .input("cr", sql.VarChar(255), cr || null) // Use VARCHAR type
      .input("dr", sql.VarChar(255), dr || null) // Use VARCHAR type
      .input("billno", sql.VarChar(255), billno || null)
      .input("amount", sql.Decimal(18, 2), amount || null)
      .input("discount", sql.Decimal(18, 2), discount || null)
      .input("remarks", sql.VarChar(255), remarks || null)
      .execute("UpdateContra");

    // Check if the update operation was successful
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Contra updated successfully",
      });
    } else {
      // If no rows were affected, return success with appropriate message
      return res
        .status(200)
        .json({ success: true, message: "Multicontra not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.contra = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Call the stored procedure to get contra transactions
    const result = await pool.request().execute("GetContraTransactions");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error getting contra transactions:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
/*contra*/

/*creditnotes*/
exports.creditnoteparticulars = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Call the stored procedure to get credit note particulars
    const result = await pool.request().execute("GetCreditNoteParticulars");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error getting credit note particulars:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.creditnoteadd = async (req, res) => {
  console.log(req.body);
  const { creditnotedate, Particulars, dr, cr, billno, remarks } = req.body;

  // Handle date values
  const formattedcreditnoteDate = creditnotedate ? creditnotedate : null;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("creditnotedate", sql.Date, formattedcreditnoteDate)
      .input("particulars", sql.NVarChar(255), Particulars || null)
      .input("dr", sql.Decimal(18, 2), dr || null)
      .input("cr", sql.Decimal(18, 2), cr || null)
      .input("billno", sql.NVarChar(50), billno || null)
      .input("remarks", sql.NVarChar(255), remarks || null)
      .execute("AddCreditNote");

    console.log("Formatted creditnote Date:", formattedcreditnoteDate);
    console.log("DR Value:", dr);
    // ... add more log statements
    console.log(result);

    // Redirect to another route after processing
    return res.redirect("/creditnote");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.creditnotedelete = async (req, res) => {
  try {
    const creditNoteId = req.params.id;
    await poolConnect();
    const result = await pool
      .request()
      .input("creditNoteId", sql.Int, creditNoteId)
      .execute("DeleteCreditNote");

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Credit note deleted successfully",
      });
    } else {
      return res
        .status(200)
        .json({ success: true, message: "Credit note not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.creditnoteedit = async (req, res) => {
  const manufacturerId = req.params.id;
  const { creditnotedate, particulars, dr, cr, billno, remarks } = req.body;

  // Handle date values
  const formattedcreditnoteDate = creditnotedate ? creditnotedate : null;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const request = pool
      .request()
      .input("manufacturerId", sql.Int, manufacturerId)
      .input("creditnoteDate", sql.Date, formattedcreditnoteDate || null)
      .input("particulars", sql.NVarChar(255), particulars || null)
      .input("dr", sql.Decimal(18, 2), dr || null)
      .input("cr", sql.Decimal(18, 2), cr || null)
      .input("billno", sql.NVarChar(50), billno || null)
      .input("remarks", sql.NVarChar(255), remarks || null);

    const result = await request.execute("UpdateCreditNote");

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Credit note updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., credit note ID not found)
      return res
        .status(404)
        .json({ success: false, error: "Credit note not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.creditnote = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Call the stored procedure to get credit notes
    const result = await pool.request().execute("GetCreditNotes");

    // Send the data as JSON response
    return res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in getting credit notes:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
/*creditnotes*/

/*journals*/
exports.journalparticulars = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().execute("GetJournalParticulars");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in retrieving journal particulars:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.journaladd = async (req, res) => {
  console.log(req.body);
  const { journaldate, particulars, dr, cr, billno, remarks } = req.body;

  // Handle date values
  const formattedJournalDate = journaldate || null;
  const formattedParticulars = particulars || null;
  const formattedBillNo = billno || null;
  const formattedRemarks = remarks || null;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const request = pool
      .request()
      .input("journaldate", sql.Date, formattedJournalDate)
      .input("particulars", sql.NVarChar(255), formattedParticulars)
      .input("billno", sql.NVarChar(50), formattedBillNo)
      .input("remarks", sql.NVarChar(255), formattedRemarks);

    // Check if dr is empty or null before adding it as an input
    if (dr !== undefined && dr !== "") {
      request.input("dr", sql.Decimal(18, 2), dr);
    } else {
      request.input("dr", sql.Decimal(18, 2), null);
    }

    // Check if cr is empty or null before adding it as an input
    if (cr !== undefined && cr !== "") {
      request.input("cr", sql.Decimal(18, 2), cr);
    } else {
      request.input("cr", sql.Decimal(18, 2), null);
    }

    const result = await request.execute("AddJournalEntry");

    console.log("Formatted journal Date:", formattedJournalDate);
    console.log("DR Value:", dr);
    // ... add more log statements
    console.log(result);

    // Redirect to another route after processing
    return res.redirect("/journal");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.journaldelete = async (req, res) => {
  const manufacturerId = req.params.id;
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();
    const result = await pool
      .request()
      .input("manufacturerId", sql.Int, manufacturerId)
      .execute("DeleteJournalEntry");
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Journal deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Journal not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.journaledit = async (req, res) => {
  const manufacturerId = req.params.id;
  const { journaldate, particulars, dr, cr, billno, remarks } = req.body;

  // Parse journaldate to a date object
  const parsedJournalDate = journaldate ? new Date(journaldate) : null;

  // Format the journaldate parameter to 'YYYY-MM-DD' format if not null
  const formattedJournalDate = parsedJournalDate
    ? parsedJournalDate.toISOString().split("T")[0]
    : null;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Call the stored procedure to update the journal entry
    const result = await pool
      .request()
      .input("manufacturerId", sql.Int, manufacturerId)
      .input("journaldate", sql.Date, formattedJournalDate) // Pass the formatted journaldate
      .input("particulars", sql.NVarChar(255), particulars)
      .input("dr", sql.Decimal(18, 2), dr || null) // Pass null if dr is empty or null
      .input("cr", sql.Decimal(18, 2), cr || null) // Pass null if cr is empty or null
      .input("billno", sql.NVarChar(50), billno || null) // Pass null if billno is empty or null
      .input("remarks", sql.NVarChar(255), remarks || null) // Pass null if remarks is empty or null
      .execute("UpdateJournalEntry");

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Journal entry updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., journal ID not found)
      return res
        .status(404)
        .json({ success: false, error: "Journal entry not found" });
    }
  } catch (error) {
    console.error("Error in updating journal entry:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.journal = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Call the stored procedure to fetch journal data
    const result = await pool.request().execute("GetJournalData");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in fetching journal data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
/*journals*/

/*ledgerob*/
exports.ledgerData = async (req, res) => {
  const ledgerTypeDesc = req.query.ledgerTypeDesc;
  console.log(
    "Received request for ledger data with ledgerTypeDesc:",
    ledgerTypeDesc
  );

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Call the stored procedure with the ledgerTypeDesc parameter
    const result = await pool
      .request()
      .input("ledgerTypeDesc", sql.NVarChar, ledgerTypeDesc)
      .execute("GetLedgerData");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in fetching ledger data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.ledgerob = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().query("EXEC [dbo].[GetLedgerTypes]");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
/*ledgerob*/
//product//
exports.getcategory = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      "SELECT  [Product_Category] FROM [elite_pos].[dbo].[productcategory]",
      (err, result) => {
        connection.release(); // Release the connection back to the pool

        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

exports.getuom = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().query("EXEC [dbo].[GetUOM]");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.gettype = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().query("EXEC [dbo].[GetProductTypes]");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getdrugtype = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().query("EXEC [dbo].[Getdrugtype]");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getproduct = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().query("EXEC [dbo].[GetProductNames]");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
//product//

/*payment*/
exports.paymentCr = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().query("EXEC [dbo].[GetPaymentCrs]");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.paymentDr = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().query("EXEC [dbo].[GetPaymentDrS]");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.paymentadd = async (req, res) => {
  console.log(req.body);
  const { paymentdate, cr, dr, billno, amount, discount, remarks } = req.body;

  // Handle date values
  const formattedpaymentDate = paymentdate ? paymentdate : null;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("paymentdate", sql.Date, formattedpaymentDate)
      .input("cr", sql.NVarChar(255), cr)
      .input("dr", sql.NVarChar(255), dr)
      .input("billno", sql.NVarChar(255), billno)
      .input("amount", sql.Decimal(18, 2), amount)
      .input("discount", sql.Decimal(18, 2), discount)
      .input("remarks", sql.NVarChar(255), remarks)
      .query(
        "EXEC [dbo].[AddPayment] @paymentdate, @cr, @dr, @billno, @amount, @discount, @remarks"
      );

    console.log("Formatted payment Date:", formattedpaymentDate);
    console.log("DR Value:", dr);
    // ... add more log statements
    console.log(result);

    // Redirect to another route after processing
    return res.redirect("/payment");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.paymentdelete = async (req, res) => {
  const manufacturerId = req.params.id;
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();
    const result = await pool
      .request()
      .input(
        "manufacturerId",
        /* Assuming your parameter type is INT */ sql.Int,
        manufacturerId
      )
      .query("EXEC [dbo].[DeletePayment] @manufacturerId");
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Payment deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Payment not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.paymentedit = async (req, res) => {
  const manufacturerId = req.params.id;
  const { paymentdate, cr, dr, billno, amount, discount, remarks } = req.body;
  // Handle date values
  const formattedpaymentDate = paymentdate ? paymentdate : null;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();
    const result = await pool
      .request()
      .input(
        "manufacturerId",
        /* Assuming your parameter type is INT */ sql.Int,
        manufacturerId
      )
      .input("paymentdate", sql.Date, formattedpaymentDate)
      .input("cr", sql.NVarChar(255), cr)
      .input("dr", sql.NVarChar(255), dr)
      .input("billno", sql.NVarChar(255), billno)
      .input("amount", sql.Decimal(18, 2), amount)
      .input("discount", sql.Decimal(18, 2), discount)
      .input("remarks", sql.NVarChar(sql.MAX), remarks)
      .query(
        "EXEC [dbo].[UpdatePayment] @manufacturerId, @paymentdate, @cr, @dr, @billno, @amount, @discount, @remarks"
      );

    console.log("Formatted payment Date:", formattedpaymentDate);
    console.log("DR Value:", dr);
    // ... add more log statements
    console.log(result);
    console.log(result.toString());
    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "payment updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., payment ID not found)
      return res
        .status(404)
        .json({ success: false, error: "Payment not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.payment = (req, res) => {
  // Connect to the database pool
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // Execute the stored procedure
    connection.query("EXEC [dbo].[GetPayments]", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

/*----payment----*/

/*----recipt---*/

exports.receiptadd = async (req, res) => {
  console.log(req.body);
  const { receiptdate, dr, cr, billno, amount, discount, remarks } = req.body;

  // Handle date values
  const formattedReceiptDate = receiptdate ? receiptdate : null;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Execute the stored procedure
    const result = await pool
      .request()
      .input("receiptdate", formattedReceiptDate)
      .input("dr", dr)
      .input("cr", cr)
      .input("billno", billno)
      .input("amount", amount)
      .input("discount", discount)
      .input("remarks", remarks)
      .execute("[dbo].[InsertReceipt]");

    // Log the result
    console.log(result);

    // Redirect to another route after processing
    return res.redirect("/receipt");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.receiptdelete = async (req, res) => {
  const manufacturerId = req.params.id;
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Execute the stored procedure
    const result = await pool
      .request()
      .input("manufacturerId", manufacturerId)
      .execute("[dbo].[DeleteReceipt]");

    // Check if the deletion was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Receipt deleted successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., receipt ID not found)
      return res
        .status(404)
        .json({ success: false, error: "Receipt not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.receiptedit = async (req, res) => {
  const manufacturerId = req.params.id;
  const { receiptdate, dr, cr, billno, amount, discount, remarks } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Execute the stored procedure
    const result = await pool
      .request()
      .input("manufacturerId", manufacturerId)
      .input("receiptdate", receiptdate)
      .input("dr", dr)
      .input("cr", cr)
      .input("billno", billno)
      .input("amount", amount)
      .input("discount", discount)
      .input("remarks", remarks)
      .execute("[dbo].[UpdateReceipt]");

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Receipt updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., receipt ID not found)
      return res
        .status(404)
        .json({ success: false, error: "Receipt not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.receipt = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const request = connection.request();

    // Call the stored procedure
    request.execute("[dbo].[RetrieveReceiptData]", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error executing stored procedure:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

exports.receiptCr = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const request = connection.request();

    // Call the new stored procedure
    request.execute("[dbo].[RetrieveLedgerNames]", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error executing stored procedure:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

exports.receiptDr = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const request = connection.request();

    // Call the stored procedure
    request.execute("[dbo].[GetCustomerLedgerNames]", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error executing stored procedure:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

/*------receipt------*/
/*----multipayment---*/

exports.multipaymentadd = async (req, res) => {
  console.log(req.body);
  let transaction;
  let masterId;
  try {
    await poolConnect();
    const payments = req.body.payments.payments;

    if (!Array.isArray(payments) || payments.length === 0) {
      return res
        .status(400)
        .send(
          "Payments data is missing or not provided or not in correct format"
        );
    }

    transaction = pool.transaction();
    await transaction.begin();

    const { payment_date, cash_bank_ledger, customer_ledger, amount } =
      req.body; // Extract from the main request body

    // Ensure that the required properties are not null
    if (!payment_date || !cash_bank_ledger || !customer_ledger) {
      throw new Error(
        "One or more required properties are missing in the main request body"
      );
    }

    const masterInsertQuery = `
      INSERT INTO [elite_pos].[dbo].[payment_Master]
      ([paymentdate], [cash/bankLedger(dr)], [ledger(dr)], [amount])
      OUTPUT inserted.id
      VALUES
      (@payment_date, @cash_bank_ledger, @customer_ledger, @amount);
    `;

    const masterInsertResult = await transaction
      .request()
      .input("payment_date", payment_date)
      .input("cash_bank_ledger", cash_bank_ledger)
      .input("customer_ledger", customer_ledger)
      .input("amount", amount || null) // Allow amount to be null
      .query(masterInsertQuery);

    if (masterInsertResult.recordset.length === 1) {
      masterId = masterInsertResult.recordset[0].id;
    } else {
      console.error("Error inserting record into payment_Master table");
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: "Error inserting record into payment_Master table",
      });
    }

    for (const payment of payments) {
      const { billno, billdate, billamount, recdamount, discamount, balance } =
        payment;

      const transInsertQuery = `
        INSERT INTO [elite_pos].[dbo].[payment_Trans]
        ([id], [billno], [billdate], [billamount], [recdamount],[discamount], [balance])
        VALUES
        (@id, @billno, @billdate, @billamount, @recdamount, @discamount, @balance);
      `;

      await transaction
        .request()
        .input("id", masterId)
        .input("billno", billno)
        .input("billdate", billdate || null) // Allow billdate to be null
        .input("billamount", billamount || null) // Allow billamount to be null
        .input("recdamount", recdamount || null) // Allow recdamount to be null
        .input("discamount", discamount || null) // Allow discamount to be null
        .input("balance", balance || null) // Allow balance to be null
        .query(transInsertQuery);
    }

    await transaction.commit();
    console.log("Inserted all payments successfully");
    return res
      .status(200)
      .json({ success: true, message: "Payments added successfully" });
  } catch (error) {
    console.error("Error during payment processing:", error);
    if (transaction) {
      await transaction.rollback();
    }
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

exports.multipaymentedit = async (req, res) => {
  try {
    await poolConnect();

    const { purchaseId, masterData, transactionData } = req.body;

    if (
      !purchaseId ||
      !masterData ||
      !transactionData ||
      !Array.isArray(transactionData)
    ) {
      return res
        .status(400)
        .send("Invalid request format: missing or incorrect data");
    }

    const { payment_date, cash_bank_ledger, customer_ledger, amount } =
      masterData;

    if (!payment_date || !cash_bank_ledger || !customer_ledger) {
      throw new Error(
        "One or more required properties are missing in the master data"
      );
    }

    const request = pool.request();
    request.input("purchaseId", purchaseId);
    request.input("payment_date", payment_date);
    request.input("cash_bank_ledger", cash_bank_ledger);
    request.input("customer_ledger", customer_ledger);
    request.input("amount", amount || null);
    request.input("transactionData", JSON.stringify(transactionData));

    const result = await request.execute("UpdatePaymentData");
    console.log(result.recordset[0].Message);

    return res
      .status(200)
      .json({ success: true, message: "Payments updated successfully" });
  } catch (error) {
    console.error("Error during payment processing:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

exports.multipaymentdelete = async (req, res) => {
  const id = req.params.id;
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Execute the stored procedure
    const result = await pool
      .request()
      .input("id", /* Assuming your parameter type is INT */ sql.Int, id)
      .execute("DeleteMultipayment");

    // Send the result as JSON response
    res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.multipayment = (req, res) => {
  pool.query("EXEC GetPaymentDropdownOptions", (err, result) => {
    if (err) {
      console.error("Error in listing data:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // Extract the result and send it as JSON response
    const options = result.recordset.map((row) => ({
      value: row.id.toString(),
      label: row.label,
    }));

    res.json({ options });
  });
};

function formatDate(date) {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear().toString();
  return `${day}-${month}-${year}`;
}

exports.multipaymenttransdelete = async (req, res) => {
  try {
    const transId = parseInt(req.params.transId);

    await poolConnect();
    const result = await pool
      .request()
      .input("transId", sql.Int, transId)
      .execute("MultiPaymentTransDelete");

    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Receipt transaction not found" });
    }

    return res.json({
      success: true,
      message: "Receipt transaction deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting transaction:", error);

    if (error instanceof sql.RequestError) {
      return res
        .status(500)
        .json({ success: false, error: "Database error: " + error.message });
    } else {
      return res
        .status(500)
        .json({ success: false, error: "Internal Server Error" });
    }
  }
};

exports.multipaymentselect = async (req, res) => {
  const { id } = req.params;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .execute("MultiPaymentSelect");

    // Send the data as JSON response
    res.json({
      masterData: result.recordsets[0],
      transData: result.recordsets[1],
    });
  } catch (error) {
    console.error("Error in fetching payment data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getPaymentCr = async (req, res) => {
  try {
    await poolConnect();

    const result = await pool.request().execute("GetPaymentCr");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in getting payment data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getPaymentDr = async (req, res) => {
  try {
    await poolConnect();

    const result = await pool.request().execute("GetPaymentDr");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in getting payment data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/*----multipayment---*/

/*----multireceipt---*/
exports.multireceiptadd = async (req, res) => {
  console.log(req.body);
  let transaction;
  let masterId;
  try {
    await poolConnect();
    const receipts = req.body.receipts.receipts;

    if (!Array.isArray(receipts) || receipts.length === 0) {
      return res
        .status(400)
        .send(
          "Receipts data is missing or not provided or not in correct format"
        );
    }

    transaction = pool.transaction();
    await transaction.begin();

    const { receipt_date, cash_bank_ledger, customer_ledger, amount } =
      req.body; // Extract from the main request body

    // Ensure that the required properties are not null
    if (!receipt_date || !cash_bank_ledger || !customer_ledger || !amount) {
      throw new Error(
        "One or more required properties are missing in the main request body"
      );
    }

    // Execute the stored procedure to insert data
    const result = await transaction
      .request()
      .input("receipt_date", receipt_date)
      .input("cash_bank_ledger", cash_bank_ledger)
      .input("customer_ledger", customer_ledger)
      .input("amount", amount)
      .input("receipts", JSON.stringify(receipts))
      .execute("InsertMultiReceipt");

    await transaction.commit();
    console.log("Inserted all receipts successfully");
    return res
      .status(200)
      .json({ success: true, message: "Receipts added successfully" });
  } catch (error) {
    console.error("Error during receipt processing:", error);
    if (transaction) {
      await transaction.rollback();
    }
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

exports.multireceiptedit = async (req, res) => {
  try {
    const { purchaseId, masterData, transactionData } = req.body;

    if (!purchaseId || !masterData) {
      return res
        .status(400)
        .send("Invalid request format: missing purchaseId or masterData");
    }

    const { receipt_date, cash_bank_ledger, customer_ledger, amount } =
      masterData;

    // Convert transactionData to JSON string
    const transactionDataJson = JSON.stringify(transactionData);

    // Execute the stored procedure
    const result = await pool
      .request()
      .input("purchaseId", sql.Int, purchaseId)
      .input("receipt_date", sql.Date, receipt_date || null) // Set to null if undefined
      .input("cash_bank_ledger", sql.NVarChar(255), cash_bank_ledger || null) // Set to null if undefined
      .input("customer_ledger", sql.NVarChar(255), customer_ledger || null) // Set to null if undefined
      .input("amount", sql.Decimal(18, 2), amount || null) // Set to null if undefined
      .input("transactionData", sql.NVarChar(sql.MAX), transactionDataJson)
      .execute("UpdateMultiReceipt");

    // Return success message
    return res
      .status(200)
      .json({ success: true, message: result.recordset[0].Message });
  } catch (error) {
    console.error("Error during receipt processing:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

exports.multireceiptdelete = async (req, res) => {
  const id = req.params.id;
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Execute the stored procedure to delete data from both tables
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .execute("DeleteMultiReceipt");

    // Check if deletion was successful
    if (result.recordset[0].Success === 1) {
      return res.json({
        success: true,
        message: "Multireceipt deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Multireceipt not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.multireceipt = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Execute the stored procedure to fetch data from Recipt_Master table
    const result = await pool.request().execute("GetReceiptMasterDropdownData");

    // Extract the necessary data for the dropdown options
    const options = result.recordset.map((row) => ({
      value: row.id.toString(), // Convert id to string if necessary
      label: `ID: ${row.id}, Receipt Date: ${formatDate(
        row.reciptdate
      )}, Amount: ${row.amount}, Cash/Bank Ledger: ${
        row["cash/bankLedger(dr)"]
      }, Customer Ledger: ${row["customerLedger(cr)"]}`, // Customize this as needed
    }));

    // Send the options as JSON response
    res.json({ options });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

function formatDate(date) {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear().toString();
  return `${day}-${month}-${year}`;
}

exports.multireceipttransdelete = async (req, res) => {
  try {
    const transId = parseInt(req.params.transId); // Parse the received parameter as an integer

    // Check if the parsed transId is a valid number
    if (isNaN(transId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid transId parameter" });
    }

    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Execute the stored procedure to delete from Recipt_Trans table
    const result = await pool
      .request()
      .input("transId", sql.Int, transId)
      .execute("DeleteReciptTransById");

    // Check if any rows were affected
    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Receipt transaction not found" });
    }

    return res.json({
      success: true,
      message: "Receipt transaction deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.multireceiptselect = async (req, res) => {
  const { id } = req.params; // Assuming the ID is passed as a route parameter

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Execute the first stored procedure to fetch data from Recipt_Master table
    const masterResult = await pool
      .request()
      .input("id", sql.Int, id)
      .execute("GetReciptMasterById");

    // Execute the second stored procedure to fetch data from Recipt_Trans table
    const transResult = await pool
      .request()
      .input("id", sql.Int, id)
      .execute("GetReciptTransById");

    // Send the data as JSON response
    res.json({
      masterData: masterResult.recordset,
      transData: transResult.recordset,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getCr = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().execute("GetLedgerNames");

    // Send the data as JSON response
    return res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getDr = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().execute("GetCustomerLedgers");

    // Send the data as JSON response
    return res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
/*----multireceipt---*/

/*****subgroup */
exports.subgroupadd = async (req, res) => {
  const { subgroupname, parentgroup } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("subgroupname", sql.NVarChar(255), subgroupname)
      .input("parentgroup", sql.NVarChar(255), parentgroup)
      .execute("AddSubgroup");

    console.log(result);

    // Redirect to another route after processing
    return res.redirect("/subgroup");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.subgroupdelete = async (req, res) => {
  const subgroupId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("subgroupId", sql.Int, subgroupId)
      .execute("DeleteSubgroup");

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Subgroup deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Subgroup not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.subgroupedit = async (req, res) => {
  const subgroupId = req.params.id;

  // Extract the subgroup data from the request body
  const { subgroupname, parentgroup } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("subgroupId", sql.Int, subgroupId)
      .input("subgroupname", sql.NVarChar(255), subgroupname)
      .input("parentgroup", sql.NVarChar(255), parentgroup)
      .execute("UpdateSubgroup");

    console.log(result);
    console.log(result.toString());

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Subgroup updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., subgroup ID not found)
      return res
        .status(404)
        .json({ success: false, error: "Subgroup not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.subgroup = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().execute("GetSubgroups");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in fetching subgroups:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/*****subgroup */

/* ---ledger----*/
exports.ledgeradd = async (req, res) => {
  const {
    code,
    ledgername,
    group,
    subgroup,
    paymentlimit,
    openingdate,
    dramount,
    cramount,
    active,
  } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("code", sql.NVarChar(50), code || null)
      .input("ledgername", sql.NVarChar(255), ledgername || null)
      .input("group", sql.NVarChar(255), group || null)
      .input("subgroup", sql.NVarChar(255), subgroup || null)
      .input("paymentlimit", sql.Decimal(18, 2), paymentlimit || null)
      .input("openingdate", sql.Date, openingdate || null)
      .input("dramount", sql.Decimal(18, 2), dramount || null)
      .input("cramount", sql.Decimal(18, 2), cramount || null)
      .input("active", sql.Bit, active || null)
      .execute("AddLedger");

    console.log("Database Insert Result:", JSON.stringify(result, null, 2));
    return res.redirect("/ledger");
  } catch (error) {
    console.error(error);
    return res.status(500).send(`Internal Server Error: ${error.message}`);
  }
};

exports.ledgerdelete = async (req, res) => {
  const ledgerId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("ledgerId", sql.Int, ledgerId)
      .execute("DeleteLedger");

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Ledger deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Ledger not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.ledgeredit = async (req, res) => {
  const ledgerId = req.params.id;

  // Extract ledger data from the request body
  const {
    code,
    ledgername,
    group,
    subgroup,
    paymentlimit,
    openingdate,
    dramount,
    cramount,
    active,
  } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Execute the stored procedure to update the ledger
    const result = await pool
      .request()
      .input("ledgerId", sql.Int, ledgerId)
      .input("code", sql.NVarChar(50), code || null)
      .input("ledgername", sql.NVarChar(255), ledgername || null)
      .input("group", sql.NVarChar(255), group || null)
      .input("subgroup", sql.NVarChar(255), subgroup || null)
      .input("paymentlimit", sql.Decimal(18, 2), paymentlimit || null)
      .input("openingdate", sql.Date, openingdate || null)
      .input("dramount", sql.Decimal(18, 2), dramount || null)
      .input("cramount", sql.Decimal(18, 2), cramount || null)
      .input("active", sql.Bit, active || null)
      .execute("UpdateLedger");

    // Check the return value to determine the outcome of the operation
    if (result.returnValue === 0) {
      return res.json({
        success: true,
        message: "Ledger updated successfully",
      });
    } else if (result.returnValue === 1) {
      return res
        .status(404)
        .json({ success: false, error: "Ledger not found" });
    } else {
      // Handle unexpected errors
      console.error("Unexpected error occurred:", result);
      return res
        .status(500)
        .json({ success: false, error: "An unexpected error occurred" });
    }
  } catch (error) {
    console.error("Error updating ledger:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.ledger = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().execute("GetLedger");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/* ---ledger----*/

/* ---salesman----*/
exports.salesmanadd = async (req, res) => {
  const {
    code,
    ledgername,
    mobile,
    aadhar,
    email,
    openingdate,
    address,
    city,
    state,
    pincode,
  } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const request = pool.request();

    // Add input parameters, setting them to null if the corresponding values are null
    request.input("code", sql.NVarChar(50), code || null);
    request.input("ledgername", sql.NVarChar(100), ledgername || null);
    request.input("mobile", sql.NVarChar(20), mobile || null);
    request.input("aadhar", sql.NVarChar(20), aadhar || null);
    request.input("email", sql.NVarChar(100), email || null);
    request.input("openingdate", sql.Date, openingdate || null);
    request.input("address", sql.NVarChar(255), address || null);
    request.input("city", sql.NVarChar(100), city || null);
    request.input("state", sql.NVarChar(100), state || null);
    request.input("pincode", sql.NVarChar(10), pincode || null);

    const result = await request.execute("AddSalesman");

    console.log(result);

    // Redirect to another route after processing
    return res.redirect("/salesman");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.salesmandelete = async (req, res) => {
  const salesmanId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("salesmanId", sql.Int, salesmanId)
      .execute("DeleteSalesman");

    console.log(result);

    // Check if the delete was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "salesmanId deleted successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., salesman ID not found)
      return res
        .status(404)
        .json({ success: false, error: "salesmanId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.salesmanedit = async (req, res) => {
  const customerId = req.params.id;

  // Extract the customer data from the request body
  const {
    code,
    ledgername,
    mobile,
    aadhar,
    email,
    openingdate,
    address,
    city,
    state,
    pincode,
  } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("customerId", sql.Int, customerId)
      .input("code", sql.VarChar(50), code)
      .input("ledgername", sql.VarChar(100), ledgername)
      .input("mobile", sql.VarChar(20), mobile)
      .input("aadhar", sql.VarChar(20), aadhar)
      .input("email", sql.VarChar(100), email)
      .input("openingdate", sql.Date, openingdate)
      .input("address", sql.NVarChar(255), address)
      .input("city", sql.NVarChar(100), city)
      .input("state", sql.NVarChar(100), state)
      .input("pincode", sql.VarChar(20), pincode)
      .execute("UpdateSalesman");

    console.log(result);
    console.log(result.toString());

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "salesman updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., salesman ID not found)
      return res
        .status(404)
        .json({ success: false, error: "salesman not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.salesman = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().execute("GetSalesmen");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/* ---salesman----*/

/*****product */
exports.stockobadd = async (req, res) => {
  console.log(req.body);

  const { productname, batchno, batchexpiry, purcrate, mrp, optQty } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.query`
      INSERT INTO [elite_pos].[dbo].[stockob]
      (productname,batchno,batchexpiry,purcrate,mrp,optQty)
      VALUES
      ( ${productname}, ${batchno}, ${batchexpiry}, ${purcrate},  ${mrp} ,${optQty})
    `;
    console.log(result);
    console.log(result.toString());

    // Redirect to another route after processing
    return res.redirect("/stockob");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.stockobdelete = async (req, res) => {
  const stockobId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input(
        "stockobId",
        /* Assuming your parameter type is INT */ sql.Int,
        stockobId
      )
      .query(
        "DELETE FROM [elite_pos].[dbo].[stockob] WHERE id = @stockobId"
      );

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "stockobId deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "stockobId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.stockobedit = async (req, res) => {
  const stockobId = req.params.id;

  // Extract the product data from the request body
  const { productname, batchno, batchexpiry, purcrate, mrp, optQty } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.query`
      UPDATE [elite_pos].[dbo].[stockob]
      SET
      productname = ${productname},
      batchno = ${batchno},
      batchexpiry = ${batchexpiry},
      purcrate = ${purcrate},
      mrp = ${mrp},
      optQty = ${optQty}
      WHERE
        id = ${stockobId}
    `;

    console.log(result);
    console.log(result.toString());

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "stockob updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., product ID not found)
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.stockob = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().execute("GetStockOB");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/*****stockob */

/*****UOM */

exports.uomadd = async (req, res) => {
  const { unitname, shortname, baseunit, baseqty, complexunit } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("unitname", sql.NVarChar(100), unitname || null)
      .input("shortname", sql.NVarChar(50), shortname || null)
      .input("baseunit", sql.NVarChar(50), baseunit || null)
      .input("baseqty", sql.Decimal(18, 2), baseqty || null)
      .input("complexunit", sql.NVarChar(50), complexunit || null)
      .execute("AddUOM");

    console.log(result);
    console.log(result.toString());

    // Redirect to another route after processing
    return res.redirect("/uom");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.uomdelete = async (req, res) => {
  const uomId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("uomId", /* Assuming your parameter type is INT */ sql.Int, uomId)
      .execute("DeleteUOM");

    if (result.rowsAffected[0] > 0) {
      return res.json({ success: true, message: "uomId deleted successfully" });
    } else {
      return res.status(404).json({ success: false, error: "uomId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.uomedit = async (req, res) => {
  const uomId = req.params.id;

  // Extract the product data from the request body
  const { unitname, shortname, baseunit, baseqty, complexunit } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.query`
      UPDATE [elite_pos].[dbo].[uom]
      SET
      unitname = ${unitname},
      shortname = ${shortname},
      baseunit=${baseunit},
      baseqty=${baseqty},
      complexunit=${complexunit}
      WHERE
        id = ${uomId}
    `;

    console.log(result);
    console.log(result.toString());

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "uomId Type updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., product ID not found)
      return res.status(404).json({ success: false, error: "uomId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.uom = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    connection.query("EXEC GetUOMs", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

/*****UOM */

// Assuming you have the necessary imports and setup for the database connection

exports.color = async (req, res) => {
  const userId = req.params.id;
  const { mode } = req.body;

  try {
    // Connect to the database (replace this with your actual database connection logic)

    // Update the user's preferences in the database
    const result = await pool.query`
      UPDATE users
      SET mode = ${mode}
      WHERE id = ${userId}
    `;

    console.log(result);

    // Check if the update was successful
    if (result.returnValue !== undefined && result.returnValue > 0) {
      return res.json({
        success: true,
        message: "Mode updated successfully",
        mode: mode,
      });
    } else {
      return res.status(404).json({ success: false, error: "User not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

/*****productcategory */

exports.productcategoryadd = async (req, res) => {
  console.log(req.body);

  const { categorycode, productcategory, active } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("CategoryCode", sql.VarChar(50), categorycode)
      .input("ProductCategory", sql.VarChar(100), productcategory)
      .input("Active", sql.Bit, active)
      .execute("AddProductCategory");

    console.log(result);
    console.log(result.toString());

    // Redirect to another route after processing
    return res.redirect("/productCategory");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.productcategorydelete = async (req, res) => {
  const CategoryId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("CategoryId", sql.Int, CategoryId)
      .execute("DeleteProductCategory");

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Product category deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Product category not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.productcategoryedit = async (req, res) => {
  const productcategoryId = req.params.id;

  // Extract the product category data from the request body
  const { categorycode, productcategory, active } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const request = pool
      .request()
      .input("productcategoryId", sql.Int, productcategoryId)
      .input("categorycode", sql.VarChar(50), categorycode || null) // Allow null value for categorycode
      .input("productcategory", sql.VarChar(100), productcategory || null) // Allow null value for productcategory
      .input("active", sql.Bit, active || null); // Allow null value for active

    const result = await request.execute("UpdateProductCategoryProcedure");

    console.log(result);
    console.log(result.toString());

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Product Category updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., product category ID not found)
      return res
        .status(404)
        .json({ success: false, error: "Product Category not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.productcategory = (req, res) => {
  // Connect to the database
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    // Execute the stored procedure to get product categories
    const request = new sql.Request(connection);
    request.execute("GetProductCategoriesProcedure", (err, result) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error("Error in listing data:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Send the data as JSON response
      res.json({ data: result.recordset });
    });
  });
};

/*****productcategory */

/*****drugtype */

exports.drugtypeadd = async (req, res) => {
  console.log(req.body);

  const { typecode, drugtype } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.query`
      INSERT INTO [elite_pos].[dbo].[drugtype]
      (typecode, drugtype)
      VALUES
      ( ${typecode}, ${drugtype})
    `;
    console.log(result);
    console.log(result.toString());

    // Redirect to another route after processing
    return res.redirect("/drugtype");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.drugtypedelete = async (req, res) => {
  const producttypeId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input(
        "producttypeId",
        /* Assuming your parameter type is INT */ sql.Int,
        producttypeId
      )
      .query(
        "DELETE FROM [elite_pos].[dbo].[drugtype] WHERE id = @producttypeId"
      );

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "product deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "productId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.drugtypeedit = async (req, res) => {
  const productId = req.params.id;

  // Extract the product data from the request body
  const { typecode, drugtype } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.query`
      UPDATE [elite_pos].[dbo].[drugtype]
      SET
      typecode = ${typecode},
      drugtype = ${drugtype}
      WHERE
        id = ${productId}
    `;

    console.log(result);
    console.log(result.toString());

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Product Type updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., product ID not found)
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.drugtype = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      "SELECT *  FROM [elite_pos].[dbo].[drugtype]",
      (err, result) => {
        connection.release(); // Release the connection back to the pool

        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

/*****drugtype */

/*****producttype */

exports.producttypeadd = async (req, res) => {
  console.log(req.body);

  const { typecode, producttype,profitMargin } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.query`
      INSERT INTO [elite_pos].[dbo].[producttype]
      (typecode, producttype,profitMargin)
      VALUES
      ( ${typecode}, ${producttype},${profitMargin})
    `;
    console.log(result);
    console.log(result.toString());

    // Redirect to another route after processing
    return res.redirect("/producttype");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.producttypedelete = async (req, res) => {
  const producttypeId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input(
        "producttypeId",
        /* Assuming your parameter type is INT */ sql.Int,
        producttypeId
      )
      .query(
        "DELETE FROM producttype WHERE id = @producttypeId"
      );

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "product deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "productId not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.producttypeedit = async (req, res) => {
  const productId = req.params.id;

  // Extract the product data from the request body
  const { typecode, producttype,profitMargin } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.query`
      UPDATE producttype
      SET
      typecode = ${typecode},
      producttype = ${producttype},
      profitMargin=${profitMargin}
      WHERE
        id = ${productId}
    `;

    console.log(result);
    console.log(result.toString());

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Product Type updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., product ID not found)
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.producttype = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      "SELECT * FROM producttype ",
      (err, result) => {
        connection.release(); // Release the connection back to the pool

        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        // Send the data as JSON response
        res.json({ data: result.recordset });
      }
    );
  });
};

/*****producttype */

/*****product */

exports.productadd = async (req, res) => {
  console.log(req.body);

  const {
    code,
    productname,
    description,
    hsnCode,
    category,
    productType,
    drugtype,
    uom,
    tax,
    active,
    manufacturer,
    combination,
    package,
  } = req.body;

  // Function to convert empty strings to null
  const convertToNull = (value) => (value === "" ? null : value);

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("code", sql.VarChar(50), convertToNull(code))
      // Assuming you have the necessary setup for sql and convertToNull
      .input("productname", sql.NVarChar(sql.MAX), convertToNull(productname))

      .input("description", sql.NVarChar(sql.MAX), convertToNull(description))
      .input("hsnCode", sql.VarChar(50), convertToNull(hsnCode))
      .input("category", sql.VarChar(50), convertToNull(category))
      .input("productType", sql.VarChar(50), convertToNull(productType))
      .input("drugtype", sql.VarChar(50), convertToNull(drugtype))
      .input("manufacturer", sql.VarChar(50), convertToNull(manufacturer))
      .input("combination", sql.NVarChar(sql.MAX), convertToNull(combination))
      .input("package", sql.VarChar(50), convertToNull(package))
      .input("uom", sql.VarChar(50), convertToNull(uom))
      .input("tax", sql.Decimal(18, 2), tax !== "" ? tax : null) // Convert empty tax to null
      .input("active", sql.Bit, active) // No need to convert active to null
      .execute("InsertProduct");

    console.log(result);
    console.log(result.toString());

    // Redirect to another route after processing
    return res.redirect("/product");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.productdelete = async (req, res) => {
  const productId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("productId", sql.Int, productId)
      .execute("DeleteProductProcedure");

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Product deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Product ID not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.productedit = async (req, res) => {
  const productId = req.params.id;

  // Extract the product data from the request body
  const {
    code,
    productname,
    description,
    hsnCode,
    category,
    productType,
    drugtype,
    uom,
    tax,
    active,
    manufacturer,
    combination,
    package,
  } = req.body;

  // Function to convert empty strings to null
  const convertToNull = (value) => (value === "" ? null : value);

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("productId", sql.Int, productId)
      .input("code", sql.VarChar(50), convertToNull(code))
      .input("productname", sql.NVarChar(sql.MAX), convertToNull(productname))
      .input("description", sql.NVarChar(sql.MAX), convertToNull(description))
      .input("hsnCode", sql.VarChar(50), convertToNull(hsnCode))
      .input("category", sql.VarChar(50), convertToNull(category))
      .input("productType", sql.VarChar(50), convertToNull(productType))
      .input("drugtype", sql.VarChar(50), convertToNull(drugtype))
      .input("manufacturer", sql.VarChar(50), convertToNull(manufacturer))
      .input("combination", sql.NVarChar(sql.MAX), convertToNull(combination))
      .input("package", sql.VarChar(50), convertToNull(package))
      .input("uom", sql.VarChar(50), convertToNull(uom))
      .input("tax", sql.Decimal(18, 2), tax !== "" ? tax : null) // Convert empty tax to null
      .input("active", sql.Bit, active)
      .execute("UpdateProduct");

    console.log(result);
    console.log(result.toString());

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Product updated successfully",
      });
    } else {
      // The update operation was successful, but no rows were affected
      // Return a 200 status code to indicate success
      return res
        .status(200)
        .json({ success: true, message: "Product updated successfully" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.product = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool.request().execute("GetProducts");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
/*****product */

/*****customerdisc */

exports.customerdiscadd = async (req, res) => {
  const { customername, products, disc, discmoney } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("customername", sql.NVarChar(100), customername)
      .input("products", sql.NVarChar(100), products)
      .input("disc", sql.Decimal(18, 2), disc)
      .input("discmoney", sql.Decimal(18, 2), discmoney)
      .execute("AddCustomerDiscount");

    // Redirect to another route after processing
    return res.redirect("/customerdisc");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.customerdiscdelete = async (req, res) => {
  const customerdiscId = req.params.id;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("customerdiscId", sql.Int, customerdiscId)
      .execute("DeleteCustomerDiscount");

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Customer discount deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Customer discount not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.customerdiscedit = async (req, res) => {
  const customerdiscId = req.params.id;

  // Extract the customer data from the request body
  const { customername, products, disc, discmoney } = req.body;

  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    const result = await pool
      .request()
      .input("customerdiscId", sql.Int, customerdiscId)
      .input("customername", sql.VarChar(100), customername)
      .input("products", sql.VarChar(255), products)
      .input("disc", sql.Decimal(18, 2), disc)
      .input("discmoney", sql.Decimal(18, 2), discmoney)
      .execute("UpdateCustomerDiscount");

    console.log(result);
    console.log(result.toString());

    // Check if the update was successful (at least one row affected)
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Customer discount updated successfully",
      });
    } else {
      // Handle the case where no rows were affected (e.g., customer discount ID not found)
      return res
        .status(404)
        .json({ success: false, error: "Customer discount not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.customerdisc = async (req, res) => {
  try {
    await poolConnect();

    const result = await pool.request().execute("GetCustomerDiscounts");

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/*****customerdisc */

/*----manufacturer---*/
exports.manufactureradd = async (req, res) => {
  console.log(req.body);

  // Function to convert empty strings to null
  const convertToNull = (value) => (value === "" ? null : value);

  const {
    code,
    manufacturername,
    contactNo,
    gstin,
    address,
    city,
    state,
    pincode,
  } = req.body;

  try {
    await poolConnect();

    const result = await pool
      .request()
      .input("code", sql.VarChar(50), convertToNull(code))
      .input(
        "manufacturername",
        sql.VarChar(100),
        convertToNull(manufacturername)
      )
      .input("contactNo", sql.VarChar(20), convertToNull(contactNo))
      .input("gstin", sql.VarChar(50), convertToNull(gstin))
      .input("address", sql.NVarChar, convertToNull(address))
      .input("city", sql.VarChar(50), convertToNull(city))
      .input("state", sql.VarChar(50), convertToNull(state))
      .input("pincode", sql.VarChar(20), convertToNull(pincode))
      .execute("AddManufacturerProcedure");

    console.log(result);
    console.log(result.toString());

    return res.redirect("/manufacturer");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.manufacturerdelete = async (req, res) => {
  const manufacturerId = req.params.id;
  try {
    // Establish a connection to the database
    await poolConnect();

    // Execute the stored procedure to delete the manufacturer
    const result = await pool
      .request()
      .input("manufacturerId", sql.Int, manufacturerId)
      .execute("DeleteManufacturer");

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Manufacturer updated successfully",
      });
    } else {
      // The update operation was successful, but no rows were affected
      // Return a 200 status code to indicate success
      return res
        .status(200)
        .json({ success: true, message: "Manufacturer updated successfully" });
    }
  } catch (error) {
    // Log any errors that occur during the process
    console.error(error);
    // Return internal server error response
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.manufactureredit = async (req, res) => {
  const manufacturerId = req.params.id;

  const {
    code,
    manufacturername,
    contactNo,
    gstin,
    address,
    city,
    state,
    pincode,
  } = req.body;

  try {
    await poolConnect();

    const result = await pool
      .request()
      .input("manufacturerId", sql.Int, manufacturerId)
      .input("code", sql.VarChar(50), code || null)
      .input("manufacturername", sql.VarChar(100), manufacturername || null)
      .input("contactNo", sql.VarChar(20), contactNo || null)
      .input("gstin", sql.VarChar(50), gstin || null)
      .input("address", sql.NVarChar, address || null)
      .input("city", sql.VarChar(50), city || null)
      .input("state", sql.VarChar(50), state || null)
      .input("pincode", sql.VarChar(20), pincode || null)
      .execute("UpdateManufacturer");

    console.log(result);
    console.log(result.toString());

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Manufacturer updated successfully",
      });
    } else {
      return res
        .status(200)
        .json({ success: true, message: "Manufacturer updated successfully" });
    }
  } catch (error) {
    console.error(error.message); // Log the error message
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.manufacturer = async (req, res) => {
  try {
    await poolConnect();

    const result = await pool.request().execute("GetManufacturers");

    console.log(result);
    console.log(result.recordset);

    return res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error in listing data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/*----manufacturer---*/

/* ---customer----*/

exports.customeradd = async (req, res) => {
  console.log(req.body);

  const {
    code,
    ledgername,
    subgroup,
    gstin,
    pan,
    contactPerson,
    mobile,
    phone,
    email,
    creditday,
    creditlimit,
    allowdisc,
    disc,
    pmtmode,
    address,
    city,
    state,
    location,
    pincode,
    beneficeiryname,
    acctnumber,
    ifsc,
    bankname,
    bankbranch,
    bankphone,
    openingdate,
    dramount,
    cramount,
    active,
    dl1,
    dl2,
  } = req.body;

  try {
    await poolConnect();

    // Convert empty strings to null
    const creditdayValue = creditday === "" ? null : creditday;
    const allowdiscValue = allowdisc === "" ? null : allowdisc;

    const result = await pool
      .request()
      .input("code", sql.VarChar(255), code || null)
      .input("ledgername", sql.VarChar(255), ledgername || null)
      .input("subgroup", sql.VarChar(255), subgroup || null)
      .input("gstin", sql.VarChar(255), gstin || null)
      .input("pan", sql.VarChar(255), pan || null)
      .input("contactPerson", sql.VarChar(255), contactPerson || null)
      .input("mobile", sql.VarChar(255), mobile || null)
      .input("phone", sql.VarChar(255), phone || null)
      .input("email", sql.VarChar(255), email || null)
      .input("creditday", sql.VarChar(255), creditdayValue)
      .input("creditlimit", sql.Decimal(18, 2), creditlimit || null)
      .input("allowdisc", sql.VarChar(255), allowdiscValue)
      .input("disc", sql.Decimal(18, 2), disc || null)
      .input("pmtmode", sql.VarChar(255), pmtmode || null)
      .input("address", sql.NVarChar, address || null)
      .input("city", sql.VarChar(255), city || null)
      .input("state", sql.VarChar(255), state || null)
      .input("location", sql.VarChar(255), location || null)
      .input("pincode", sql.VarChar(255), pincode || null)
      .input("beneficeiryname", sql.VarChar(255), beneficeiryname || null)
      .input("acctnumber", sql.VarChar(255), acctnumber || null)
      .input("ifsc", sql.VarChar(255), ifsc || null)
      .input("bankname", sql.VarChar(255), bankname || null)
      .input("bankbranch", sql.VarChar(255), bankbranch || null)
      .input("bankphone", sql.VarChar(255), bankphone || null)
      .input("openingdate", sql.Date, openingdate || null)
      .input("dramount", sql.Decimal(18, 2), dramount || null)
      .input("cramount", sql.Decimal(18, 2), cramount || null)
      .input("active", sql.Bit, active || null)
      .input("dl1", sql.NVarChar(sql.MAX), dl1 || null)
      .input("dl2", sql.NVarChar(sql.MAX), dl2 || null)
      .execute("AddCustomerProcedure");

    console.log(result);
    console.log(result.toString());
    return res.redirect("/customer");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.customerdelete = async (req, res) => {
  const customerId = req.params.id;
  try {
    await poolConnect();

    const result = await pool
      .request()
      .input("customerId", sql.Int, customerId)
      .execute("DeleteCustomerProcedure");

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Customer deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.customeredit = async (req, res) => {
  const customerId = req.params.id;
  const {
    code,
    ledgername,
    subgroup,
    gstin,
    pan,
    contactPerson,
    mobile,
    phone,
    email,
    creditday,
    creditlimit,
    allowdisc,
    disc,
    pmtmode,
    address,
    city,
    state,
    location,
    pincode,
    beneficeiryname,
    acctnumber,
    ifsc,
    bankname,
    bankbranch,
    bankphone,
    openingdate,
    dramount,
    cramount,
    active,
    dl1,
    dl2,
  } = req.body;

  // Convert empty strings to null
  const convertToNull = (value) => (value === "" ? null : value);

  try {
    await poolConnect();

    const result = await pool
      .request()
      .input("CustomerId", sql.Int, customerId)
      .input("Code", sql.VarChar(50), convertToNull(code))
      .input("LedgerName", sql.VarChar(100), convertToNull(ledgername))
      .input("Subgroup", sql.VarChar(100), convertToNull(subgroup))
      .input("Gstin", sql.VarChar(50), convertToNull(gstin))
      .input("Pan", sql.VarChar(50), convertToNull(pan))
      .input("ContactPerson", sql.VarChar(100), convertToNull(contactPerson))
      .input("Mobile", sql.VarChar(20), convertToNull(mobile))
      .input("Phone", sql.VarChar(20), convertToNull(phone))
      .input("Email", sql.VarChar(100), convertToNull(email))
      .input("CreditDay", sql.Int, creditday)
      .input("CreditLimit", sql.Decimal(18, 2), convertToNull(creditlimit))
      .input("AllowDisc", sql.Bit, allowdisc)
      .input("Disc", sql.Decimal(18, 2), convertToNull(disc))
      .input("PmtMode", sql.VarChar(50), convertToNull(pmtmode))
      .input("Address", sql.NVarChar, convertToNull(address))
      .input("City", sql.NVarChar, convertToNull(city))
      .input("State", sql.NVarChar, convertToNull(state))
      .input("Location", sql.NVarChar, convertToNull(location))
      .input("Pincode", sql.NVarChar, convertToNull(pincode))
      .input("BeneficeiryName", sql.NVarChar, convertToNull(beneficeiryname))
      .input("AcctNumber", sql.NVarChar, convertToNull(acctnumber))
      .input("Ifsc", sql.NVarChar, convertToNull(ifsc))
      .input("BankName", sql.NVarChar, convertToNull(bankname))
      .input("BankBranch", sql.NVarChar, convertToNull(bankbranch))
      .input("BankPhone", sql.NVarChar, convertToNull(bankphone))
      .input("OpeningDate", sql.Date, convertToNull(openingdate))
      .input("DRAmount", sql.Decimal(18, 2), convertToNull(dramount))
      .input("CRAmount", sql.Decimal(18, 2), convertToNull(cramount))
      .input("dl1", sql.NVarChar(sql.MAX), convertToNull(dl1))
      .input("dl2", sql.NVarChar(sql.MAX), convertToNull(dl2))
      .input("Active", sql.Bit, active)
      .execute("UpdateCustomerProcedure");

    console.log(result);
    console.log(result.toString());
    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Customer updated successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.customer = async (req, res) => {
  try {
    await poolConnect();

    const result = await pool.request().execute("GetCustomerData");

    if (result.recordset.length > 0) {
      return res.json({ data: result.recordset });
    } else {
      return res.status(404).json({ error: "No data found" });
    }
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/* ---customer----*/

exports.city = async (req, res) => {
  try {
    await poolConnect();

    const result = await pool.request().execute("GetCityData");

    console.log(result);

    if (result.recordset.length > 0) {
      return res.json({ data: result.recordset });
    } else {
      return res.status(404).json({ error: "No data found" });
    }
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/* ---supplier----*/

exports.supplieradd = async (req, res) => {
  console.log(req.body);

  const {
    code,
    ledgername,
    subgroup,
    gstin,
    pan,
    contactPerson,
    mobile,
    phone,
    email,
    allowdisc,
    disc,
    pmtmode,
    paymentlimit,
    address,
    city,
    state,
    location,
    pincode,
    beneficeiryname,
    acctnumber,
    ifsc,
    bankname,
    bankbranch,
    bankphone,
    openingdate,
    dramount,
    cramount,
    active,
    dl1,
    dl2,
  } = req.body;

  try {
    await poolConnect();

    const result = await pool
      .request()
      .input("Code", sql.NVarChar, code)
      .input("LedgerName", sql.NVarChar, ledgername)
      .input("Subgroup", sql.NVarChar, subgroup)
      .input("GSTIN", sql.NVarChar, gstin)
      .input("PAN", sql.NVarChar, pan)
      .input("ContactPerson", sql.NVarChar, contactPerson)
      .input("Mobile", sql.NVarChar, mobile)
      .input("Phone", sql.NVarChar, phone)
      .input("Email", sql.NVarChar, email)
      .input("AllowDisc", sql.Bit, allowdisc)
      .input("Disc", sql.Decimal(18, 2), disc === "" ? null : disc)
      .input("PmtMode", sql.NVarChar, pmtmode)
      .input(
        "PaymentLimit",
        sql.Decimal(18, 2),
        paymentlimit === "" ? null : paymentlimit
      )
      .input("Address", sql.NVarChar, address)
      .input("City", sql.NVarChar, city)
      .input("State", sql.NVarChar, state)
      .input("Location", sql.NVarChar, location)
      .input("Pincode", sql.NVarChar, pincode)
      .input("BeneficeiryName", sql.NVarChar, beneficeiryname)
      .input("AcctNumber", sql.NVarChar, acctnumber)
      .input("IFSC", sql.NVarChar, ifsc)
      .input("BankName", sql.NVarChar, bankname)
      .input("BankBranch", sql.NVarChar, bankbranch)
      .input("BankPhone", sql.NVarChar, bankphone)
      .input("OpeningDate", sql.Date, openingdate === "" ? null : openingdate)
      .input("DRAmount", sql.Decimal(18, 2), dramount === "" ? null : dramount)
      .input("CRAmount", sql.Decimal(18, 2), cramount === "" ? null : cramount)
      .input("Active", sql.Bit, active)
      .input("dl1", sql.NVarChar(sql.MAX), dl1===""?null:dl1)
      .input("dl2", sql.NVarChar(sql.MAX), dl2===""?null:dl2)
      .execute("InsertSupplier");

    console.log(result);
    console.log(result.toString());
    return res.redirect("/supplier");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.supplierdelete = async (req, res) => {
  const supplierId = req.params.id;
  try {
    await poolConnect();

    const result = await pool
      .request()
      .input("supplierId", sql.Int, supplierId)
      .execute("DeleteSupplierProcedure");

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Supplier deleted successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Supplier not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.supplieredit = async (req, res) => {
  const supplierId = req.params.id;
  const {
    code,
    ledgername,
    subgroup,
    gstin,
    pan,
    contactPerson,
    mobile,
    phone,
    email,
    allowdisc,
    disc,
    pmtmode,
    paymentlimit,
    address,
    city,
    state,
    location,
    pincode,
    beneficeiryname,
    acctnumber,
    ifsc,
    bankname,
    bankbranch,
    bankphone,
    openingdate,
    dramount,
    cramount,
    active,
    dl1,
    dl2,
  } = req.body;

  try {
    await poolConnect();

    const result = await pool
      .request()
      .input("SupplierId", sql.Int, supplierId)
      .input("Code", sql.VarChar(50), code || null)
      .input("LedgerName", sql.VarChar(100), ledgername || null)
      .input("Subgroup", sql.VarChar(100), subgroup || null)
      .input("Gstin", sql.VarChar(50), gstin || null)
      .input("Pan", sql.VarChar(50), pan || null)
      .input("ContactPerson", sql.VarChar(100), contactPerson || null)
      .input("Mobile", sql.VarChar(20), mobile || null)
      .input("Phone", sql.VarChar(20), phone || null)
      .input("Email", sql.VarChar(100), email || null)
      .input("AllowDisc", sql.Bit, allowdisc)
      .input("Disc", sql.Decimal(18, 2), disc || null)
      .input("PmtMode", sql.VarChar(50), pmtmode || null)
      .input("PaymentLimit", sql.Decimal(18, 2), paymentlimit || null)
      .input("Address", sql.NVarChar, address || null)
      .input("City", sql.NVarChar, city || null)
      .input("State", sql.NVarChar, state || null)
      .input("Location", sql.NVarChar, location || null)
      .input("Pincode", sql.NVarChar, pincode || null)
      .input("BeneficeiryName", sql.NVarChar, beneficeiryname || null)
      .input("AcctNumber", sql.NVarChar, acctnumber || null)
      .input("Ifsc", sql.NVarChar, ifsc || null)
      .input("BankName", sql.NVarChar, bankname || null)
      .input("BankBranch", sql.NVarChar, bankbranch || null)
      .input("BankPhone", sql.NVarChar, bankphone || null)
      .input("OpeningDate", sql.Date, openingdate || null)
      .input("DRAmount", sql.Decimal(18, 2), dramount || null)
      .input("CRAmount", sql.Decimal(18, 2), cramount || null)
      .input("Active", sql.Bit, active)
      .input("dl1", sql.NVarChar(sql.MAX), dl1 || null)
      .input("dl2", sql.NVarChar(sql.MAX), dl2 || null)
      .execute("UpdateSupplierProcedure");

    console.log(result);

    if (result.rowsAffected[0] > 0) {
      return res.json({
        success: true,
        message: "Supplier updated successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Supplier not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.supplier = async (req, res) => {
  try {
    await poolConnect();

    const result = await pool.request().execute("GetSupplierProcedure");

    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error fetching supplier data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/* ---supplier----*/

/*user*/

exports.user = async (req, res) => {
  try {
    await poolConnect();

    const result = await pool.request().execute("GetUserProcedure");

    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id, username, email, roleId, password } = req.body;

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the user details in the database using parameterized query
    const query = `
      UPDATE [elite_pos].[dbo].[registeration] 
      SET [userid] = @username, [emailid] = @email, [role] = @roleId, [password] = @hashedPassword
      WHERE [id] = @id
    `;

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("username", sql.NVarChar, username)
      .input("email", sql.NVarChar, email)
      .input("roleId", sql.Int, roleId)
      .input("hashedPassword", sql.NVarChar, hashedPassword)
      .query(query);

    // Send success response
    res.status(200).json({ message: "User details updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      error: "An error occurred while updating the user. Please try again.",
    });
  }
};

exports.deleteUser = async (req, res) => {
  const userId = req.params.id; // Assuming userId is passed as a parameter
  try {
    await poolConnect();

    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .execute("DeleteUserProcedure");

    if (result.rowsAffected[0] > 0) {
      return res.json({ success: true, message: "User deleted successfully" });
    } else {
      return res.status(404).json({ success: false, error: "User not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.create = (req, res) => {
  // Extract data from request body
  const { username, password, email, role } = req.body;

  // Check if all required fields are present
  if (!username || !password || !email || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Connect to the database
  sql.connect(config, (err) => {
    if (err) {
      console.error("Error connecting to the database:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    try {
      // Create a new request object
      const request = new sql.Request();

      // Check if the email already exists
      const checkEmailQuery = `SELECT COUNT(*) AS count FROM [elite_pos].[dbo].[registeration] WHERE emailid = @email`;

      request.input("email", sql.NVarChar, email);

      request.query(checkEmailQuery, (err, result) => {
        if (err) {
          console.error("Error executing query:", err);
          sql.close(); // Close the database connection
          return res.status(500).json({ error: "Internal Server Error" });
        }

        const count = result.recordset[0].count;

        if (count > 0) {
          // Email already exists, send notification
          return res.status(400).json({ error: "Email already exists" });
        }

        // Email does not exist, proceed with user creation
        // Hash the password using bcrypt
        bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
          if (hashErr) {
            console.error("Error hashing password:", hashErr);
            sql.close(); // Close the database connection
            return res.status(500).json({ error: "Internal Server Error" });
          }

          // Insert the user into the database
          const insertQuery = `INSERT INTO [elite_pos].[dbo].[registeration] (userid, emailid, password, role) 
                               VALUES (@username, @email, @password, @role)`;

          // Bind parameters to the query
          request.input("username", sql.NVarChar, username);
          request.input("password", sql.NVarChar, hashedPassword); // Use hashed password
          request.input("role", sql.NVarChar, role);

          // Execute the insert query
          request.query(insertQuery, (insertErr, insertResult) => {
            if (insertErr) {
              console.error("Error executing insert query:", insertErr);
              sql.close(); // Close the database connection
              return res.status(500).json({ error: "Internal Server Error" });
            }

            // Insert successful
            sql.close(); // Close the database connection
            res.json({ message: "User created successfully" });
          });
        });
      });
    } catch (error) {
      console.error("Error executing query:", error);
      sql.close(); // Close the database connection
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
};

/*user*/

/*-------------account configuration----------------*/
exports.accountconfiguration = async (req, res, next) => {
  console.log(req.body);

  const {
    WholesaleLedger,
    CGSTLedger,
    SGSTLedger,
    IGSTLedger,
    Round0ffLedger,
    FreightLedger,
    OtherChargesLedger,
    DiscountLedger,
    PurchaseLedger,
    SalesLedger,
    CustomerLedger,
  } = req.body;

  try {
    await poolConnect();
    const result = await pool
      .request()
      .input("WholesaleLedger", sql.NVarChar(255), WholesaleLedger)
      .input("CGSTLedger", sql.NVarChar(255), CGSTLedger)
      .input("SGSTLedger", sql.NVarChar(255), SGSTLedger)
      .input("IGSTLedger", sql.NVarChar(255), IGSTLedger)
      .input("Round0ffLedger", sql.NVarChar(255), Round0ffLedger)
      .input("FreightLedger", sql.NVarChar(255), FreightLedger)
      .input("OtherChargesLedger", sql.NVarChar(255), OtherChargesLedger)
      .input("DiscountLedger", sql.NVarChar(255), DiscountLedger)
      .input("PurchaseLedger", sql.NVarChar(255), PurchaseLedger)
      .input("SalesLedger", sql.NVarChar(255), SalesLedger)
      .input("CustomerLedger", sql.NVarChar(255), CustomerLedger)
      .execute("InsertAccountConfigurationProcedure");

    console.log(result);
    return res.redirect("/accountconfiguration");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.updateAccountConfiguration = async (req, res) => {
  try {
    // Extract the required fields from req.body
    const {
      WholesaleLedger,
      CGSTLedger,
      SGSTLedger,
      IGSTLedger,
      Round0ffLedger,
      FreightLedger,
      OtherChargesLedger,
      DiscountLedger,
      PurchaseLedger,
      SalesLedger,
      CustomerLedger,
    } = req.body;

    await poolConnect();

    const result = await pool
      .request()
      .input("WholesaleLedger", sql.NVarChar(255), WholesaleLedger)
      .input("CGSTLedger", sql.NVarChar(255), CGSTLedger)
      .input("SGSTLedger", sql.NVarChar(255), SGSTLedger)
      .input("IGSTLedger", sql.NVarChar(255), IGSTLedger)
      .input("Round0ffLedger", sql.NVarChar(255), Round0ffLedger)
      .input("FreightLedger", sql.NVarChar(255), FreightLedger)
      .input("OtherChargesLedger", sql.NVarChar(255), OtherChargesLedger)
      .input("DiscountLedger", sql.NVarChar(255), DiscountLedger)
      .input("PurchaseLedger", sql.NVarChar(255), PurchaseLedger)
      .input("SalesLedger", sql.NVarChar(255), SalesLedger)
      .input("CustomerLedger", sql.NVarChar(255), CustomerLedger)
      .execute("UpdateAccountConfigurationProcedure");

    console.log(result);

    return res
      .status(200)
      .json({ message: "Account configuration updated successfully" });
  } catch (error) {
    console.error("Error updating account configuration:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getaccountconfiguration = async (req, res) => {
  try {
    // Ensure the database connection is established before proceeding
    await poolConnect();

    // Call the stored procedure
    const result = await pool
      .request()
      .execute("GetAccountConfigurationProcedure");

    console.log("Result:", result);

    // Send the data as JSON response
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error getting account configuration data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/*account configuration*/

/*company*/

exports.getcity = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    pool.query(
      "SELECT * FROM [elite_pos].[dbo].[city_Master]",
      (err, result) => {
        connection.release();

        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        } else {
          console.log(result);
        }

        res.json({ data: result.recordset });
      }
    );
  });
};

exports.getcompany = (req, res) => {
  pool.connect((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    pool.query(
      "SELECT * FROM [elite_pos].[dbo].[company]",
      (err, result) => {
        connection.release();
        if (err) {
          console.error("Error in listing data:", err);
          return res.status(500).json({ error: "Internal Server Error" });
        }
        const dataWithImages = result.recordset.map((row) => {
          if (row.logo && row.logo.length > 0) {
            const base64Image = Buffer.from(row.logo).toString("base64");
            const imageSrc = `data:image/jpeg;base64,${base64Image}`;
            row.logoSrc = imageSrc;
          }
          return row;
        });
        res.json({ data: dataWithImages });
      }
    );
  });
};

exports.updatecompany = async (req, res) => {
  try {
    upload.single("logo")(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        console.error("Multer error:", err);
        return res.status(400).json({ error: "File upload error" });
      } else if (err) {
        console.error("Unknown error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      const {
        id,
        companyName,
        address,
        billingName,
        state,
        city,
        pincode,
        cin,
        tin,
        gstin,
        pan,
        mobileNo,
        phoneNo,
        email,
        website,
        cashLedger,
        bankLedger,
        bookStartDate,
        discLedger,
        quotes,
        dl1,
        dl2
      } = req.body;

      let logo = null;

      if (req.file) {
        if (req.file.size > 0) {
          logo = req.file.buffer;
        } else {
          console.log("File is empty.");
        }
      } else {
        console.log("No file received.");
      }

      const companyId = parseInt(id, 10);

      await poolConnect();

      const request = pool
        .request()
        .input("Id", sql.Int, companyId)
        .input("CompanyName", sql.NVarChar, companyName)
        .input("Address", sql.NVarChar, address)
        .input("BillingName", sql.NVarChar, billingName)
        .input("State", sql.NVarChar, state)
        .input("City", sql.NVarChar, city)
        .input("Pincode", sql.NVarChar, pincode)
        .input("CIN", sql.NVarChar, cin)
        .input("TIN", sql.NVarChar, tin)
        .input("GSTIN", sql.NVarChar, gstin)
        .input("PAN", sql.NVarChar, pan)
        .input("MobileNo", sql.NVarChar, mobileNo)
        .input("PhoneNo", sql.NVarChar, phoneNo)
        .input("Email", sql.NVarChar, email)
        .input("Website", sql.NVarChar, website)
        .input("CashLedger", sql.NVarChar, cashLedger)
        .input("BankLedger", sql.NVarChar, bankLedger)
        .input("BookStartDate", sql.Date, bookStartDate)
        .input("DiscLedger", sql.NVarChar, discLedger)
        .input("quotes", sql.VarChar, quotes)
        .input("dl1", sql.NVarChar, dl1)
        .input("dl2", sql.NVarChar, dl2);
      if (logo !== null) {
        request.input("Logo", sql.VarBinary, logo);
      }

      const result = await request.execute("UpdateCompanyProcedure");

      console.log("Update result:", result);

      return res.status(200).json({ message: "Company updated successfully" });
    });
  } catch (error) {
    console.error("Error updating company:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.company = async (req, res, next) => {
  console.log(req.body);
  const {
    companyName,
    address,
    billingName,
    state,
    city,
    pincode,
    cin,
    tin,
    gstin,
    pan,
    mobileNo,
    phoneNo,
    email,
    website,
    cashLedger,
    bankLedger,
    bookStartDate,
    discLedger,
    quotes,
  } = req.body;
  try {
    await poolConnect();
    const logoFilePath = logoFile ? req.file.path : null;
    const result = await pool
      .request()
      .input("CompanyName", sql.NVarChar, companyName)
      .input("Address", sql.NVarChar, address)
      .input("BillingName", sql.NVarChar, billingName)
      .input("State", sql.NVarChar, state)
      .input("City", sql.NVarChar, city)
      .input("Pincode", sql.NVarChar, pincode)
      .input("CIN", sql.NVarChar, cin)
      .input("TIN", sql.NVarChar, tin)
      .input("GSTIN", sql.NVarChar, gstin)
      .input("PAN", sql.NVarChar, pan)
      .input("MobileNo", sql.NVarChar, mobileNo)
      .input("PhoneNo", sql.NVarChar, phoneNo)
      .input("Email", sql.NVarChar, email)
      .input("Website", sql.NVarChar, website)
      .input("CashLedger", sql.NVarChar, cashLedger)
      .input("BankLedger", sql.NVarChar, bankLedger)
      .input("BookStartDate", sql.Date, bookStartDate)
      .input("DiscLedger", sql.NVarChar, discLedger)
      .input("quotes", sql.VarChar, quotes)
      .input("LogoFilePath", sql.NVarChar, logoFilePath)
      .execute("InsertCompanyProcedure");
    console.log(result);
    return res.redirect("/company");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

/*company*/

/*login*/

async function getSidebarItemsForRole(roleName) {
  try {
    console.log("Role name:", roleName);
    if (!roleName) {
      throw new Error("Role name is undefined or empty.");
    }

    const result = await pool
      .request()
      .input("roleName", sql.NVarChar, roleName).query(`
        SELECT title, href,  menu
        FROM [elite_pos].[dbo].[menu_access_rights]
        WHERE [${roleName}] = 1`);

    return result.recordset;
  } catch (error) {
    console.error("Error fetching sidebar items for role:", error.message);
    return [];
  }
}

exports.sidebar = async (req, res) => {
  try {
    if (!req.session.userRole) {
      return res.status(403).json({ error: "Access denied" });
    }
    const sidebarItems = await getSidebarItemsForRole(req.session.userRole);
    res.status(200).json({ sidebarItems, role: req.session.userRole });
  } catch (error) {
    console.error("Error fetching sidebar:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.login = async (req, res) => {
  try {
    await poolConnect();
    const { emailid, password } = req.body;
    console.log("Checking user credentials...");

    // Fetch user details from DB
    const userQuery =
      await pool.query`SELECT ID, emailid, password, role FROM [elite_pos].[dbo].[registeration] WHERE emailid = ${emailid}`;

    if (userQuery.recordset.length === 0) {
      return res
        .status(401)
        .json({ msg: "Email or password incorrect", success: false });
    }

    const user = userQuery.recordset[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ msg: "Email or password incorrect", success: false });
    }

    // Get role name from role table
    const roleQuery = await pool
      .request()
      .input("roleId", sql.Int, user.role)
      .query("SELECT role FROM [role] WHERE id = @roleId");

    if (roleQuery.recordset.length === 0) {
      throw new Error("Role not found for user.");
    }

    const roleName = roleQuery.recordset[0].role;
    console.log("User Role:", roleName);

    // Store session data
    req.session.userRole = roleName;
    req.session.userId = user.ID;

    // Get sidebar items based on role
    const sidebarItems = await getSidebarItemsForRole(roleName);

    res.status(200).json({
      success: true,
      msg: "Login successful",
      role: roleName,
      sidebarItems,
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res
      .status(500)
      .json({ msg: "Internal server error", success: false });
  }
};


/*login*/

/*registration*/

exports.registration = async (req, res) => {
  try {
    await poolConnect();

    const { userid, emailid, password } = req.body;

    console.log("Checking if email is already taken");
    const emailCheckResult =
      await pool.query`SELECT emailid FROM [elite_pos].[dbo].[registeration] WHERE emailid = ${emailid}`;

    console.log("Email check result:", emailCheckResult);

    if (
      !emailCheckResult ||
      !emailCheckResult.recordset ||
      !Array.isArray(emailCheckResult.recordset)
    ) {
      console.error("Unexpected emailCheckResult format:", emailCheckResult);
      return res
        .status(500)
        .json({ msg: "An unexpected error occurred", msg_type: "error" });
    }

    if (emailCheckResult.recordset.length > 0) {
      return res
        .status(400)
        .json({ msg: "Email id already taken", msg_type: "error" });
    }

    if (!password || password.length < 8) {
      console.error("Invalid password:", password);
      return res.status(400).json({
        msg: "Invalid password (must be at least 8 characters long)",
        msg_type: "error",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 8);

    console.log("Inserting user into the database");
    await pool.query`INSERT INTO [elite_pos].[dbo].[registeration] (userid, emailid, password, role) VALUES (${userid}, ${emailid}, ${hashedPassword}, 6)`;

    console.log("User ID:", userid);
    console.log("Email ID:", emailid);
    console.log("Hashed Password:", hashedPassword);

    return res
      .status(200)
      .json({ msg: "User registration success", msg_type: "good" });
  } catch (error) {
    console.error("An error occurred:", error.message);
    return res
      .status(500)
      .json({ msg: "An error occurred", msg_type: "error" });
  }
};

/*registration*/  
