const pdf = require('pdf-parse');

const API_KEY = process.env.GEMINI_API_KEY;

// List of models to try in order of preference (Failover chain)
const MODEL_PRIORITY = ['gemini-3.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'];

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
 * Communicates with Gemini with built-in retry and failover logic
 */
async function getGeminiResponse(history, fullPrompt, modelIndex = 0, attempt = 1) {
  const MAX_RETRIES = 3;
  const currentModel = MODEL_PRIORITY[modelIndex];
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${API_KEY}`;

  const contents = [
    ...history.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    })),
    { role: "user", parts: [{ text: fullPrompt }] }
  ];

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents })
    });

    // If 503 (Overloaded), wait and retry with current model
    if (response.status === 503 && attempt <= MAX_RETRIES) {
      const waitTime = Math.pow(2, attempt) * 1000;
      console.warn(`Model ${currentModel} overloaded. Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return getGeminiResponse(history, fullPrompt, modelIndex, attempt + 1);
    }

    const data = await response.json();
    
    // If other errors occur, try the next model in the list
    if (!data.candidates || !data.candidates[0]) {
      throw new Error(data.error?.message || "AI failed to generate a response");
    }

    return data.candidates[0].content.parts[0].text;

  } catch (error) {
    console.error(`Error with model ${currentModel}:`, error.message);
    
    // Failover: If we have more models to try, move to next model
    if (modelIndex + 1 < MODEL_PRIORITY.length) {
      console.log(`Failing over to model: ${MODEL_PRIORITY[modelIndex + 1]}`);
      return getGeminiResponse(history, fullPrompt, modelIndex + 1, 1);
    }
    
    throw new Error("AI failed to generate a response after trying all models.");
  }
}

module.exports = { getGeminiResponse, extractTextFromBuffer };