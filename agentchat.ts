import OpenAI from "openai";
import dotenv from "dotenv";
import readline from "readline";
import fs from "fs";
import path from "path";
import { createTokenLimitSession } from "./modules/tokenLimitSession";
import { createEthLimitSession } from "./modules/tokenEthLimitSession";
import { createTimeLimitSession } from "./modules/timeLimitSession";
import { transferModule } from "./modules/transferModule";
import { isBlacklisted } from "./modules/blacklistModule";
import axios from "axios";

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const ALLOWANCES_FILE = path.join(__dirname, "allowances.json");

function loadAllowances() {
    try {
        if (fs.existsSync(ALLOWANCES_FILE)) {
            return JSON.parse(fs.readFileSync(ALLOWANCES_FILE, "utf8"));
        }
    } catch (error) {
        console.error("Error loading allowances:", error);
    }
    return { token: {}, time: {}, eth: {} };
}

function saveAllowances(allowances) {
    try {
        fs.writeFileSync(ALLOWANCES_FILE, JSON.stringify(allowances, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value, null, 2), { encoding: "utf8", flag: "w" });

        console.log("Allowances saved");
    } catch (error) {
        console.error("Error saving allowances:", error);
    }
}

const allowances = loadAllowances();

function evaluateArithmeticExpressions(jsonString) {
    return jsonString.replace(/(\d+)\s*\*\s*(\d+)/g, (match, num1, num2) => {
        return String(Number(num1) * Number(num2));
    });
}

rl.question("Enter your prompt: ", async (prompt) => {

    try {
        let response = await axios.post('http://localhost:3060/api/generateTask', { prompt }, { headers: { "Content-Type": "application/json" } });

        const openAiResponseString = response.data.openAiResponse;
        const content = openAiResponseString;
        console.log("Raw response:", content);

        let preParsed = evaluateArithmeticExpressions(content);
        console.log("Processed response:", preParsed);

        let finalData = JSON.parse(preParsed);
        for (let i = 0; i < finalData.length; i++) {
            if (finalData[i].token && finalData[i].limit) {
                console.log("Creating token limit session...");
                let tokenAllowance = await createTokenLimitSession(finalData[i].token, finalData[i].limit);
                allowances["token"] = tokenAllowance;
                saveAllowances(allowances);

            } else if (finalData[i].validUntil > 0) {
                console.log("Creating time frame policy...");
                let timeAllowance = await createTimeLimitSession(finalData[i].validUntil);
                allowances["time"] = timeAllowance;
                saveAllowances(allowances);

            } else if (finalData[i].limit) {
                console.log("Creating value limit policy...");
                let ethAllowance = await createEthLimitSession(finalData[i].limit, "0xa564cB165815937967a7d018B7F34B907B52fcFd");
                allowances["eth"] = ethAllowance;
                saveAllowances(allowances);

            } else if (finalData[i].method === "transfer" && finalData[i].eth > 0 && finalData[i].to) {
                console.log("Transferring eth...", finalData[i].eth, "to", finalData[i].to);
                if(isBlacklisted(finalData[i].to)) {
                    console.error("Blacklisted address:", finalData[i].to);
                    continue;
                }
                let ethAllowance = await createEthLimitSession(finalData[i].eth, finalData[i].to);
                allowances["eth"] = ethAllowance;
                saveAllowances(allowances);
                let res = await transferModule(finalData[i].to, finalData[i].eth);
                console.log("Transfer:", res);
            } 
            else {
                console.log("Unknown action:", finalData);
            }
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        rl.close();
    }
});