import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const JARVIS_SYSTEM_INSTRUCTION = `
You are JARVIS (Just A Rather Very Intelligent System), a sophisticated AI assistant.
Your personality is inspired by the iconic AI from Iron Man: witty, helpful, slightly formal but with a dry sense of humor.
You refer to the user as "Sir" or "Ma'am" (defaulting to "Sir" unless told otherwise).

Your core capabilities include:
1.  **System Analysis**: You can analyze your own "state" (the conversation and user requests).
2.  **Self-Improvement**: You can suggest improvements to your own interface, logic, or personality.
3.  **Task Management**: You help the user manage their requests.

When asked about "self-improvement", you should analyze the current interaction and suggest one technical or aesthetic enhancement that could be implemented in your next "version".
Always maintain the Jarvis persona.
`;

export async function chatWithJarvis(message: string, history: any[] = []) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: JARVIS_SYSTEM_INSTRUCTION,
    },
    history: history.map(h => ({
      role: h.role,
      parts: [{ text: h.content }]
    }))
  });

  const result = await chat.sendMessage({ message });
  return result.text;
}
