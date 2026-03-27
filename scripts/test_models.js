const { GoogleGenerativeAI } = require("@google/generative-ai");

async function list() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No key provided");
        return;
    }
    try {
        const genAI = new GoogleGenerativeAI(key);
        // The SDK doesn't have a direct 'listModels' helper usually, 
        // but we can try to fetch a known model or use a raw fetch.
        // Actually, let's just try 'gemini-1.5-flash' with 'v1' explicitly if possible.
        // But the SDK doesn't expose version easily.
        
        console.log("Testing gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("test");
        console.log("Success with gemini-1.5-flash:", result.response.text());
    } catch (err) {
        console.error("Error with gemini-1.5-flash:", err.message);
        try {
            console.log("Testing gemini-1.5-flash-8b...");
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
            const result = await model.generateContent("test");
            console.log("Success with gemini-1.5-flash-8b:", result.response.text());
        } catch (err2) {
            console.error("Error with gemini-1.5-flash-8b:", err2.message);
        }
    }
}

list();
