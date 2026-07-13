const pdf = require('pdf-parse');

// Ensure you use a secure environment variable for your key
const API_KEY = process.env.GEMINI_API_KEY; 
// If the above fails, use this specific versioned model path:
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${API_KEY}`;
/**
 * Parses PDF buffers into plain text for the AI
 */
async function extractTextFromBuffer(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error("PDF Extraction Error:", error);
    return "[Could not extract text from this document]";
  }
}

/**
 * Communicates with Gemini using conversation history and the fully constructed prompt
 */
async function getGeminiResponse(history, fullPrompt) {
  // 1. Format history and the fullPrompt constructed in app.js
  const contents = [
    ...history.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    })),
    { role: "user", parts: [{ text: fullPrompt }] }
  ];

  // 2. Perform the REST call
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents })
  });

  const data = await response.json();
  
  if (!data.candidates || !data.candidates[0]) {
    console.error("Gemini API Error:", JSON.stringify(data));
    throw new Error("AI failed to generate a response");
  }

  return data.candidates[0].content.parts[0].text;
}

module.exports = { getGeminiResponse, extractTextFromBuffer };