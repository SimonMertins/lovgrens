// ========================================
// AutonomeX - app.js (MATCHAR DIN HTML)
// ========================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 AutonomeX app startar…");

  // ----------------------------------------------------
  // Supabase-klient
  // ----------------------------------------------------
  const SUPABASE_URL = "https://ewyyoyqgpfgmeafmiefv.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3eXlveXFncGZnbWVhZm1pZWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNDYxMzAsImV4cCI6MjA3ODYyMjEzMH0.Uk6wJbhGU11wHAk1O8wx5Tllk4s-q5oSZJCiPUI9nWk";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const apiBase = "http://localhost:3000";

  // ----------------------------------------------------
  // DOM-referenser – DINA KORREKTA ID:N
  // ----------------------------------------------------
  const form = document.getElementById("codeForm");
  const resultBox = document.getElementById("result");
  const latestBtn = document.getElementById("latestBtn");
  const latestBox = document.getElementById("latestBox");
  const historyBox = document.getElementById("history");

  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatBox = document.getElementById("chatBox");

  let currentDiagnosis = null;

  // ----------------------------------------------------
  // Utility – se till att error_codes ALLTID är array
  // ----------------------------------------------------
  function toArray(val) {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === "string") return [val];
      if (typeof val === "object") return Object.values(val);
      return [];
  }

  // ----------------------------------------------------
  // Visa diagnos i UI
  // ----------------------------------------------------
  function displayDiagnosis(diag) {
      currentDiagnosis = diag;

      const codes = toArray(diag.error_codes).join(", ");

      resultBox.innerHTML = `
          <div class="diag-box">
              <h3>${codes}</h3>
              <p><strong>Märke:</strong> ${diag.car_brand}</p>
              <p><strong>Årsmodell:</strong> ${diag.car_year}</p>
              <p><strong>Motorkod:</strong> ${diag.engine_code || "Okänd"}</p>
              <hr>
              <pre>${diag.result}</pre>
          </div>
      `;

      saveLocal(diag);
      updateHistoryUI();
  }

  // ----------------------------------------------------
  // Lokal lagring
  // ----------------------------------------------------
  function saveLocal(diag) {
      localStorage.setItem("latest_diagnosis", JSON.stringify(diag));

      let history = JSON.parse(localStorage.getItem("history") || "[]");
      history.unshift(diag);
      history = history.slice(0, 10);
      localStorage.setItem("history", JSON.stringify(history));
  }

  function loadLatestLocal() {
      const data = localStorage.getItem("latest_diagnosis");
      if (!data) {
          alert("Ingen sparad diagnos.");
          return;
      }
      displayDiagnosis(JSON.parse(data));
  }

  function updateHistoryUI() {
      let history = JSON.parse(localStorage.getItem("history") || "[]");

      if (!history.length) {
          historyBox.innerHTML = "<p>Ingen historik.</p>";
          return;
      }

      historyBox.innerHTML = history
          .map(
              (d, i) => `
          <div class="history-item">
              <button class="btn-link" data-index="${i}">
                  ${toArray(d.error_codes).join(", ")} — ${d.car_brand} ${d.car_year}
              </button>
          </div>
      `
          )
          .join("");

      document.querySelectorAll(".history-item button").forEach((btn) => {
          btn.addEventListener("click", () => {
              const i = btn.dataset.index;
              const history = JSON.parse(localStorage.getItem("history"));
              displayDiagnosis(history[i]);
          });
      });
  }

  // ----------------------------------------------------
  // Ladda senaste
  // ----------------------------------------------------
  if (latestBtn) {
      latestBtn.addEventListener("click", loadLatestLocal);
  }

  // ----------------------------------------------------
  // Skicka felkod
  // ----------------------------------------------------
  if (form) {
      form.addEventListener("submit", async (e) => {
          e.preventDefault();

          const errorCode = document.getElementById("errorCode").value;
          const carBrand = document.getElementById("carBrand").value;
          const carYear = document.getElementById("carYear").value;
          const engineCode = document.getElementById("engineCode").value;

          const session = (await supabase.auth.getSession()).data.session;
          if (!session) return alert("Du måste vara inloggad.");

          try {
              const res = await fetch(`${apiBase}/api/obd/diagnose`, {
                  method: "POST",
                  headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                      errorCode,
                      carBrand,
                      carYear,
                      engineCode,
                  }),
              });

              const data = await res.json();

              if (!res.ok) {
                  console.error("Diagnos error:", data);
                  alert(data.error || "Fel uppstod");
                  return;
              }

              displayDiagnosis(data.diagnosis);
          } catch (err) {
              console.error("Diagnos exception:", err);
              alert("Kunde inte kontakta servern.");
          }
      });
  }

  // ----------------------------------------------------
  // CHAT
  // ----------------------------------------------------
  function appendMessage(role, text) {
      const div = document.createElement("div");
      div.className = `msg ${role}`;
      div.textContent = text;
      chatBox.appendChild(div);
      chatBox.scrollTop = chatBox.scrollHeight;
  }

  if (chatForm) {
      chatForm.addEventListener("submit", async (e) => {
          e.preventDefault();

          const text = chatInput.value.trim();
          if (!text) return;
          if (!currentDiagnosis) return alert("Gör en diagnos först.");

          const session = (await supabase.auth.getSession()).data.session;
          if (!session) return alert("Du måste vara inloggad.");

          appendMessage("user", text);
          chatInput.value = "";

          const context = `
Felkoder: ${toArray(currentDiagnosis.error_codes).join(", ")}
Märke: ${currentDiagnosis.car_brand}
Årsmodell: ${currentDiagnosis.car_year}
Motorkod: ${currentDiagnosis.engine_code || "Okänd"}

Originaldiagnos:
${currentDiagnosis.result}

Använd detta som kontext.`;

          const messages = [
              { role: "system", content: "Du är en bilmekaniker-Expert AI." },
              { role: "user", content: context },
              { role: "user", content: text },
          ];

          try {
              const res = await fetch(`${apiBase}/api/chat`, {
                  method: "POST",
                  headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                      messages,
                      diagnosisId: currentDiagnosis.id,
                  }),
              });

              const data = await res.json();

              if (!res.ok) {
                  console.error("Chat error:", data);
                  alert(data.error || "Chat-fel");
                  return;
              }

              appendMessage("assistant", data.reply);
          } catch (err) {
              console.error("Chat exception:", err);
          }
      });
  }

  // Ladda historik vid start
  updateHistoryUI();
});
