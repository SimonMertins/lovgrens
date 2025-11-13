/* =========================================================
   Lovgrens Diagnostik – Komplett app.js (med chat-kontext)
   ========================================================= */
   document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 App startar...");
  
    /* -----------------------------------------
       ELEMENTREFERENSER
    ----------------------------------------- */
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
  
    // Dark mode
    const themeToggle = document.getElementById("themeToggle");
  
    /* -----------------------------------------
       LOKAL DATA
    ----------------------------------------- */
    let diagnoses = JSON.parse(localStorage.getItem("diagnoses")) || [];
    let currentDiagnosisId = null;
  
    let chatThreads = JSON.parse(localStorage.getItem("chatThreads")) || {};
    let currentChat = [];
  
    /* -----------------------------------------
       DARK MODE
    ----------------------------------------- */
    function loadTheme() {
      const saved = localStorage.getItem("theme") || "light";
      document.body.classList.toggle("dark", saved === "dark");
      themeToggle.textContent = saved === "dark" ? "☀️" : "🌙";
    }
    loadTheme();
  
    themeToggle.addEventListener("click", () => {
      const newTheme = document.body.classList.contains("dark") ? "light" : "dark";
      document.body.classList.toggle("dark");
      themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙";
      localStorage.setItem("theme", newTheme);
    });
  
    /* -----------------------------------------
       DIAGNOS – FELKODSÖKNING
    ----------------------------------------- */
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("🔎 Diagnos startar...");
  
      const errorCode = document.getElementById("errorCode").value.trim();
      const carBrand = document.getElementById("carBrand").value.trim();
      const carYear = document.getElementById("carYear").value.trim();
      const engineCode = document.getElementById("engineCode").value.trim();
  
      resultDiv.innerHTML = "";
      loadingDiv.style.display = "block";
  
      if (!errorCode || !carBrand || !carYear) {
        loadingDiv.style.display = "none";
        resultDiv.innerHTML = `<p style="color:#d9534f;">⚠️ Fyll i felkod, märke och årsmodell.</p>`;
        return;
      }
  
      try {
        const response = await fetch("http://localhost:3000/api/obb/diagnose", {
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
  
        // Skapa diagnosobjekt
        const diag = {
          id: Date.now().toString(),
          errorCode,
          carBrand,
          carYear,
          engineCode,
          result: data.result,
          date: new Date().toLocaleString("sv-SE"),
        };
  
        diagnoses.unshift(diag);
        if (diagnoses.length > 30) diagnoses.pop();
        localStorage.setItem("diagnoses", JSON.stringify(diagnoses));
  
        currentDiagnosisId = diag.id;
  
        // Skapa ny chattråd för diagnosen
        chatThreads[currentDiagnosisId] = [];
        localStorage.setItem("chatThreads", JSON.stringify(chatThreads));
        loadChatThread();
  
        displayDiagnosis(diag);
        updateHistoryDisplay();
        showNotification("✅ Diagnos klar!");
      } catch (err) {
        loadingDiv.style.display = "none";
        resultDiv.innerHTML = `<p style="color:#d9534f;">Fel: ${err.message}</p>`;
        console.error("Diagnos error:", err);
      }
    });
  
    /* -----------------------------------------
       VISA DIAGNOS
    ----------------------------------------- */
    function displayDiagnosis(diag) {
      let formatted = diag.result
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
  
      const actionsRegex =
        /(Föreslagna åtgärder:|Föreslagna åtgärder<\/strong>:?)([\s\S]*)/i;
  
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
        <h3>Felkod: ${diag.errorCode}</h3>
        <p><strong>${diag.carBrand} ${diag.carYear}</strong>
           ${diag.engineCode ? `– Motorkod: ${diag.engineCode}` : ""}</p>
        <p><small>${diag.date}</small></p>
        <div class="answer">${formatted}</div>
      `;
  
      const toggleBtn = resultDiv.querySelector(".toggle-btn");
      const steps = resultDiv.querySelector(".steps");
  
      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          const visible = steps.classList.toggle("show");
          toggleBtn.textContent = visible
            ? "🙈 Dölj åtgärder ▲"
            : "👀 Visa åtgärder ▼";
        });
      }
    }
  
    /* -----------------------------------------
       HISTORIK – Klicka för att visa gammal diagnos
    ----------------------------------------- */
    function updateHistoryDisplay() {
      if (!diagnoses.length) {
        historyDiv.innerHTML = "";
        return;
      }
  
      const list = diagnoses
        .map(
          (d) => `
        <div class="history-item" data-id="${d.id}">
          <strong>${d.errorCode}</strong> — ${d.carBrand} ${d.carYear}
          <small style="float:right;">${d.date}</small>
        </div>`
        )
        .join("");
  
      historyDiv.innerHTML = `
        <h4>🕓 Senaste sökningar</h4>
        ${list}
        <button id="clearHistory" class="btn-link">Rensa historik</button>
      `;
  
      document.querySelectorAll(".history-item").forEach((item) => {
        item.addEventListener("click", () => {
          const id = item.dataset.id;
          currentDiagnosisId = id;
  
          const diag = diagnoses.find((d) => d.id === id);
          if (!diag) return;
  
          displayDiagnosis(diag);
          loadChatThread();
        });
      });
  
      document.getElementById("clearHistory").addEventListener("click", () => {
        if (!confirm("Rensa all historik?")) return;
        localStorage.removeItem("diagnoses");
        localStorage.removeItem("chatThreads");
        diagnoses = [];
        chatThreads = {};
        historyDiv.innerHTML = "";
        chatBox.innerHTML = "";
        resultDiv.innerHTML = "";
      });
    }
    updateHistoryDisplay();
  
    /* -----------------------------------------
       CHATT – Fungerar nu med kontext från diagnosen
    ----------------------------------------- */
    function loadChatThread() {
      chatBox.innerHTML = "";
  
      if (!currentDiagnosisId) return;
  
      currentChat = chatThreads[currentDiagnosisId] || [];
  
      currentChat.forEach((m) => appendChatMessage(m.role, m.content));
    }
  
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
  
      const text = chatInput.value.trim();
      if (!text || !currentDiagnosisId) return;
  
      appendChatMessage("user", text);
  
      currentChat.push({ role: "user", content: text });
      chatThreads[currentDiagnosisId] = currentChat;
      localStorage.setItem("chatThreads", JSON.stringify(chatThreads));
  
      const diag = diagnoses.find((d) => d.id === currentDiagnosisId);
  
      // SKICKA KONTEKST + CHATTHISTORIK
      const enrichedMessages = [
        {
          role: "system",
          content: `
          Du är en professionell bilmekaniker med expertis inom OBD2-diagnostik.
  
          Här är detaljerna om fordonet och diagnosen:
  
          Felkod(er): ${diag.errorCode}
          Bilmärke: ${diag.carBrand}
          Årsmodell: ${diag.carYear}
          Motorkod: ${diag.engineCode || "Okänd"}
  
          Ursprungligt AI-diagnossvar:
          ${diag.result}
  
          Använd detta som kontext när du svarar. Var teknisk, tydlig och konkret.
          `,
        },
        ...currentChat,
      ];
  
      try {
        const response = await fetch("http://localhost:3000/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: enrichedMessages }),
        });
  
        const data = await response.json();
  
        if (data.reply) {
          appendChatMessage("assistant", data.reply);
  
          currentChat.push({ role: "assistant", content: data.reply });
          chatThreads[currentDiagnosisId] = currentChat;
          localStorage.setItem("chatThreads", JSON.stringify(chatThreads));
        }
      } catch (err) {
        appendChatMessage("assistant", "⚠️ Fel: " + err.message);
        console.error(err);
      }
  
      chatInput.value = "";
    });
  
    function appendChatMessage(role, text) {
      const el = document.createElement("div");
      el.className = `message ${role}`;
      el.innerHTML = text.replace(/\n/g, "<br>");
      chatBox.appendChild(el);
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  
    /* -----------------------------------------
       EXPORT PDF – Chat
    ----------------------------------------- */
    exportChatBtn.addEventListener("click", () => {
      if (!currentChat.length) return alert("Ingen chatt att exportera.");
  
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF("p", "pt", "a4");
  
      doc.setFontSize(14);
      doc.text("Lovgrens Chat-logg", 40, 60);
  
      let y = 90;
      currentChat.forEach((m) => {
        const prefix = m.role === "user" ? "Användare:" : "AI:";
        const lines = doc.splitTextToSize(prefix + " " + m.content, 500);
        doc.text(lines, 40, y);
        y += lines.length * 14 + 10;
  
        if (y > 750) {
          doc.addPage();
          y = 40;
        }
      });
  
      doc.save("chatlog.pdf");
    });
  
    /* -----------------------------------------
       NOTISER
    ----------------------------------------- */
    function showNotification(text) {
      const note = document.createElement("div");
      note.textContent = text;
  
      Object.assign(note.style, {
        position: "fixed",
        bottom: "20px",
        right: "20px",
        background: "#198754",
        color: "white",
        padding: "10px 16px",
        borderRadius: "8px",
        fontWeight: "600",
        boxShadow: "0 6px 14px rgba(0,0,0,.3)",
        opacity: "0",
        transition: "opacity .2s",
        zIndex: 9999,
      });
  
      document.body.appendChild(note);
      setTimeout(() => (note.style.opacity = "1"), 10);
      setTimeout(() => note.remove(), 2500);
    }
  
  });
  