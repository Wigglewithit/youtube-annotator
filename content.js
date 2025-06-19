(function () {
  if (window.hasRun) return;
  window.hasRun = true;

  function tryInjectUI() {
    const container = document.querySelector("#above-the-fold");
    if (!container || document.querySelector("#yt-annotation-wrapper")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "yt-annotation-wrapper";
    wrapper.innerHTML = `
      <div id="annotation-header">📌 YouTube Annotator</div>
      <textarea id="annotation-input" placeholder="Write your note..."></textarea>
      <button id="save-annotation">Save</button>
      <div id="annotation-tools">
        <button id="export-btn">Export</button>
        <input type="file" id="import-input" accept=".json" hidden>
        <button id="import-btn">Import</button>
      </div>

      <div id="annotations-list"></div>
    `;
    container.prepend(wrapper);

    const style = document.createElement("style");
    style.textContent = `
      #yt-annotation-wrapper {
        margin: 16px 0;
        padding: 12px;
        background-color: #f9f9f9;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        font-family: Arial, sans-serif;
        color: #222;
        max-width: 100%;
      }
      #annotation-tools {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      #export-btn,
      #import-btn {
        background: #444;
        color: white;
        border: none;
        padding: 6px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
      }

      #annotation-header {
        font-weight: bold;
        margin-bottom: 8px;
        font-size: 16px;
      }

      #annotation-input {
        width: 100%;
        padding: 8px;
        box-sizing: border-box;
        margin-bottom: 10px;
        resize: vertical;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 14px;
      }

      #save-annotation {
        padding: 8px;
        background-color: #cc0000;
        color: white;
        border: none;
        border-radius: 4px;
        font-weight: bold;
        width: 100%;
        cursor: pointer;
        margin-bottom: 12px;
      }

      .annotation-item {
        margin-bottom: 8px;
        padding: 6px;
        background: #eee;
        border-left: 4px solid #cc0000;
        border-radius: 4px;
        font-size: 14px;
      }

      .jump-btn {
        background: none;
        border: none;
        color: #0056c1;
        cursor: pointer;
        font-size: 13px;
        text-decoration: underline;
        margin-top: 4px;
      }
      .annotation-controls {
        margin-top: 6px;
        display: flex;
        gap: 8px;
      }

      .edit-btn,
      .delete-btn {
        background: #888;
        border: none;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
      }

      .delete-btn {
        background: #b00020;
      }
      

    `;
    document.head.appendChild(style);

    const input = wrapper.querySelector("#annotation-input");
    const saveBtn = wrapper.querySelector("#save-annotation");
    const list = wrapper.querySelector("#annotations-list");

    const getVideoId = () => new URL(location.href).searchParams.get("v");
    const getPlayer = () => document.querySelector("video");
    const formatTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

    const loadAnnotations = () => {
  const key = getVideoId();
  chrome.storage.local.get([key], (result) => {
    const annotations = result[key] || [];
    list.innerHTML = annotations.map((ann, index) => `
      <div class="annotation-item" data-index="${index}">
        <div class="annotation-text">${ann.text}</div>
        <div class="annotation-controls">
          <button class="jump-btn" data-time="${ann.time}">Jump to ${formatTime(ann.time)}</button>
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
        </div>
      </div>
    `).join('');
  });
};
    // Export
const exportBtn = wrapper.querySelector("#export-btn");
exportBtn.addEventListener("click", () => {
  const key = getVideoId();
  chrome.storage.local.get([key], (result) => {
    const annotations = result[key] || [];
    const blob = new Blob([JSON.stringify(annotations, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${key}-annotations.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

// Import
const importBtn = wrapper.querySelector("#import-btn");
const importInput = wrapper.querySelector("#import-input");

importBtn.addEventListener("click", () => {
  importInput.click();
});

importInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const annotations = JSON.parse(e.target.result);
      if (!Array.isArray(annotations)) throw new Error("Invalid format");

      const key = getVideoId();
      chrome.storage.local.set({ [key]: annotations }, () => {
        loadAnnotations();
        alert("Annotations imported successfully.");
      });
    } catch (err) {
      alert("Failed to import annotations: " + err.message);
    }
  };
  reader.readAsText(file);
});



    list.addEventListener("click", (e) => {
      if (e.target.classList.contains("jump-btn")) {
        const player = getPlayer();
        if (player) {
          player.currentTime = parseFloat(e.target.dataset.time);
          player.play().catch(() => {}); // clean autoplay warning
        }
      }
    });

    list.addEventListener("click", (e) => {
  const key = getVideoId();

  if (e.target.classList.contains("delete-btn")) {
    const index = e.target.closest(".annotation-item").dataset.index;
    chrome.storage.local.get([key], (result) => {
      const annotations = result[key] || [];
      annotations.splice(index, 1);
      chrome.storage.local.set({ [key]: annotations }, loadAnnotations);
    });
  }

  if (e.target.classList.contains("edit-btn")) {
    const annotationDiv = e.target.closest(".annotation-item");
    const index = annotationDiv.dataset.index;
    const textDiv = annotationDiv.querySelector(".annotation-text");

    const currentText = textDiv.textContent;
    const newText = prompt("Edit your annotation:", currentText);
    if (newText !== null && newText.trim() !== "") {
      chrome.storage.local.get([key], (result) => {
        const annotations = result[key] || [];
        annotations[index].text = newText.trim();
        chrome.storage.local.set({ [key]: annotations }, loadAnnotations);
      });
    }
  }
});


    saveBtn.addEventListener("click", () => {
      const text = input.value.trim();
      if (!text) return;

      const key = getVideoId();
      const player = getPlayer();
      if (!key || !player) return;

      const time = player.currentTime || 0;

      chrome.storage.local.get([key], (result) => {
        const annotations = result[key] || [];
        annotations.push({ time, text });

        chrome.storage.local.set({ [key]: annotations }, () => {
          input.value = "";
          loadAnnotations();
        });
      });
    });

    loadAnnotations();
  }

  // Watch for YouTube dynamic loads
  const observer = new MutationObserver(tryInjectUI);
  observer.observe(document.body, { childList: true, subtree: true });

  tryInjectUI(); // Initial attempt
})();
