const PROJECT_ID = "seo-analytics-looker-project"; 
const DATASET_ID = "SEO_Analytics_Looker"; 
const TABLE_ID = "master_data"; 

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" }).catch(e => console.log("Tab loading..."));
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "UPLOAD_TO_BIGQUERY") {
    insertData(msg).then(sendResponse);
    return true;
  }
  if (msg.type === "GET_LATEST_DATE") {
    getLatestDate().then(sendResponse);
    return true;
  }
});

async function getLatestDate() {
  try {
    const auth = await chrome.identity.getAuthToken({ interactive: true });
    const query = `SELECT FORMAT_DATE('%Y-%m-%d', MAX(report_date)) as last_date FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\``;

    const resp = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/queries`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, useLegacySql: false })
    });

    const data = await resp.json();
    if (data.rows && data.rows.length > 0) {
      return { ok: true, date: data.rows[0].f[0].v };
    }
    return { ok: true, date: "No data" };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function insertData(msg) {
  try {
    const auth = await chrome.identity.getAuthToken({ interactive: true });
    const rows = msg.data.map(row => ({
      json: {
        affiliate: row[0] || "",
        referrer: row[1] || "",
        brand: row[2] || "",
        clicks: parseInt(row[3]) || 0,
        signups: parseInt(row[4]) || 0,
        ndc: parseInt(row[5]) || 0,
        ndc_amount: parseFloat(row[6]) || 0.0,
        report_date: msg.dateValue,
        platform: msg.platform
      }
    }));

    const chunkSize = 2000;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/datasets/${DATASET_ID}/tables/${TABLE_ID}/insertAll`;
      
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rows: chunk })
      });
      
      const resJson = await resp.json();
      if (resJson.insertErrors) throw new Error("Check BigQuery Table Schema (names must be lowercase)");
    }
    return { ok: true, count: rows.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}