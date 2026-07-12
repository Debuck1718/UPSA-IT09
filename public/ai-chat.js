(function () {
  const toggle = document.getElementById("aiChatToggle");
  const win = document.getElementById("aiChatWindow");
  const close = document.getElementById("aiChatClose");
  const send = document.getElementById("aiChatSend");
  const input = document.getElementById("aiChatInput");
  const messages = document.getElementById("aiChatMessages");

  toggle.addEventListener("click", () => win.classList.remove("d-none"));
  close.addEventListener("click", () => win.classList.add("d-none"));

  async function sendMessage() {
  const inputEl = document.getElementById("aiChatInput");
  const text = inputEl.value.trim();
  
  // Extract course from your existing dashboard element
  const courseTitleEl = document.getElementById("slidesCourseTitle");
  const courseName = courseTitleEl.textContent !== "Select a Course" ? courseTitleEl.textContent : null;

  if (!text) return;

  // Add user message to UI...

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      question: text, 
      course: courseName 
    })
  });
  
  const data = await response.json();
  // Display data.answer in UI...
}

  send.addEventListener("click", sendMessage);
  input.addEventListener("keypress", (e) => { if (e.key === 'Enter') sendMessage(); });
})();