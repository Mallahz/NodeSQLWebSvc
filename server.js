// server.js

// modules =================================================
var sql       	   = require('mssql');
var express        = require('express');
var app            = express();
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var RSVP           = require('rsvp');
require('datejs'); // Used to parse date string

// Configuration for SQL connection ===========================================

var config = {
    user: '******',
    password: '******', // Not ideal
    domain: '******',
    server: '******', // You can use 'localhost\\instance' to connect to named instance 
    database: 'Shipment Tracking'
}

var port = process.env.PORT || 7070; // set our port

// Models =====================================================

// get all data/stuff of the body (POST) parameters
app.use(bodyParser.json()); // parse application/json 
app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
app.use(bodyParser.urlencoded({ extended: true })); // parse application/x-www-form-urlencoded
app.use(methodOverride('X-HTTP-Method-Override')); // override with the X-HTTP-Method-Override header in the request. simulate DELETE/PUT


// ============================================================
// ROUTES FOR OUR API
// =============================================================================
var router = express.Router(); 				// get an instance of the express Router

// middleware to use for all requests
app.use(function(req, res, next) {
	// Enable Cors
	res.header("Access-Control-Allow-Origin", "*");
 	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	// do logging
	console.log('Router is up.');
	// options(function (req, res, next) {
 //        res.status(200).end();
 //        next();
 //    }).
	next(); // make sure we go to the next routes and don't stop here
});

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// start app ===============================================
app.listen(port);										 // startup our app at http://localhost:8080
console.log('Web service has started on port  ' + port); // shoutout to the user
exports = module.exports = app; 						 // expose app

// ====================================================
// Put update
// ====================================================
router.route('/updatemanentry')

.post(function(req, res) {

	console.log("Made it this far. In POST");
	// Get request from the body of the put.
	var reqdata = req.body.TrackingItem;
	console.log("reqdata: " + JSON.stringify(reqdata));
	// Parse request into JSON
	//reqdata = JSON.parse(reqdata);
	
	// Check to see if object exists in database.
	// If it does, update the row. If not, insert the row.
	check(reqdata).then(function(respdata){
		// Data exists in database
		if (respdata === 1){
			update(reqdata).then(function(returnVal){
				// If the update is successful, send response to client
				if (returnVal > 0) {
					console.log("Response sucesseful: " + returnVal);
					res.json({message: 'Response was sucesseful!'});
				} else {
					console.log("response FAILED.");
				}
			});
		// If data does not exist, insert row
		} else if (respdata === 0) {
			insert(reqdata).then(function(returnVal){
				// If return is successful, send response to client.
				if (returnVal > 0) {
					console.log("response sucesseful: " + returnVal);
					res.json({message: 'Insert was sucesseful!'});
				} else {
					console.log("response FAILED.");
				}
			});
		}
	});
		
})

var check = function (reqdata){
	var prom2 = new RSVP.Promise(function(resolve, reject) {
		var lineID = reqdata.OrderLineID;
		// Check to see if orderLineID exists
		ifexists(lineID).then(function(response){
			if (response[0]){
				console.log("response contained data");
				// collect.push(response);
				// Resolve promise with 1 - exists
				resolve(1);
			} else {
				console.log("response empty");
				// Resolve promise with 0 - emtpy
				resolve(0);
			}

		}).catch(function(error) {
			console.log("Error in ifexists call: " + error);
			reject();
		});
		
	});

	return prom2;
}

function ifexists(orderLineID){
	var prom = new RSVP.Promise(function(resolve, reject) {
		sql.connect(config).then(function(){
			var request = new sql.Request();
			console.log("in ifexists orderlineID: " + orderLineID);
			request.query("select OrderLineID From dbo.ManualEntry_Landing_TrackingNumbers where OrderLineID = '"+orderLineID+"'", function(err, recordset){
				console.log("Select Statement recordset: " + JSON.stringify(recordset));
				resolve(recordset);
				sql.close();
			})
			.catch(function(err) {
				console.log("Error with query: "+ err);
				sql.close();
				reject();
			});
		});
	});

	return prom;

	sql.on('error', function(err){
		console.log("Error with SQL connection. Error Msg: " + err);
	});
}

