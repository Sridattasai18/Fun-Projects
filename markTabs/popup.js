// Key used to store saved tabs in chrome.storage.local
const STORAGE_KEY = "savedTabs";

/**
 * Initialize popup: load current tabs and saved tabs.
 */
document.addEventListener("DOMContentLoaded", () => {
  renderCurrentTabs();
  renderSavedTabs();
});

/**
 * Fetch current window tabs and render them with note inputs and Save buttons.
 */
function renderCurrentTabs() {
  const container = document.getElementById("current-tabs-list");
  container.textContent = "Loading tabs...";

  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    container.textContent = "";

    if (!tabs || tabs.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "empty-message";
      emptyMsg.textContent = "No open tabs found.";
      container.appendChild(emptyMsg);
      return;
    }

    // For quick lookup of existing notes by URL
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const savedTabs = result[STORAGE_KEY] || [];

      tabs.forEach((tab) => {
        const existing = savedTabs.find((t) => t.url === tab.url);
        container.appendChild(createCurrentTabRow(tab, existing));
      });
    });
  });
}

/**
 * Create a DOM row for a current tab with title, note input and Save button.
 * @param {chrome.tabs.Tab} tab
 * @param {{title:string,url:string,note:string}|undefined} existing
 */
function createCurrentTabRow(tab, existing) {
  const row = document.createElement("div");
  row.className = "tab-row";

  const info = document.createElement("div");
  info.className = "tab-info";

  const title = document.createElement("div");
  title.className = "tab-title";
  title.textContent = tab.title || "(no title)";

  const url = document.createElement("div");
  url.className = "tab-url";
  url.textContent = tab.url || "";

  info.appendChild(title);
  info.appendChild(url);

  const controls = document.createElement("div");
  controls.className = "tab-controls";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Why did you open this tab?";
  input.className = "note-input";
  if (existing && existing.note) {
    input.value = existing.note;
  }

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  saveBtn.className = "primary-button";

  saveBtn.addEventListener("click", () => {
    const note = input.value.trim();

    // Simple visual feedback state
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    // Allow saving even with an empty note — it still remembers the tab
    saveTab(
      {
        title: tab.title || "(no title)",
        url: tab.url || "",
        note,
      },
      () => {
        saveBtn.textContent = "Saved!";
        saveBtn.classList.add("primary-button--success");

        setTimeout(() => {
          saveBtn.disabled = false;
          saveBtn.textContent = originalText;
          saveBtn.classList.remove("primary-button--success");
        }, 1200);
      }
    );
  });

  controls.appendChild(input);
  controls.appendChild(saveBtn);

  row.appendChild(info);
  row.appendChild(controls);

  return row;
}

/**
 * Save or update a tab entry in storage, then re-render saved tabs list.
 * @param {{title:string,url:string,note:string}} tabData
 * @param {() => void} [onDone]
 */
function saveTab(tabData, onDone) {
  if (!tabData.url) {
    return;
  }

  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const savedTabs = result[STORAGE_KEY] || [];

    const existingIndex = savedTabs.findIndex((t) => t.url === tabData.url);
    if (existingIndex !== -1) {
      // Update existing
      savedTabs[existingIndex] = tabData;
    } else {
      // Add new
      savedTabs.push(tabData);
    }

    chrome.storage.local.set({ [STORAGE_KEY]: savedTabs }, () => {
      renderSavedTabs();
      if (typeof onDone === "function") {
        onDone();
      }
    });
  });
}

/**
 * Load saved tabs from storage and render them.
 */
function renderSavedTabs() {
  const container = document.getElementById("saved-tabs-list");
  container.textContent = "Loading saved tabs...";

  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const savedTabs = result[STORAGE_KEY] || [];
    container.textContent = "";

    if (savedTabs.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "empty-message";
      emptyMsg.textContent = "No saved tabs yet.";
      container.appendChild(emptyMsg);
      return;
    }

    // Group saved tabs by hostname for a clearer, more useful layout.
    const groups = {};

    savedTabs.forEach((tab, index) => {
      let host = "Other";
      if (tab.url) {
        try {
          const urlObj = new URL(tab.url);
          host = urlObj.hostname || host;
        } catch (e) {
          // Keep default "Other" when URL parsing fails.
        }
      }

      if (!groups[host]) {
        groups[host] = [];
      }
      // Keep original index so delete uses the correct position.
      groups[host].push({ tab, index });
    });

    Object.keys(groups)
      .sort()
      .forEach((host) => {
        const header = document.createElement("div");
        header.className = "saved-group-header";
        header.textContent = host;
        container.appendChild(header);

        groups[host].forEach(({ tab, index }) => {
          container.appendChild(createSavedTabRow(tab, index));
        });
      });
  });
}

/**
 * Create a DOM row for a saved tab with title, note, Open and Delete buttons.
 * @param {{title:string,url:string,note:string}} tab
 * @param {number} index
 */
function createSavedTabRow(tab, index) {
  const row = document.createElement("div");
  row.className = "tab-row saved-tab-row";

  const info = document.createElement("div");
  info.className = "tab-info";

  const title = document.createElement("div");
  title.className = "tab-title";
  title.textContent = tab.title || "(no title)";

  const note = document.createElement("div");
  note.className = "tab-note";
  note.textContent = tab.note || "(no note)";

  info.appendChild(title);
  info.appendChild(note);

  const controls = document.createElement("div");
  controls.className = "tab-controls";

  const openBtn = document.createElement("button");
  openBtn.textContent = "Open";
  openBtn.className = "secondary-button";
  openBtn.addEventListener("click", () => {
    if (tab.url) {
      chrome.tabs.create({ url: tab.url });
    }
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.className = "danger-button";
  deleteBtn.addEventListener("click", () => {
    deleteSavedTab(index);
  });

  controls.appendChild(openBtn);
  controls.appendChild(deleteBtn);

  row.appendChild(info);
  row.appendChild(controls);

  return row;
}

/**
 * Delete a saved tab at a given index.
 * @param {number} index
 */
function deleteSavedTab(index) {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const savedTabs = result[STORAGE_KEY] || [];
    if (index < 0 || index >= savedTabs.length) return;

    savedTabs.splice(index, 1);

    chrome.storage.local.set({ [STORAGE_KEY]: savedTabs }, () => {
      renderSavedTabs();
    });
  });
}

