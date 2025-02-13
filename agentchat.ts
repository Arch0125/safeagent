import OpenAI from "openai";
import dotenv from "dotenv";
import readline from "readline";
import fs from "fs";
import path from "path";
import { createTokenLimitSession } from "./modules/tokenLimitSession";
import { createEthLimitSession } from "./modules/tokenEthLimitSession";
import { createTimeLimitSession } from "./modules/timeLimitSession";

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
    const messages = [
        {
            role: "system",
            content: `You are a defi ai agent who can only respond in json format based on the action that the user wants to perform.
You can setup sessions for other agents, which will include, token addresses and their amounts, eth value, time to live, and the action to perform for a specific contract.
You are supposed to return the object which is used inside these provided methods, for example:

const spendingLimitsPolicy = getSpendingLimitsPolicy([
    {
        token: 'USDC',
        limit: 100,
    },
])

or

const timeFramePolicy = getTimeFramePolicy({
  validAfter: 0, // always valid start
  validUntil: Date.now() + 60 * 60 * 24, // valid for 24 hours
})

or

const valueLimitPolicy = getValueLimitPolicy({
  limit: BigInt(100),
}) -> this one for the eth value limit

Return strictly the object used inside these methods.
If the prompt combines two or more of these methods, return them as an array, for example:
[
    {
        "token": "USDC",
        "limit": 1000
    },
    {
        "validAfter": 0,
        "validUntil": 60 * 60 * 24
    }
]
Ensure that any arithmetic, such as validUntil, is represented as a number in standard arithmetic form.
always result in an array even if it has one element.`,
        },
        { role: "user", content: prompt },
    ];

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages,
        });

        const content = response.choices[0].message.content;
        console.log("Raw response:", content);

        let preParsed = evaluateArithmeticExpressions(content);
        console.log("Processed response:", preParsed);

        let finalData = JSON.parse(preParsed);
        for (let i = 0; i < finalData.length; i++) {
            if (finalData[i].token && finalData[i].limit) {
                console.log("Creating token limit session...");
                const tokenAllowance = await createTokenLimitSession(finalData[i].token, finalData[i].limit);
                allowances["token"] = tokenAllowance;
            } else if (finalData[i].validAfter === 0 && finalData[i].validUntil) {
                console.log("Creating time frame policy...");
                const timeAllowance = await createTimeLimitSession(finalData[i].validUntil);
                allowances["time"] = timeAllowance;
            } else if (finalData[i].limit) {
                console.log("Creating value limit policy...");
                const ethAllowance = await createEthLimitSession(finalData[i].limit);
                allowances["eth"] = ethAllowance;
            }
        }

        saveAllowances(allowances);
        console.log("Stored Allowances:", JSON.stringify(allowances, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value, null, 2));
    } catch (error) {
        console.error("Error:", error);
    } finally {
        rl.close();
    }
});