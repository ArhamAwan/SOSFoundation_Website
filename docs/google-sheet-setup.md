# Website forms and the Google Sheet

## Where form entries go

Every form on the website posts to the website itself:

- Volunteer
- Partnership / Corporate CSR
- Ambassador (Youth / Brand)
- Contact
- Newsletter

Each entry is then handled in three steps:

1. **It is saved in the website's database.** You can see it in the admin panel under **Form submissions**. There you can read it, set its status (New, In progress, Closed), add a private note, reply by email and export everything as a CSV file.
2. **A copy is added to a Google Sheet** once one is connected (steps below). Each form gets its own tab, with one row per entry and one column per field.
3. **The visitor sees the thank-you page.**

The website keeps every entry even when the Google Sheet is not connected, or is unavailable for a while. Entries that did not reach the sheet are marked "Not copied". An admin can send them later with **Send … not yet copied**.

Spam protection: every form has a hidden box that people never see. Robots fill it in, and those entries are dropped. More than 10 entries from one address in 10 minutes are also dropped.

## Connect a Google Sheet (about 5 minutes)

Do this signed in to the Google account that should own the sheet, for example the SOS Foundation account.

1. Create a new Google Sheet, for example "SOS Foundation website forms".
2. In the sheet, open **Extensions → Apps Script**.
3. Delete what is in the editor and paste the code below. Click **Save**.
4. Click **Deploy → New deployment**. Click the gear icon next to "Select type" and choose **Web app**. Then:
   - Description: `Website forms`
   - Execute as: **Me**
   - Who has access: **Anyone**. This lets the website post to it. Nobody can read the sheet through this link.
5. Click **Deploy**, then **Authorize access**. Choose the account, then **Advanced → Go to … (unsafe) → Allow**. Google shows this warning for every script that is not published on its store.
6. Copy the **Web app URL**. It starts with `https://script.google.com/macros/s/` and ends with `/exec`.
7. In the website admin panel, open **Form submissions**, paste the address into **Copy to Google Sheet** and click **Save**.
8. Click **Send a test row**. A tab called "Test" appears in the sheet; you can delete it afterwards.

If there are entries from before the sheet was connected, click **Send … not yet copied** to add them too.

Alternatively, a developer can put the address in Vercel as the environment variable `SHEETS_WEBHOOK_URL`. It then takes the place of the address saved in the admin panel.

If you change the script later, deploy it again with **Deploy → Manage deployments → Edit → Version: New version**. This keeps the same address. A brand-new deployment gets a new address, which you would then paste into the admin panel again.

## The Apps Script code

```javascript
// SOS Foundation website: adds each form entry to this sheet, one tab per form.
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var name = String(d.form || 'Website form').replace(/[\[\]\*\?\/\\:]/g, ' ').slice(0, 90);
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    var fields = d.fields || {};
    var headers = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    if (headers.length === 0) headers = ['Received', 'Page'];
    Object.keys(fields).forEach(function (k) { if (headers.indexOf(k) < 0) headers.push(k); });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    var safe = function (v) { v = v == null ? '' : String(v); return /^[=+\-@]/.test(v) ? "'" + v : v; };
    var row = headers.map(function (h) {
      if (h === 'Received') return new Date(d.received || Date.now());
      if (h === 'Page') return safe(d.page);
      return safe(fields[h]);
    });
    sheet.appendRow(row);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
```

New fields added to a form later simply become new columns at the end of that tab.
