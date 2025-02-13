import OpenAI from "openai";
import dotenv from "dotenv";
import readline from "readline";
import { createTokenLimitSession } from "./modules/tokenLimitSsession";

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Simple function to replace multiplication expressions with computed values
function evaluateArithmeticExpressions(jsonString: string): string {
    // This regex looks for sequences like "number * number"
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

        // Preprocess the content by converting multiplication expressions into numbers
        let preParsed = evaluateArithmeticExpressions(content);
        console.log("Processed response:", preParsed);

        let finalData = JSON.parse(preParsed)
        for(let i = 0; i < finalData.length; i++) {
            if(finalData[i].token && finalData[i].limit) {
                await createTokenLimitSession(finalData[i].token, finalData[i].limit);
            }
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        rl.close();
    }
});