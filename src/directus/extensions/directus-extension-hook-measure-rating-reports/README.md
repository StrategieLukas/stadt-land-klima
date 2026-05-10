# Measure-Rating-Report
## Overview
This Directus hook extension automates the process of generating a weekly report in CSV format from the `ratings_measures` collection. It retrieves all entries from the collection, converts the data into CSV format, and sends the file via email every Sunday at midnight.

### Features
- Automatically retrieves data from the `ratings_measures` collection.
- Converts JSON data to CSV format.
- Sends the generated CSV file as an email attachment.
- Scheduled execution every Sunday at 00:00.

### How It Works

1. **Scheduling:**
   - The script uses a schedule to run every Sunday at 00:00. You can modify the `period` variable to change the frequency as needed.

    ```javascript
    const period = '0 0 * * 0'; // At 00:00 on Sunday.
    ```

2. **Data Retrieval:**
   - Retrieves all entries from the `ratings_measures` collection using the `ItemsService`.

    ```javascript
    const ratingMeasures_results = await itemService_ratingMeasures.readByQuery({ limit: -1 });
    ```

3. **CSV Conversion:**
   - The `jsonToCsv` function converts the retrieved JSON data into CSV format, handling null values and ensuring values are properly quoted for commas.

4. **Email Sending:**
   - The generated CSV file is sent as an attachment via the MailService. The temporary CSV file is deleted after the email is sent.


## Developing
### Build extension
0. First you need to run `npm install` in this directory. You only need to do this once.
1. To apply the changes, run `npm run build`
2. copy the content of `dist/index.js` to `/src/directus/extensions/directus-extension-hook-measure-rating-reports/dist/index.js`

### Changing the schedule
For debugging it is helpful to change the schedule to run the extension once a minute. Change the period variable to the following to change the schedule.
```javascript
const period = '*/1 * * * *';
```

### Configuring the E-Mail service
To also enable the E-Mail service, you need to uncomment and define the E-Mail Configuraiton within the .env file of the `/src/directus/.env` file.

