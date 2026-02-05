import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

// This script expects GOOGLE_SERVICE_ACCOUNT_KEY environmental variable 
// to be a JSON string of your service account key file.
// And SPREADSHEET_ID to be the ID of your Google Sheet.
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function fetchData() {
    try {
        console.log('Fetching data from Google Sheets...');

        if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not defined');
        }

        const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

        const serviceAccountAuth = new JWT({
            email: creds.client_email,
            key: creds.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0]; // Assuming data is in the first sheet
        const rows = await sheet.getRows();

        const data = rows.map(row => {
            // Convert row to plain object
            const obj = {};
            sheet.headerValues.forEach(header => {
                obj[header] = row.get(header);
            });
            return obj;
        }).filter(obj => Object.values(obj).some(val => val !== undefined && val !== null && val !== ''));


        const outputPath = path.resolve('public/data.json');
        fs.writeFileSync(outputPath, JSON.stringify({
            lastUpdated: new Date().toISOString(),
            expenses: data
        }, null, 2));

        console.log(`Success! Data saved to ${outputPath}`);
    } catch (error) {
        console.error('Error fetching data:', error);
        process.exit(1);
    }
}

fetchData();
