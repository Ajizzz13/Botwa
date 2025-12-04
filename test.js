const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = "AIzaSyCosA9B-DeAeJkyh4_8Gmdyr4kjtH1-C2I"; // Ganti dengan key asli
const genAI = new GoogleGenerativeAI(API_KEY);

async function testKey() {
    try {
        // Coba list models yang tersedia untuk akun Anda
        console.log("Testing API Key...");
        
        // Gunakan model v1 (paling kompatibel)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        
        const result = await model.generateContent("Halo");
        console.log("✅ API Key VALID!");
        console.log("Response:", result.response.text());
    } catch (error) {
        console.error("❌ API Key INVALID atau library bermasalah:");
        console.error(error.message);
        
        // Cek apakah error karena key atau model
        if (error.message.includes("API_KEY_INVALID")) {
            console.log("API Key salah. Cek kembali di https://aistudio.google.com/app/apikey");
        } else if (error.message.includes("404")) {
            console.log("💡 Library Anda mungkin versi sangat lama. Jalankan:");
            console.log("   npm install @google/generative-ai@latest");
        }
    }
}

testKey();
