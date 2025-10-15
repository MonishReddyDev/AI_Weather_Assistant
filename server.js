import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

const OpenAI_Client = new OpenAI({ apiKey: OPENAI_API_KEY });

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));


// ----------------- Tools -----------------
async function getWeather(city = "") {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.cod !== 200) return "Weather data not available for this city.";
        return `${data.main.temp}°C, ${data.weather[0].description}`;
    } catch (error) {
        console.log(error.message);
        return "Weather data not available for this city.";
    }
}

const tools = { getWeather };

// ----------------- System Prompt -----------------
const SYSTEM_PROMPT = `
You are a helpful AI assistant that can use tools to answer user questions.

Your reasoning structure follows:
START → PLAN → ACTION → OBSERVATION → OUTPUT

Available Tool:
- getWeather(city: string): returns weather info.

Important:
- After every "action", you MUST wait for the observation from the tool before producing output.
- Do NOT combine action results directly into output.
- PLAN: Describe what tool you will use and why.
- ACTION: Call the tool (do not include its result here).
- OBSERVATION: Show the result returned from the tool.
- OUTPUT: Produce the final answer to the user using observation only.
- JSON must be valid. Do not add explanations or text outside the JSON object.
- Output only JSON, never plain text.

Always respond in this JSON format:
{
  "type": "plan" | "action" | "observation" | "output",
  "function"?: string,
  "input"?: string,
  "observation"?: string,
  "output"?: string,
  "plan"?: string
}
`;

// ----------------- API Endpoint -----------------
app.get("/ask", async (req, res) => {
    const userQuestion = req.query.question;
    if (!userQuestion) return res.status(400).json({ error: "Question is required" });

    const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userQuestion }
    ];

    let finished = false;
    let lastResponse;

    while (!finished) {
        try {
            const chat = await OpenAI_Client.chat.completions.create({
                model: "gpt-4o-mini",
                messages,
                response_format: { type: "json_object" }
            });

            const response = JSON.parse(chat.choices[0].message.content);
            messages.push({ role: "assistant", content: JSON.stringify(response) });
            lastResponse = response;

            switch (response.type) {
                case "plan":
                    console.log("AI PLAN:", response.plan);
                    break;

                case "action":
                    const fn = tools[response.function];
                    if (!fn) {
                        finished = true;
                        lastResponse = { output: `Unknown function: ${response.function}` };
                        break;
                    }
                    const observation = await fn(response.input);
                    const obsMsg = { type: "observation", observation };
                    messages.push({ role: "developer", content: JSON.stringify(obsMsg) });
                    break;

                case "observation":
                    console.log("AI OBSERVATION:", response.observation);
                    break;

                case "output":
                    finished = true;
                    break;

                default:
                    finished = true;
            }
        } catch (err) {
            console.log(err.message);
            return res.status(500).json({ error: "AI processing failed" });
        }
    }

    res.json({ answer: lastResponse.output });
});

// ----------------- Start Server -----------------
app.listen(PORT, () => {
    console.log(`AI backend running on http://localhost:${PORT}`);
});
