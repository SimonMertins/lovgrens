// Supabase Auth Client
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 🔧 BYT UT DESSA TVÅ VÄRDEN
const SUPABASE_URL = "https://ewyyoyqgpfgmeafmiefv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3eXlveXFncGZnbWVhZm1pZWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNDYxMzAsImV4cCI6MjA3ODYyMjEzMH0.Uk6wJbhGU11wHAk1O8wx5Tllk4s-q5oSZJCiPUI9nWk";

// Initiera klienten
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Element
const loginBtn = document.getElementById("authLoginBtn");
const emailInput = document.getElementById("authEmail");
const authStatus = document.getElementById("authStatus");
const authBox = document.getElementById("authBox");
const userPanel = document.getElementById("authUserPanel");
const userEmailDisplay = document.getElementById("authUserEmail");
const logoutBtn = document.getElementById("authLogoutBtn");

// ➤ LOGIN (magic link)
loginBtn?.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    authStatus.textContent = "Ange en giltig e-postadress.";
    return;
  }

  const { error } = await supabase.auth.signInWithOtp({ email });

  if (error) {
    authStatus.textContent = "Fel: " + error.message;
  } else {
    authStatus.textContent =
      "En magisk länk har skickats! Kontrollera din e-post.";
  }
});

// ➤ SESSION ÄNDRADES (inloggad / utloggad)
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    // Inloggad
    authBox.style.display = "none";
    userPanel.style.display = "block";

    userEmailDisplay.textContent = session.user.email;

    // Spara userID lokalt till app.html
    localStorage.setItem("autonomex_user_id", session.user.id);
    localStorage.setItem("autonomex_user_email", session.user.email);
  } else {
    // Utloggad
    authBox.style.display = "block";
    userPanel.style.display = "none";

    localStorage.removeItem("autonomex_user_id");
    localStorage.removeItem("autonomex_user_email");
  }
});

// ➤ LOGOUT
logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
});


  
