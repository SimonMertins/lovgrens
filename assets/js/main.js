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
  
      resultDiv.innerHTML = "";
      loadingDiv.style.display = "flex";
  
      if (!errorCode || !carBrand || !carYear) {
        loadingDiv.style.display = "none";
        resultDiv.innerHTML = `<p style="color:red;">⚠️ Fyll i alla fält innan du söker.</p>`;
        return;
      }
  
      await runSearch({ errorCode, carBrand, carYear });
    });
  
    // --- KÖR SÖKNING ---
    async function runSearch({ errorCode, carBrand, carYear }) {
      try {
        const response = await fetch("http://localhost:3000/api/obd/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errorCode, carBrand, carYear }),
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
  
          // 🔍 Leta efter rubriken “Föreslagna åtgärder”
          const regex = /<strong>Föreslagna åtgärder:<\/strong>([\s\S]*)/i;
          const match = formatted.match(regex);
  
          if (match) {
            const actions = match[1].trim();
            formatted = formatted.replace(
              regex,
              `<strong>Föreslagna åtgärder:</strong>
               <button class="toggle-btn">👀 Visa åtgärder ▼</button>
               <div class="steps">${actions}</div>`
            );
          }
  
          resultDiv.innerHTML = `
            <header id="reportHeader">
              <img src="assets/logo.png" alt="Lovgrens Logotyp" onerror="this.style.display='none'">
              <h1>Lovgrens Diagnosrapport</h1>
              <p>${new Date().toLocaleString("sv-SE")}</p>
            </header>
  
            <h3>Felkod: ${errorCode}</h3>
            <p><strong>${carBrand} ${carYear}</strong></p>
            <div class="answer">${formatted}</div>
  
            <footer id="reportFooter">
              <p>🔧 Genererad av Lovgrens AI Diagnostik</p>
            </footer>
  
            <button id="printPDF" class="print-btn">🧾 Spara som PDF</button>
          `;
  
          // --- 📄 SKAPA PDF MED AUTOMATISKT FILNAMN ---
          document.getElementById("printPDF").addEventListener("click", async () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF("p", "pt", "a4");
  
            const pdfName = `Lovgrens_${errorCode}_${carBrand}${carYear}.pdf`;
            const date = new Date().toLocaleString("sv-SE");
  
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(20);
            doc.text("Lovgrens Diagnosrapport", 40, 50);
  
            doc.setFontSize(10);
            doc.text(`Genererad: ${date}`, 40, 70);
            doc.text(`Bilmärke: ${carBrand}`, 40, 85);
            doc.text(`Årsmodell: ${carYear}`, 200, 85);
            doc.text(`Felkod: ${errorCode}`, 40, 100);
  
            const resultText = data.result.replace(/\*\*/g, "").replace(/\n/g, "\n\n");
  
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(11);
            doc.text(resultText, 40, 130, { maxWidth: 520 });
  
            doc.save(pdfName);
          });
  
          // --- Toggle-knapp med pil och text ---
          const toggleBtn = document.querySelector(".toggle-btn");
          const stepsDiv = document.querySelector(".steps");
          if (toggleBtn && stepsDiv) {
            stepsDiv.classList.remove("show");
            toggleBtn.addEventListener("click", () => {
              const isVisible = stepsDiv.classList.toggle("show");
              toggleBtn.textContent = isVisible
                ? "🙈 Dölj åtgärder ▲"
                : "👀 Visa åtgärder ▼";
            });
          }
  
          saveSearch({ errorCode, carBrand, carYear });
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
  
    // --- SPARA SÖKNING ---
    function saveSearch(entry) {
      const history = JSON.parse(localStorage.getItem("obdHistory")) || [];
      const exists = history.find(
        (h) =>
          h.errorCode === entry.errorCode &&
          h.carBrand === entry.carBrand &&
          h.carYear === entry.carYear
      );
      if (!exists) {
        const date = new Date();
        entry.date = date.toLocaleString("sv-SE");
        history.unshift(entry);
        if (history.length > 5) history.pop();
        localStorage.setItem("obdHistory", JSON.stringify(history));
      }
    }
  
    // --- VISA HISTORIK ---
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
            ${i + 1}. ${h.carBrand} ${h.carYear} — <strong>${h.errorCode}</strong>
            <small>(${h.date})</small>
          </li>`
        )
        .join("");
  
      historyDiv.innerHTML = `
        <h4>🕓 Senaste sökningar</h4>
        <ul id="historyList">${listItems}</ul>
        <button id="clearHistory">🧹 Rensa historik</button>
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
            runSearch(chosen);
          }
        });
      });
  
      document
        .getElementById("clearHistory")
        .addEventListener("click", () => clearHistory());
    }
  
    // --- RADERA HISTORIK ---
    function clearHistory() {
      localStorage.removeItem("obdHistory");
      updateHistoryDisplay();
    }
  });
  