document.addEventListener("DOMContentLoaded", function() {
    const searchButton = document.getElementById("searchButton");
    const input = document.getElementById("faultCodeInput");
    const resultDiv = document.getElementById("result");
  
    searchButton.addEventListener("click", async function() {
      const code = input.value.trim();
      if (!code) {
        resultDiv.innerText = "Skriv in en felkod först.";
        return;
      }
  
      resultDiv.innerText = "Söker...";
  
      try {
        const resp = await fetch("http://localhost:3000/api/diagnose", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ code })
        });
  
        if (!resp.ok) {
          const err = await resp.json();
          resultDiv.innerText = `Fel från servern: ${err.error || resp.statusText}`;
          return;
        }
  
        const data = await resp.json();
        resultDiv.innerText = data.explanation;
      } catch (e) {
        console.error(e);
        resultDiv.innerText = "Misslyckades att kontakta servern. Kolla konsolen.";
      }
    });
  });
  
    