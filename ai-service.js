const pdf = require('pdf-parse');

// Ensure you use a secure environment variable for your key
const API_KEY = process.env.GEMINI_API_KEY; 
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;

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
 * Communicates with Gemini using conversation history and document context
 */
async function getGeminiResponse(history, prompt, contextContent = "") {
  // 1. Prepare the prompt with the extracted content context
  const fullPrompt = contextContent 
    ? `Context from course materials:\n${contextContent.substring(0, 4000)}\n\nUser Question: ${prompt}`
    : prompt;

  // 2. Format history and current prompt
  const contents = [
    ...history.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    })),
    { role: "user", parts: [{ text: fullPrompt }] }
  ];

  // 3. Perform the REST call
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