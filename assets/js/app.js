// assets/js/app.js
document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ Lovgrens Diagnostik – interaktiv chatt startar...");
  
    // --- Elementreferenser ---
    const form = document.getElementById("codeForm");
    const resultDiv = document.getElementById("result");
    const loadingDiv = document.getElementById("loading");
    const historyDiv = document.getElementById("history");
    const exportPDFBtn = document.getElementById("exportPDF");
  
    // Chat
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const chatBox = document.getElementById("chatBox");
    const clearChatBtn = document.getElementById("clearChat");
    const exportChatBtn = document.getElementById("exportChat");
  
    // Chat context + modal
    const chatContext = document.getElementById("chatContext");
    const modal = document.getElementById("diagnosisModal");
    const diagnosisList = document.getElementById("diagnosisList");
    const closeModalBtn = document.getElementById("closeModal");
  
    // --- Data ---
    let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || [];
    let latestDiagnosis = JSON.parse(localStorage.getItem("latestDiagnosis")) || null;
  
    // Init
    updateHistoryDisplay();
    loadChatHistory();
    updateChatContext();
  
    // -----------------------------------------------------
    // DIAGNOS (submit)
    // -----------------------------------------------------
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorCode = document.getElementById("errorCode").value.trim();
      const carBrand = document.getElementById("carBrand").value.trim();
      const carYear = document.getElementById("carYear").value.trim();
      const engineCode = document.getElementById("engineCode").value.trim();
  
      resultDiv.innerHTML = "";
      loadingDiv.style.display = "block";
  
      if (!errorCode || !carBrand || !carYear) {
        loadingDiv.style.display = "none";
        resultDiv.innerHTML = `<p style="color:#d9534f;">⚠️ Fyll i alla obligatoriska fält.</p>`;
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
          shortSummary: extractSummary(data.result),
          timestamp: new Date().toLocaleString("sv-SE"),
        };
        localStorage.setItem("latestDiagnosis", JSON.stringify(latestDiagnosis));
        updateChatContext();
        showNotification("✅ Svar mottaget från AI");
      } catch (err) {
        loadingDiv.style.display = "none";
        resultDiv.innerHTML = `<p style="color:#d9534f;">Ett fel uppstod: ${err.message}</p>`;
        console.error("Diagnos error:", err);
      }
    });
  
    // -----------------------------------------------------
    // Visa resultat
    // -----------------------------------------------------
    function displayDiagnosis(errorCode, carBrand, carYear, engineCode, raw) {
      let formatted = raw.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
  
      // Sätt in toggle för åtgärder om text innehåller "Föreslagna åtgärder"
      const actionsRegex = /(Föreslagna åtgärder:|Föreslagna åtgärder<\/strong>:?)([\s\S]*)/i;
      const match = formatted.match(actionsRegex);
      if (match) {
        const header = match[1];
        const actions = match[2].trim();
        formatted = formatted.replace(
          actionsRegex,
          `${header}
           <button class="toggle-btn">👀 Visa åtgärder ▼</button>
           <div class="steps">${actions}</div>`
        );
      }
  
      resultDiv.innerHTML = `
        <header style="margin-bottom:8px;">
          <h3 style="margin:0;">Felkod: ${errorCode}</h3>
          <p style="margin:4px 0 8px 0;">
            <strong>${carBrand} ${carYear}</strong>
            ${engineCode ? ` — Motorkod: ${engineCode}` : ""}
          </p>
        </header>
        <div class="answer">${formatted}</div>
      `;
  
      const toggleBtn = resultDiv.querySelector(".toggle-btn");
      const stepsDiv = resultDiv.querySelector(".steps");
      if (toggleBtn && stepsDiv) {
        stepsDiv.classList.remove("show");
        toggleBtn.addEventListener("click", () => {
          const visible = stepsDiv.classList.toggle("show");
          toggleBtn.textContent = visible ? "🙈 Dölj åtgärder ▲" : "👀 Visa åtgärder ▼";
        });
      }
    }
  
    // -----------------------------------------------------
    // HISTORIK: spara & visa
    // -----------------------------------------------------
    function saveSearch(entry) {
      const history = JSON.parse(localStorage.getItem("obdHistory")) || [];
      // undvik dubbletter (samma kod+märke+år+motorkod)
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
        if (history.length > 10) history.pop();
        localStorage.setItem("obdHistory", JSON.stringify(history));
      }
    }
  
    function updateHistoryDisplay() {
      const history = JSON.parse(localStorage.getItem("obdHistory")) || [];
      if (!history.length) {
        historyDiv.innerHTML = "";
        return;
      }
  
      const itemsHtml = history
        .map(
          (h, i) =>
            `<li class="history-item" data-index="${i}">${i + 1}. ${h.carBrand} ${h.carYear}${h.engineCode ? ` (${h.engineCode})` : ""} — <strong>${h.errorCode}</strong> <small>(${h.date})</small></li>`
        )
        .join("");
  
      historyDiv.innerHTML = `
        <h4>🕓 Senaste sökningar</h4>
        <ul id="historyList">${itemsHtml}</ul>
        <div style="margin-top:8px;">
          <button id="clearHistory" class="history-clear">🧹 Rensa historik</button>
        </div>
      `;
  
      // Sätt click-handlare för varje historikrad
      document.querySelectorAll(".history-item").forEach((li) => {
        li.addEventListener("click", (ev) => {
          const idx = parseInt(li.dataset.index, 10);
          const hist = JSON.parse(localStorage.getItem("obdHistory")) || [];
          const selected = hist[idx];
          if (!selected) return;
          // Fyll i formuläret
          document.getElementById("errorCode").value = selected.errorCode;
          document.getElementById("carBrand").value = selected.carBrand;
          document.getElementById("carYear").value = selected.carYear;
          document.getElementById("engineCode").value = selected.engineCode || "";
          // Trigga sök (submit)
          form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
      });
  
      // Rensa historik
      const clearBtn = document.getElementById("clearHistory");
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          if (!confirm("Rensa all historik?")) return;
          localStorage.removeItem("obdHistory");
          updateHistoryDisplay();
          showNotification("🧹 Historik rensad");
        });
      }
    }
  
    // -----------------------------------------------------
    // CHAT: load, send, append
    // -----------------------------------------------------
    function loadChatHistory() {
      chatBox.innerHTML = "";
      chatHistory.forEach((m) => appendChatMessage(m.role, m.content));
    }
  
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      appendChatMessage("user", text);
      chatHistory.push({ role: "user", content: text });
      chatInput.value = "";
  
      const enrichedMessages = [...chatHistory];
      if (latestDiagnosis) {
        enrichedMessages.unshift({
          role: "system",
          content: `Tidigare diagnosinformation:\nFelkod: ${latestDiagnosis.errorCode}\nBilmärke: ${latestDiagnosis.carBrand}\nÅrsmodell: ${latestDiagnosis.carYear}\nMotorkod: ${latestDiagnosis.engineCode || "Okänd"}\nTidigare diagnos: ${latestDiagnosis.shortSummary || ""}`,
        });
      }
  
      try {
        const response = await fetch("http://localhost:3000/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: enrichedMessages }),
        });
        const data = await response.json();
        if (data.reply) {
          appendChatMessage("assistant", data.reply);
          chatHistory.push({ role: "assistant", content: data.reply });
          localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
        } else {
          appendChatMessage("assistant", "❌ Inget svar kunde hämtas just nu.");
        }
      } catch (err) {
        appendChatMessage("assistant", "⚠️ Ett fel uppstod: " + err.message);
        console.error("Chat error:", err);
      }
    });
  
    function appendChatMessage(role, text) {
      const el = document.createElement("div");
      el.className = `message ${role === "user" ? "user" : "ai"}`;
      el.innerHTML = text.replace(/\n/g, "<br>");
      chatBox.appendChild(el);
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  
    // -----------------------------------------------------
    // CHAT CONTEXT + MODAL (Byt diagnos / Koppla bort)
    // -----------------------------------------------------
    function updateChatContext() {
      if (!chatContext) return;
      if (!latestDiagnosis) {
        chatContext.innerHTML = `
          <p>💬 Ingen diagnos kopplad ännu.</p>
          <div class="chat-context-actions">
            <button id="changeDiagnosis" class="btn-small">Byt diagnos</button>
          </div>`;
      } else {
        chatContext.innerHTML = `
          <p style="font-size:0.9rem;color:#666;">💡 Chatten är kopplad till:</p>
          <p style="font-weight:600;margin:4px 0;">${latestDiagnosis.carBrand} ${latestDiagnosis.carYear} (${latestDiagnosis.errorCode}) ${latestDiagnosis.engineCode? "– "+latestDiagnosis.engineCode : ""}</p>
          <p style="font-size:0.85rem;color:#555;font-style:italic;margin-bottom:6px;">${latestDiagnosis.shortSummary || ""}</p>
          <div class="chat-context-actions">
            <button id="changeDiagnosis" class="btn-small">Byt diagnos</button>
            <button id="clearDiagnosis" class="btn-small">Koppla bort</button>
          </div>`;
      }
  
      // Haka på knappar
      const changeBtn = document.getElementById("changeDiagnosis");
      if (changeBtn) changeBtn.addEventListener("click", openModal);
      const clearBtn = document.getElementById("clearDiagnosis");
      if (clearBtn) clearBtn.addEventListener("click", () => {
        latestDiagnosis = null;
        localStorage.removeItem("latestDiagnosis");
        updateChatContext();
        showNotification("🔌 Chatten frikopplad från diagnos");
      });
    }
  
    function openModal() {
      const history = JSON.parse(localStorage.getItem("obdHistory")) || [];
      diagnosisList.innerHTML = "";
      if (!history.length) {
        diagnosisList.innerHTML = "<li>Ingen tidigare diagnos hittades.</li>";
      } else {
        history.forEach((h, i) => {
          const li = document.createElement("li");
          li.textContent = `${h.carBrand} ${h.carYear} (${h.errorCode}) ${h.engineCode ? "– "+h.engineCode : ""}`;
          li.addEventListener("click", () => {
            latestDiagnosis = {
              ...h,
              shortSummary: h.result ? (h.result.split("\n")[0].slice(0,120)) : ""
            };
            localStorage.setItem("latestDiagnosis", JSON.stringify(latestDiagnosis));
            updateChatContext();
            showNotification(`🔄 Chatten kopplad till ${h.carBrand} ${h.carYear}`);
            closeModal();
          });
          diagnosisList.appendChild(li);
        });
      }
      modal.classList.remove("hidden");
    }
  
    function closeModal() {
      modal.classList.add("hidden");
    }
    if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
  
    // -----------------------------------------------------
    // EXPORT CHAT / CLEAR CHAT
    // -----------------------------------------------------
    clearChatBtn?.addEventListener("click", () => {
      if (!confirm("Rensa hela chatthistoriken?")) return;
      chatHistory = [];
      localStorage.removeItem("chatHistory");
      chatBox.innerHTML = "";
      showNotification("🧹 Chatthistorik rensad");
    });
  
    exportChatBtn?.addEventListener("click", () => {
      if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("p", "pt", "a4");
        doc.setFontSize(14);
        doc.text("Lovgrens Chat-logg", 40, 60);
        doc.setFontSize(11);
        let y = 80;
        chatHistory.forEach((m) => {
          const label = m.role === "user" ? "Användare: " : "AI: ";
          const lines = doc.splitTextToSize(label + m.content, 500);
          doc.text(lines, 40, y);
          y += lines.length * 14 + 8;
          if (y > 750) {
            doc.addPage();
            y = 40;
          }
        });
        doc.save("lovgrens_chat.pdf");
      } else {
        alert("PDF-export kräver jsPDF (script finns i app.html).");
      }
    });
  
    // -----------------------------------------------------
    // UTILS
    // -----------------------------------------------------
    function extractSummary(text) {
      if (!text) return "";
      const firstLine = text.split("\n").find(l => l.trim().length > 0) || "";
      return firstLine.length > 120 ? firstLine.slice(0, 120) + "..." : firstLine;
    }
  
    function showNotification(text) {
      const note = document.createElement("div");
      Object.assign(note.style, {
        position: "fixed",
        bottom: "20px",
        right: "20px",
        background: "#198754",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: "8px",
        fontWeight: "600",
        boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
        zIndex: "9999",
      });
      note.textContent = text;
      document.body.appendChild(note);
      setTimeout(() => note.remove(), 2500);
    }
  
    // Save on unload
    window.addEventListener("beforeunload", () => {
      localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    });
  });
  