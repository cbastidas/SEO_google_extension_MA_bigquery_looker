(function() {
  const LOGO_URL = chrome.runtime.getURL("logo.png");

  function drawUI() {
    let panel = document.getElementById("maf-panel");
    if (panel) {
      panel.style.display = (panel.style.display === "none") ? "block" : "none";
      return;
    }

    panel = document.createElement("div");
    panel.id = "maf-panel";
    Object.assign(panel.style, {
      position: "fixed", top: "20px", right: "20px", zIndex: "9999999",
      width: "360px", background: "white", padding: "25px", borderRadius: "16px",
      boxShadow: "0 12px 40px rgba(0,0,0,0.2)", border: "1px solid #ddd", fontFamily: "sans-serif"
    });

    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <img src="${LOGO_URL}" style="height:30px;">
        <button id="maf-close" style="background:none; border:none; color:#aaa; font-size:24px; cursor:pointer;">&times;</button>
      </div>
      <div id="maf-header">
        <h2 style="margin:0; font-size:14px; color:#1e293b; font-weight:800;">SEO > BIGQUERY PIPELINE</h2>
      </div>
      <div id="maf-main-controls" style="margin-top:15px;">
        <label style="font-size:11px; font-weight:bold;">SELECT DATE</label>
        <input type="date" id="maf-date" style="width:100%; padding:10px; margin:8px 0; border:1px solid #ddd; border-radius:8px;">
        <div style="display:flex; gap:10px;">
          <button id="btn-throne" style="flex:1; background:#6366f1; color:white; border:none; padding:12px; border-radius:8px; cursor:pointer;">THRONE</button>
          <button id="btn-realm" style="flex:1; background:#10b981; color:white; border:none; padding:12px; border-radius:8px; cursor:pointer;">REALM</button>
        </div>
      </div>
      <div id="maf-status-box" style="margin-top:20px; display:none; padding:15px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0;">
        <div id="maf-status-text" style="font-size:13px; font-weight:600; color:#334155;"></div>
        <div id="maf-upload-action" style="display:none; margin-top:10px;">
          <label style="display:block; font-size:10px; color:red; font-weight:bold; margin-bottom:5px;">ACTION: SELECT THE DOWNLOADED CSV</label>
          <input type="file" id="maf-manual-file" accept=".csv" style="font-size:11px;">
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById("maf-close").onclick = () => { panel.style.display = "none"; };

    const startAction = async (platform, url) => {
      const date = document.getElementById("maf-date").value;
      if(!date) return alert("Please select a date first");
      await chrome.storage.local.set({ activeTask: { date, platform } });
      window.location.href = url;
    };

    document.getElementById("btn-throne").onclick = () => startAction("Throne", "https://admin.throneneataffiliates.com/advanced_reports.php?task=run_report&id=21");
    document.getElementById("btn-realm").onclick = () => startAction("Realm", "https://admin2.neataffiliates.com/advanced_reports.php?task=run_report&id=21");

    document.getElementById("maf-manual-file").onchange = async (e) => {
      const { activeTask } = await chrome.storage.local.get("activeTask");
      if (e.target.files[0] && activeTask) uploadToBQ(e.target.files[0], activeTask);
    };
  }

  async function uploadToBQ(file, task) {
    const statusText = document.getElementById("maf-status-text");
    statusText.innerText = "Cleaning data...";
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
    
    const cleanRows = lines.slice(1).map(line => {
      const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      return cells.map(c => c.replace(/"/g, '').trim()).slice(1);
    });

    statusText.innerText = `Pushing ${cleanRows.length} rows to BigQuery...`;
    chrome.runtime.sendMessage({
      type: "UPLOAD_TO_BIGQUERY",
      data: cleanRows,
      dateValue: task.date,
      platform: task.platform
    }, (res) => {
      if (res?.ok) {
        statusText.style.color = "green";
        statusText.innerText = `✅ Success! ${res.count} rows added.`;
        chrome.storage.local.remove("activeTask");
      } else {
        statusText.style.color = "red";
        statusText.innerText = "❌ Error: " + res.error;
      }
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TOGGLE_PANEL") drawUI();
  });

  // AUTO-RUN LOGIC WHEN PAGE LOADS
  (async () => {
    const { activeTask } = await chrome.storage.local.get("activeTask");
    if (activeTask && window.location.href.includes("id=21")) {
      drawUI();
      document.getElementById("maf-main-controls").style.display = "none";
      const statusBox = document.getElementById("maf-status-box");
      const statusText = document.getElementById("maf-status-text");
      statusBox.style.display = "block";
      statusText.innerText = "⚙️ Automating filters...";

      const sspField = document.querySelector("#ssp");
      if (sspField) {
        document.querySelector("#date_range_from").value = activeTask.date;
        document.querySelector("#date_range_to").value = activeTask.date;
        // SEO Team ID: Throne=6, Realm=56
        sspField.value = activeTask.platform === "Realm" ? "56" : "6";
        sspField.dispatchEvent(new Event('change', {bubbles:true}));
        
        setTimeout(() => {
          const dlBtn = document.querySelector('button[name="report_bttn"][value="download"]');
          if(dlBtn) {
            dlBtn.click();
            statusText.innerText = "📁 Download started! Please wait...";
            document.getElementById("maf-upload-action").style.display = "block";
          }
        }, 2000);
      }
    }
  })();
})();