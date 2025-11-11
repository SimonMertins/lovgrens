document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ Lovgrens Diagnostik – app laddad");
  
    // === DARK MODE ===
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
      const currentTheme = localStorage.getItem("theme") || "light";
      document.body.dataset.theme = currentTheme;
      updateThemeButton();
  
      themeToggle.addEventListener("click", () => {
        const newTheme =
          document.body.dataset.theme === "dark" ? "light" : "dark";
        document.body.dataset.theme = newTheme;
        localStorage.setItem("theme", newTheme);
        updateThemeButton();
      });
    }
  
    function updateThemeButton() {
      if (!themeToggle) return;
      themeToggle.textContent =
        document.body.dataset.theme === "dark"
          ? "☀️ Ljust läge"
          : "🌙 Mörkt läge";
    }
  
    // === ELEMENTREFERENSER ===
    const form = document.getElementById("codeForm");
    const resultDiv = document.getElementById("result");
    const loadingDiv = document.getElementById("loading");
    const historyDiv = document.getElementById("history");
    const exportPDFBtn = document.getElementById("exportPDF");
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const chatBox = document.getElementById("chatBox");
    const clearChatBtn = document.getElementById("clearChat");
    const exportChatBtn = document.getElementById("exportChat");
  
    // === DATA ===
    let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || [];
    let latestDiagnosis = JSON.parse(localStorage.getItem("latestDiagnosis")) || null;
  
    // === INIT ===
    updateHistoryDisplay();
    loadChatHistory();
    updateChatContext();
  
    // -----------------------------------------------------
    // 🧠 DIAGNOS – FELKODSSÖKNING
    // -----------------------------------------------------
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("🔍 Startar felsökning...");
  
      const errorCode = document.getElementById("errorCode").value.trim();
      const carBrand = document.getElementById("carBrand").value.trim();
      const carYear = document.getElementById("carYear").value.trim();
      const engineCode = document.getElementById("engineCode").value.trim();
  
      resultDiv.innerHTML = "";
      loadingDiv.style.display = "block";
  
      if (!errorCode || !carBrand || !carYear) {
        loadingDiv.style.display = "none";
        resultDiv.innerHTML = `<p style="color:#d9534f;">⚠️ Fyll i alla fält.</p>`;
        return;
      }
  
      try {
        const response = await fetch("http://localhost:3000/api/obd/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errorCode, carBrand, carYear, engineCode }),
        });
  
        if (!response.ok) throw new Error(`Serverfel: ${response.status}`);
        const data = await response.json();
        loadingDiv.style.display = "none";
  
        if (data.error) {
          resultDiv.innerHTML = `<p style="color:#d9534f;">${data.error}</p>`;
          return;
        }
  
        displayDiagnosis(errorCode, carBrand, carYear, engineCode, data.result);
        saveSearch({ errorCode, carBrand, carYear, engineCode });
        updateHistoryDisplay();
  
        latestDiagnosis = {
          errorCode,
          carBrand,
          carYear,
          engineCode,
          result: data.result,
          timestamp: new Date().toLocaleString("sv-SE"),
        };
        localStorage.setItem("latestDiagnosis", JSON.stringify(latestDiagnosis));
        updateChatContext();
        showNotification("✅ Svar mottaget från AI");
      } catch (err) {
        loadingDiv.style.display = "none";
        resultDiv.innerHTML = `<p style="color:#d9534f;">Fel: ${err.message}</p>`;
        console.error("Diagnos error:", err);
      }
    });
  
    // -----------------------------------------------------
    // 📋 RESULTAT
    // -----------------------------------------------------
    function displayDiagnosis(errorCode, carBrand, carYear, engineCode, raw) {
      const formatted = raw
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
  
      resultDiv.innerHTML = `
        <header>
          <h3>Felkod: ${errorCode}</h3>
          <p><strong>${carBrand} ${carYear}</strong>${
        engineCode ? ` — Motorkod: ${engineCode}` : ""
      }</p>
        </header>
        <div class="answer">${formatted}</div>
      `;
    }
  
    // -----------------------------------------------------
    // 📜 HISTORIK
    // -----------------------------------------------------
    function saveSearch(entry) {
      const history = JSON.parse(localStorage.getItem("obdHistory")) || [];
      const exists = history.find(
        (h) =>
          h.errorCode === entry.errorCode &&
          h.carBrand === entry.carBrand &&
          h.carYear === entry.carYear &&
          (h.engineCode || "") === (entry.engineCode || "")
      );
      if (!exists) {
        entry.date = new Date().toLocaleString("sv-SE");
        history.unshift(entry);
        if (history.length > 8) history.pop();
        localStorage.setItem("obdHistory", JSON.stringify(history));
      }
    }
  
    function updateHistoryDisplay() {
      const history = JSON.parse(localStorage.getItem("obdHistory")) || [];
      if (!history.length) {
        historyDiv.innerHTML = "";
        return;
      }
  
      const items = history
        .map(
          (h, i) =>
            `<li data-index="${i}">${i + 1}. ${h.carBrand} ${h.carYear}${
              h.engineCode ? ` (${h.engineCode})` : ""
            } — <strong>${h.errorCode}</strong> <small>(${h.date})</small></li>`
        )
        .join("");
  
      historyDiv.innerHTML = `
        <h4>🕓 Senaste sökningar</h4>
        <ul id="historyList">${items}</ul>
        <button id="clearHistory" class="history-clear">🧹 Rensa historik</button>`;
  
      document.querySelectorAll("#historyList li").forEach((li) => {
        li.addEventListener("click", () => {
          const idx = li.dataset.index;
          const h = JSON.parse(localStorage.getItem("obdHistory"))[idx];
          if (h) {
            document.getElementById("errorCode").value = h.errorCode;
            document.getElementById("carBrand").value = h.carBrand;
            document.getElementById("carYear").value = h.carYear;
            document.getElementById("engineCode").value = h.engineCode || "";
            form.dispatchEvent(new Event("submit", { cancelable: true }));
          }
        });
      });
  
      const clearBtn = document.getElementById("clearHistory");
      if (clearBtn)
        clearBtn.addEventListener("click", () => {
          localStorage.removeItem("obdHistory");
          updateHistoryDisplay();
        });
    }
  
    // -----------------------------------------------------
    // 💬 CHAT
    // -----------------------------------------------------
    function loadChatHistory() {
      chatBox.innerHTML = "";
      chatHistory.forEach((m) => appendChatMessage(m.role, m.content));
    }
  
    function updateChatContext() {
      const ctxEl = document.getElementById("chatContext");
      if (!ctxEl || !latestDiagnosis) return;
      ctxEl.innerHTML = `
        <div class="context-box">
          <strong>Aktiv diagnos:</strong><br>
          ${latestDiagnosis.carBrand} ${latestDiagnosis.carYear} — ${
        latestDiagnosis.errorCode
      }<br>
          ${latestDiagnosis.engineCode || "Ingen motorkod angiven"}
        </div>`;
    }
  
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
  
      appendChatMessage("user", text);
      chatHistory.push({ role: "user", content: text });
      chatInput.value = "";
  
      const loaderEl = appendChatMessage("assistant", "", true);
  
      const enrichedMessages = [...chatHistory];
      if (latestDiagnosis) {
        enrichedMessages.unshift({
          role: "system",
          content: `Tidigare diagnosinformation:\nFelkod: ${latestDiagnosis.errorCode}\nBilmärke: ${latestDiagnosis.carBrand}\nÅrsmodell: ${latestDiagnosis.carYear}\nMotorkod: ${latestDiagnosis.engineCode || "Okänd"}\nAI-svar: ${latestDiagnosis.result}`,
        });
      }
  
      try {
        const response = await fetch("http://localhost:3000/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: enrichedMessages }),
        });
        const data = await response.json();
        loaderEl.remove();
  
        if (data.reply) {
          appendChatMessage("assistant", data.reply);
          chatHistory.push({ role: "assistant", content: data.reply });
          localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
        } else {
          appendChatMessage("assistant", "❌ Inget svar kunde hämtas.");
        }
      } catch (err) {
        loaderEl.remove();
        appendChatMessage("assistant", "⚠️ Fel: " + err.message);
      }
    });
  
    function appendChatMessage(role, text, isTyping = false) {
      const el = document.createElement("div");
      el.className = `message ${role === "user" ? "user" : "ai"}`;
      if (isTyping) {
        el.innerHTML = `<div class="ai-loader"><span></span><span></span><span></span></div><p>AI analyserar...</p>`;
      } else {
        el.innerHTML = text.replace(/\n/g, "<br>");
      }
      chatBox.appendChild(el);
      chatBox.scrollTop = chatBox.scrollHeight;
      return el;
    }
  
    clearChatBtn.addEventListener("click", () => {
      if (!confirm("Rensa chatt?")) return;
      chatHistory = [];
      chatBox.innerHTML = "";
      localStorage.removeItem("chatHistory");
    });
  
    // -----------------------------------------------------
    // 🔔 NOTIFIERING
    // -----------------------------------------------------
    function showNotification(text) {
      const note = document.createElement("div");
      note.textContent = text;
      note.style.position = "fixed";
      note.style.bottom = "20px";
      note.style.right = "20px";
      note.style.background = "#198754";
      note.style.color = "#fff";
      note.style.padding = "10px 16px";
      note.style.borderRadius = "8px";
      note.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
      note.style.zIndex = "9999";
      document.body.appendChild(note);
      setTimeout(() => note.remove(), 2500);
    }
  
    // -----------------------------------------------------
    // 💾 SPARA VID STÄNGNING
    // -----------------------------------------------------
    window.addEventListener("beforeunload", () => {
      localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    });
  });
  