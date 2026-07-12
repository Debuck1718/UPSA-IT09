(function () {
  const toggle = document.getElementById("aiChatToggle");
  const win = document.getElementById("aiChatWindow");
  const close = document.getElementById("aiChatClose");
  const send = document.getElementById("aiChatSend");
  const input = document.getElementById("aiChatInput");
  const messages = document.getElementById("aiChatMessages");

  if (!toggle || !win) return; // Exit if elements aren't present

  toggle.addEventListener("click", () => win.classList.remove("d-none"));
  close.addEventListener("click", () => win.classList.add("d-none"));

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    // 1. Safe access for course title
    const courseTitleEl = document.getElementById("slidesCourseTitle");
    const courseName = (courseTitleEl && courseTitleEl.textContent !== "Select a Course") 
      ? courseTitleEl.textContent 
      : null;

    // 2. Add User Message to UI
    messages.innerHTML += `<div class="mb-2 text-end"><small class="bg-primary text-white p-2 rounded d-inline-block">${text}</small></div>`;
    input.value = "";
    messages.scrollTop = messages.scrollHeight;

    try {
      // 3. API Call
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, course: courseName })
      });
      
      const data = await response.json();

      // 4. Add AI Answer to UI
      if (data.ok && data.answer) {
        messages.innerHTML += `<div class="mb-2 text-start"><small class="bg-white p-2 rounded border d-inline-block">${data.answer}</small></div>`;
      } else {
        messages.innerHTML += `<div class="mb-2 text-start text-danger"><small>Error: ${data.message || 'Could not get response.'}</small></div>`;
      }
    } catch (err) {
      messages.innerHTML += `<div class="mb-2 text-start text-danger"><small>Connection Error.</small></div>`;
    }
    messages.scrollTop = messages.scrollHeight;
  }

  send.addEventListener("click", sendMessage);
  input.addEventListener("keypress", (e) => { if (e.key === 'Enter') sendMessage(); });
})();