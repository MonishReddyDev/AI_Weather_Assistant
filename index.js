import OpenAI from "openai";
import readlineSync from 'readline-sync';
import dotenv from 'dotenv';
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

const OpenAI_Client = new OpenAI({
    apiKey: OPENAI_API_KEY,
})



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






// ✅ Tools available to the AI
const tools = {
    getWeather
};




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

Example:
{"type":"plan","plan":"I will get the weather for Delhi"}
{"type":"action","function":"getWeather","input":"Delhi"}
{"type":"observation","observation":"25°C, Clear and Sunny"}
{"type":"output","output":"The weather in Delhi is 25°C and clear."}

`;

const messages = [{ role: "system", content: SYSTEM_PROMPT }];


while (true) {
    const userInput = readlineSync.question("You: ")
    messages.push({ role: 'user', content: userInput })


    let finished = false

    while (!finished) {
        const chat = await OpenAI_Client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            response_format: { type: "json_object" }
        })


        const response = JSON.parse(chat.choices[0].message.content)
        console.log(response)
        messages.push({ role: 'assistant', content: JSON.stringify(response) })


        switch (response.type) {
            case 'plan':
                console.log("AI PLAN:", response.plan);
                break;

            case 'action':
                const fn = tools[response.function];
                if (!fn) {
                    console.log("Unknown function:", response.function);
                    finished = true;
                    break;
                }
                const observation = await fn(response.input);
                const obsMsg = { type: "observation", observation };
                messages.push({ role: "developer", content: JSON.stringify(obsMsg) });
                break;

            case 'observation':
                // AI might echo back an observation; just log it
                console.log("AI OBSERVATION:", response.observation);
                break;

            case 'output':
                console.log("Assistant:", response.output);
                finished = true;
                break;

            default:
                console.log("Unknown response type:", response.type);
                finished = true;
        }

        // switch (response.type) {
        //     case 'output':
        //         console.log("Assistant:", response.output);
        //         finished = true;
        //         break;
        //     case 'action':
        //         const fn = tools[response.function];
        //         if (!fn) {
        //             console.log("Unknown function:", response.function);
        //             finished = true;
        //             break;
        //         }
        //         const observation = await fn(response.input);
        //         const obsMsg = { type: "observation", observation };
        //         messages.push({ role: "developer", content: JSON.stringify(obsMsg) });
        //         break;

        // }



    }
}


// You: What's the weather in Delhi?
// Assistant (internally):
//   PLAN → “I will call getWeatherDetails for Delhi”
//   ACTION → calls getWeatherDetails(Delhi)
//   OBSERVATION → "25°C, Clear and Sunny"
//   OUTPUT → “The weather in Delhi is 25°C and clear.”