var update = function(reqdata){
	// Create variables from request data.
	var orderLineID     = reqdata.OrderLineID;
	var shipDate    = new Date(reqdata.ShipDate);
	var shippingMethod  = reqdata.ShippingMethod;
	var trackingNumber  = reqdata.TrackingNumber;

	shipDate = shipDate.toString("MMM dd yyyy");

	console.log("orderLineId:"+orderLineID);
	//shipDate = moment("/Date("+shipDate+")/");
	console.log("shipDate:"+shipDate);
	console.log("shippingMethod:"+shippingMethod);
	console.log("trackingNumber:"+trackingNumber);

	// Create promise to wait for SQL to return to results
	var promise = new RSVP.Promise(function(resolve, reject) {
		sql.connect(config).then(function(){
		 	// Create request instance.
			var request = new sql.Request();

			// Match request data to SQL parameters
			request.input('OrderLineID', sql.NVarChar, orderLineID); //'221480605204');
			request.input('shipDate', sql.NVarChar, shipDate); //'1905-01-01 00:00:00');
			request.input('TrackingNumber', sql.NVarChar, trackingNumber);  //'updatedtracking239487');
			request.input('ShippingMethod', sql.NVarChar, shippingMethod); //'US Mail');
			//request.output('ROWCOUNT', sql.Int);

			// Query. Called stored procedure to update entry. 
			var getResults = request.execute('_CN_UpdateManualEntry', function(err, recordsets, returnValue, affected) {
				
			    console.log("Inside execute: " + returnValue); // > 0 means successful 
			   	resolve(returnValue); // Return value of 1.
				sql.close();
			})
			.catch(function(err) {
				console.log("Error with query: "+ err);
				sql.close();
				var returnValue = 0;
				reject(returnValue);
			});

		});
	});

	return promise;

	sql.on('error', function(err){
		console.log("Error with SQL connection. Error Msg: " + err);
	});

}

var insert = function(reqdata){
	console.log("In insert");
	// Map request data into varibles
	var lineID      = reqdata.OrderLineID;
	var poNumber    = reqdata.PONumber;
	var slsOrdNum	= reqdata.SalesOrderNumber;
	var slsOrdLine  = reqdata.SalesOrderLine;
	var itemNumber  = reqdata.ItemNumber;
	var itemDesc    = reqdata.ItemDescription;
	var vendName    = reqdata.VendorName;
	var shipDate      = new Date(reqdata.ShipDate);
	var shipMethod  = reqdata.ShippingMethod;
	var trackingNum = reqdata.TrackingNumber;
	var qty   		= reqdata.Quantity;

	shipDate = shipDate.toString("MMM dd yyyy");

	// Create promise to wait for SQL to return to results
	var promise = new RSVP.Promise(function(resolve, reject) {
		// Connect to SQL
		sql.connect(config).then(function(){
			console.log("insert SQL cxn successful");
			// Create request
			var insertReq = new sql.Request();

			// Alt method to call SQL directly
			//var transaction = new sql.Transaction();
			
			// Match request data to SQL parameters
			insertReq.input('OrderLineID', sql.NVarChar, lineID); 
			insertReq.input('PONumber', sql.NVarChar, poNumber); 
			insertReq.input('SalesOrderNumber', sql.NVarChar, slsOrdNum); 
			insertReq.input('SalesOrderLine', sql.NVarChar, slsOrdLine); 
			insertReq.input('ItemNumber', sql.NVarChar, itemNumber); 
			insertReq.input('ItemDescription', sql.NVarChar, itemDesc);
			insertReq.input('VendorName', sql.NVarChar, vendName);			
			insertReq.input('ShippingMethod', sql.NVarChar, shipMethod); 
			insertReq.input('ShipDate', sql.NVarChar, shipDate); 
			insertReq.input('TrackingNumber', sql.NVarChar, trackingNum); 
			insertReq.input('Quantity', sql.NVarChar, qty);

			// Query. Call stored procedure to create a new row.
			var getResults = insertReq.execute('_CN_Insert_ManualEntry', function(err, recordsets, returnValue, affected) {
			    console.log("Inside execute: " + returnValue); // > 0 means successful 
			   	resolve(returnValue); // Resolve promise with value of 1.
				sql.close();
			})
			.catch(function(err) {
				console.log("Error with query: "+ err);
				sql.close();
				var returnValue = 0;
				reject(returnValue); // Reject promise with vallue of 0.
			});
		});
				
	});

	return promise;

	sql.on('error', function(err){
		console.log("Error with SQL connection on insert stmt. Error Msg: " + err);
	});

}
