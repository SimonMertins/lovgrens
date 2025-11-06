// assets/js/app.js
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("codeForm");
    const resultDiv = document.getElementById("result");
    const loadingDiv = document.getElementById("loading");
    const historyDiv = document.getElementById("history");
  
    updateHistoryDisplay();
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
  
      const errorCode = document.getElementById("errorCode").value.trim();
      const carBrand = document.getElementById("carBrand").value.trim();
      const carYear = document.getElementById("carYear").value.trim();
      const engineCode = document.getElementById("engineCode") ? document.getElementById("engineCode").value.trim() : "";
  
      resultDiv.innerHTML = "";
      loadingDiv.style.display = "block";
  
      if (!errorCode || !carBrand || !carYear) {
        loadingDiv.style.display = "none";
        resultDiv.innerHTML = `<p style="color:red;">⚠️ Fyll i alla obligatoriska fält.</p>`;
        return;
      }
  
      await runSearch({ errorCode, carBrand, carYear, engineCode });
    });
  
    async function runSearch({ errorCode, carBrand, carYear, engineCode = "" }) {
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
          resultDiv.innerHTML = `<p style="color:red;">${data.error}</p>`;
          return;
        }
  
        if (data.result) {
          let formatted = data.result
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n/g, "<br>");
  
          // --- Hitta och infoga åtgärdssektion ---
          const actionsRegex = /(?:\d+\.\s*)?(?:<strong>)?Föreslagna åtgärder:?<\/strong>?([\s\S]*)/i;
          const match = formatted.match(actionsRegex);
  
          if (match) {
            const actions = match[1].trim();
            formatted = formatted.replace(
              actionsRegex,
              `<strong>Föreslagna åtgärder:</strong>
               <button class="toggle-btn">👀 Visa åtgärder ▼</button>
               <div class="steps">${actions}</div>`
            );
          }
  
          // --- Visa resultatkort ---
          resultDiv.innerHTML = `
            <div class="diagnosis-card">
              <header class="diagnosis-header">
                <div>
                  <h3>Felkod: ${errorCode}</h3>
                  <p><strong>${carBrand} ${carYear}</strong>${engineCode ? ` • Motorkod: ${engineCode}` : ""}</p>
                </div>
                <button id="printPDF" class="pdf-btn">
                  <span class="icon">🧾</span> Spara som PDF
                </button>
              </header>
              <div class="diagnosis-body">${formatted}</div>
            </div>
          `;
  
          // --- Toggle Visa/Dölj åtgärder ---
          const toggleButton = document.querySelector(".toggle-btn");
          const stepsDiv = document.querySelector(".steps");
          if (toggleButton && stepsDiv) {
            toggleButton.addEventListener("click", () => {
              stepsDiv.classList.toggle("show");
              const isVisible = stepsDiv.classList.contains("show");
              toggleButton.innerHTML = isVisible
                ? "🙈 Dölj åtgärder ▲"
                : "👀 Visa åtgärder ▼";
            });
          }
  
          // --- PDF-knapp ---
          document.getElementById("printPDF").addEventListener("click", () => {
            if (window.jspdf && window.jspdf.jsPDF) {
              const { jsPDF } = window.jspdf;
              const doc = new jsPDF("p", "pt", "a4");
              const pdfName = `Lovgrens_${errorCode}_${carBrand}${carYear}.pdf`;
              const date = new Date().toLocaleString("sv-SE");
  
              doc.setFont("Helvetica", "bold");
              doc.setFontSize(18);
              doc.text("Lovgrens Diagnosrapport", 40, 50);
              doc.setFontSize(10);
              doc.setFont("Helvetica", "normal");
              doc.text(`Genererad: ${date}`, 40, 68);
              doc.text(`Bilmärke: ${carBrand}`, 40, 84);
              doc.text(`Årsmodell: ${carYear}`, 200, 84);
              if (engineCode) doc.text(`Motorkod: ${engineCode}`, 360, 84);
              doc.text(`Felkod: ${errorCode}`, 40, 100);
  
              const resultText = data.result.replace(/\*\*/g, "").replace(/\n/g, "\n\n");
              doc.setFontSize(11);
              doc.text(resultText, 40, 130, { maxWidth: 520 });
              doc.save(pdfName);
            } else {
              window.print();
            }
          });
  
          // --- Spara & uppdatera historik ---
          saveSearch({ errorCode, carBrand, carYear, engineCode });
          updateHistoryDisplay();
        } else {
          resultDiv.innerHTML = `<p>Inget svar kunde hämtas just nu.</p>`;
        }
      } catch (error) {
        loadingDiv.style.display = "none";
        resultDiv.innerHTML = `<p style="color:red;">Ett fel uppstod: ${error.message}</p>`;
        console.error("Fetch error:", error);
      }
    }
  
    // --- Historikhantering ---
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
        const date = new Date();
        entry.date = date.toLocaleString("sv-SE");
        history.unshift(entry);
        if (history.length > 8) history.pop();
        localStorage.setItem("obdHistory", JSON.stringify(history));
      }
    }
  
    function updateHistoryDisplay() {
      const history = JSON.parse(localStorage.getItem("obdHistory")) || [];
      if (history.length === 0) {
        historyDiv.innerHTML = "";
        return;
      }
  
      const listItems = history
        .map(
          (h, i) => `
          <li data-index="${i}">
            ${i + 1}. ${h.carBrand} ${h.carYear}${h.engineCode ? ` (${h.engineCode})` : ""} — <strong>${h.errorCode}</strong>
            <small> (${h.date})</small>
          </li>`
        )
        .join("");
  
      historyDiv.innerHTML = `
        <h4>🕓 Senaste sökningar</h4>
        <ul id="historyList">${listItems}</ul>
        <button id="clearHistory" class="history-clear">🧹 Rensa historik</button>
      `;
  
      document.querySelectorAll("#historyList li").forEach((item) => {
        item.addEventListener("click", () => {
          const index = item.dataset.index;
          const history = JSON.parse(localStorage.getItem("obdHistory")) || [];
          const chosen = history[index];
          if (chosen) {
            document.getElementById("errorCode").value = chosen.errorCode;
            document.getElementById("carBrand").value = chosen.carBrand;
            document.getElementById("carYear").value = chosen.carYear;
            if (document.getElementById("engineCode"))
              document.getElementById("engineCode").value = chosen.engineCode || "";
            runSearch(chosen);
          }
        });
      });
  
      const clearBtn = document.getElementById("clearHistory");
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          localStorage.removeItem("obdHistory");
          updateHistoryDisplay();
        });
      }
    }
  });
  
  
  
  