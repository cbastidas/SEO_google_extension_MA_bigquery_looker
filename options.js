(async () => {
  const $ = s => document.querySelector(s);
  const { FOLDER_ID } = await chrome.storage.sync.get({ FOLDER_ID: "" });
  $("#folder").value = FOLDER_ID;

  $("#save").onclick = async () => {
    const id = $("#folder").value.trim();
    await chrome.storage.sync.set({ FOLDER_ID: id });
    alert("Saved ✅");
  };
})();
