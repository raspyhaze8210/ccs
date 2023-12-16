const jsforce = require('jsforce');
const express = require('express')
const app = express();
const PORT = process.env.PORT || 5001;
const path = require('path');
const router = express.Router();
const bodyParser = require('body-parser');

const SF_LOGIN_URL = process.env.SF_LOGIN_URL;
const SF_USERNAME = process.env.SF_USERNAME;
const SF_PASSWORD = process.env.SF_PASSWORD;
const SF_TOKEN = process.env.SF_TOKEN;

const { Pool } = require('pg');
const {XMLHttpRequest} = require("xmlhttprequest");
const client = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

let accessToken;

require('dotenv').config();

app.use("/getfundingnow",router);
app.use("/",router);
client.connect();
app.use('/getfundingnow', express.static(path.join(__dirname, 'static', 'dist')));
app.use('/', express.static(path.join(__dirname, 'static', 'dist')));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb'}));

app.post('/api/prospect/create',(req, res) => {
    console.log('Got body ', req.body);
    let insertProspect = `
        INSERT INTO "Prospect" ("Loan_Amount", "Purpose", "Credit_Score", "Email", "Date_Of_Birth", "First_Name", "Last_Name",
                                "Address1", "Address2", "Zip", "City", "Phone_Number", "State", "Home_Ownership_Status",
                                "Education_Level", "Employment_Status", "Annual_Income", "Payment_Frequency", "Social_Security_Number", "Brand_Name", "Form_Id", "push_source")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'Apply Form') RETURNING "ProspectId"`;

    let Form_Id = generateUUID();
    client.query(insertProspect, [
        req.body.Loan_Amount, req.body.Purpose, req.body.Credit_Score, req.body.Email, req.body.Date_Of_Birth,
        req.body.First_Name, req.body.Last_Name, req.body.Address1, req.body.Address2, req.body.Zip, req.body.City, req.body.Mobile_Phone,
        req.body.State, req.body.Home_Ownership_Status, req.body.Education_Level, req.body.Employment_Status,
        req.body.Annual_Income, req.body.Payment_Frequency, req.body.Social_Security_Number, req.body.Company, Form_Id
    ], (err, result) => {
        if (err) {
            createErrorLog(err.message, JSON.stringify(req.body));
            throw err
        } else {
            res.send('{"ProspectId":' + result.rows[0].ProspectId + '}');
        }
    });
});

app.post('/api/prospect/update',(req, res) => {
    console.log('Got body ', req.body);
    res.send(req.body);
    let updateProspect = `
        UPDATE "Prospect" SET (
            "Loan_Amount", "Purpose", "Credit_Score", "Email", "Date_Of_Birth", "First_Name", "Last_Name",
            "Address1", "Address2", "Zip", "City", "Phone_Number", "State", "Home_Ownership_Status",
            "Education_Level", "Employment_Status", "Annual_Income", "Payment_Frequency", "Social_Security_Number"
            ) = (
                 $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            ) 
        WHERE "ProspectId" = $20
    `;
    client.query(updateProspect, [
        req.body.Loan_Amount, req.body.Purpose, req.body.Credit_Score, req.body.Email, req.body.Date_Of_Birth,
        req.body.First_Name, req.body.Last_Name, req.body.Address1, req.body.Address2, req.body.Zip, req.body.City, req.body.Mobile_Phone,
        req.body.State, req.body.Home_Ownership_Status, req.body.Education_Level, req.body.Employment_Status,
        req.body.Annual_Income, req.body.Payment_Frequency, req.body.Social_Security_Number, req.body.ProspectId
    ], (err, result) => {
        if (err) {
            createErrorLog(err.message, JSON.stringify(req.body));
            console.error(err);
        }
    });
});

function registerCallback(endPoint) {
    app.post(endPoint, function(req, res) {
        let promise = new Promise((resolve, reject) => {
            const conn = new jsforce.Connection({
                loginUrl: SF_LOGIN_URL
            });
            conn.login(SF_USERNAME, SF_PASSWORD + SF_TOKEN, (err, userInfo) => {
                if (err) {
                    console.log(err);
                } else {
                    console.log('user Id', userInfo.id);
                    console.log('org Id', userInfo.organizationId);
                }
                accessToken = conn.accessToken;
                resolve();
            })
                .then(r  => {
                    console.log(r);
                })
                .catch(e => {
                    createErrorLog(e.message, JSON.stringify(req.body));
                    console.error(e);
                });
        });
        promise
            .then(() => {
                let XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
                let xhr = new XMLHttpRequest();
                xhr.open('POST', 'https://centuryconsultingservices2020.my.salesforce.com/services/apexrest' + endPoint, true);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        console.log(xhr.status);
                        console.log('###responseText###', JSON.parse(xhr.responseText));
                        res.send(JSON.parse(xhr.responseText));
                    }
                };
                xhr.setRequestHeader("Accept", "application/json");
                xhr.setRequestHeader("Authorization", "Bearer " + accessToken);
                xhr.setRequestHeader("Content-Type", "application/json");

                xhr.send(JSON.stringify(req.body));
                console.log('response ', xhr.responseText);
            })
            .catch(error => {
                createErrorLog(error.message, JSON.stringify(req.body));
            });
    });
}

sendDataToSalesforce('/createLead');
sendDataToSalesforce('/getPreApprovedByOfferCode');
sendDataToSalesforce('/getEmailCode');
sendDataToSalesforce('/scheduleCall');
sendDataToSalesforce('/sendEmailLeadCreated');
sendDataToSalesforce('/saveSelectedOfferToLead');
sendDataToSalesforce('/prospectIdFromEmail');
sendDataToSalesforce('/offersLinkByApplicationUuid');
sendDataToSalesforce('/checkLeadRenovaPreApproved');
function generateUUID() {
    let d = new Date().getTime();
    let d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now() * 1000)) || 0;
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        let r = Math.random() * 16;
        if(d > 0) {
            r = (d + r) % 16 | 0;
            d = Math.floor(d / 16);
        } else {
            r = (d2 + r) % 16 | 0;
            d2 = Math.floor(d2 / 16);
        }
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

app.post('/api/import',(req, res) => {
    console.log('Import ', req.body);
    console.log(req.body.rows);
    console.log(req.body.rows[0].FIRST);
    console.log(req.body.rows[0].ADDRESS);
    let insertProspect = `
        INSERT INTO "Prospect" ("First_Name", "Zip", "Expiration", "Mail_Date", "Credit_Score", "Last_Name", "Offer_Code",
                                "Adjusted_Credit_Card_Balance", "Address1", "Mailler_Version", "Middle_Name", "State",
                                "PreApproved_Loan_Amount", "Brand_Name", "City", "Form_Id")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING "ProspectId"
    `;
    req.body.rows.forEach(prospect => {
        let Form_Id = generateUUID();
        client.query(insertProspect, [
            prospect.FIRST, prospect.ZIP, prospect['EXP DATE'], prospect['MAIL DATE'], prospect['CREDIT SCORE'], prospect.LAST,
            prospect['RECORD NUMBER'], prospect['CREDIT CARD BALANCE (ADJ)'], prospect.ADDRESS, prospect['MAILER VERSION'],
            prospect.MIDDLE, prospect.ST, prospect['DEBT CONSOLIDATION'], prospect.COMPANY, prospect.CITY, Form_Id
        ], (err, result) => {
            if (err) {
                res.send(res.status(200).json({}));
            }
            else {
                res.send(res.status(200).json({}));
            }
        });
        console.log(prospect);
    })
    return res.status(200).json({});
});
app.listen(PORT, () => {
    console.log(`Example app listening on port ${PORT}`)
});