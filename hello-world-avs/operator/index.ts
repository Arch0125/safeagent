import { ethers } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import express from "express";
import axios from "axios";
import https from "https";
import tls from "tls";

dotenv.config();

// Ensure environment variables are loaded
if (!Object.keys(process.env).length) {
  throw new Error("process.env object is empty");
}

// ------------------------
// SETUP: ETHEREUM & CONTRACTS
// ------------------------

// Setup provider and wallet.
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// (Hardcoded chainId for now)
const chainId = 84532;

// Load deployment data.
const avsDeploymentData = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, `../contracts/deployments/hello-world/${chainId}.json`),
    "utf8"
  )
);
const coreDeploymentData = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, `../contracts/deployments/core/${chainId}.json`),
    "utf8"
  )
);

const delegationManagerAddress = coreDeploymentData.addresses.delegation;
const avsDirectoryAddress = coreDeploymentData.addresses.avsDirectory;
const helloWorldServiceManagerAddress = avsDeploymentData.addresses.helloWorldServiceManager;
const ecdsaStakeRegistryAddress = avsDeploymentData.addresses.stakeRegistry;

// Load ABIs.
const delegationManagerABI = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../abis/IDelegationManager.json"), "utf8")
);
const ecdsaRegistryABI = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../abis/ECDSAStakeRegistry.json"), "utf8")
);
const helloWorldServiceManagerABI = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../abis/HelloWorldServiceManager.json"), "utf8")
);
const avsDirectoryABI = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../abis/IAVSDirectory.json"), "utf8")
);

// Initialize contract objects.
const delegationManager = new ethers.Contract(delegationManagerAddress, delegationManagerABI, wallet);
const helloWorldServiceManager = new ethers.Contract(helloWorldServiceManagerAddress, helloWorldServiceManagerABI, wallet);
const ecdsaRegistryContract = new ethers.Contract(ecdsaStakeRegistryAddress, ecdsaRegistryABI, wallet);
const avsDirectory = new ethers.Contract(avsDirectoryAddress, avsDirectoryABI, wallet);


const signAndRespondToTask = async (taskIndex: number, taskCreatedBlock: number, taskName: string) => {
    const message = `Hello, ${taskName}`;
    const messageHash = ethers.solidityPackedKeccak256(["string"], [message]);
    const messageBytes = ethers.getBytes(messageHash);
    const signature = await wallet.signMessage(messageBytes);

    console.log(`Signing and responding to task ${taskIndex}`);

    const operators = [await wallet.getAddress()];
    const signatures = [signature];
    const signedTask = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "bytes[]", "uint32"],
        [operators, signatures, ethers.toBigInt(await provider.getBlockNumber()-1)]
    );

    const tx = await helloWorldServiceManager.respondToTask(
        { name: taskName, taskCreatedBlock: taskCreatedBlock },
        taskIndex,
        signedTask
    );
    await tx.wait();
    console.log(`Responded to task.`);
};

const registerOperator = async () => {
  try {
    const tx1 = await delegationManager.registerAsOperator(
      {
        __deprecated_earningsReceiver: await wallet.getAddress(),
        delegationApprover: "0x0000000000000000000000000000000000000000",
        stakerOptOutWindowBlocks: 0,
      },
      ""
    );
    await tx1.wait();
    console.log("Operator registered to Core EigenLayer contracts");
  } catch (error) {
    console.error("Error registering as operator:", error);
  }
};

// ------------------------
// SETUP: EXPRESS API + OPENAI CALL
// ------------------------

const app = express();
app.use(express.json());

// Create a custom HTTPS agent for OpenAI with certificate pinning.
const openAiHttpsAgent = new https.Agent({
  keepAlive: false, // Force a new connection (and handshake) on each request.
  rejectUnauthorized: true,
  checkServerIdentity: (host, cert) => {
    console.log("Entered checkServerIdentity for host:", host);
    // Perform default hostname verification.
    const err = tls.checkServerIdentity(host, cert);
    if (err) {
      console.error("Default validation error:", err);
      return err;
    }
    // Log certificate details.
    console.log("OpenAI Certificate Subject:", cert.subject);
    console.log("OpenAI Certificate Fingerprint:", cert.fingerprint);
    // Replace with the known fingerprint from OpenAI's certificate.
    const expectedFingerprint = "A5:24:53:ED:DD:73:D0:F8:C3:53:F6:DB:77:B1:32:43:9B:D3:78:6E";
    if (cert.fingerprint !== expectedFingerprint) {
      return new Error("OpenAI certificate fingerprint does not match!");
    }
    return undefined;
  },
});

// POST /api/generateTask endpoint:
//   - Accepts a JSON body with a "prompt" field.
//   - Forwards the prompt to OpenAI.
//   - Computes the hash of the concatenated prompt and OpenAI response.
//   - Calls createNewTask on your contract with that hash.
app.post("/api/generateTask", async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Missing prompt" });
      return;
    }

    console.log("Received prompt:", prompt);

    // Call OpenAI API.
    const openAiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo", // Adjust the model as needed.
        messages: [
            {
                role: "developer",
                content: "You are a helpful assistant."
            },
            {
                role: "user",
                content: "Write a haiku about recursion in programming."
            }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        httpsAgent: openAiHttpsAgent,
      }
    );

    // Assume OpenAI response structure: { choices: [ { text: "..." } ], ... }
    const openAiText = openAiResponse.data.choices[0].message.content.trim();
    console.log("OpenAI response:", openAiText);

    // Compute hash of the prompt concatenated with OpenAI response.
    const combinedMessage = prompt + openAiText;
    const hash = ethers.keccak256(ethers.toUtf8Bytes(combinedMessage));
    console.log("Computed hash (prompt + response):", hash);

    // Call createNewTask on your contract with the computed hash.
    // (Make sure the contract function accepts the parameter type you pass.)
    const tx = await helloWorldServiceManager.createNewTask(hash);
    await tx.wait();
    console.log("createNewTask called with hash:", hash);

    res.json({ success: true, hash: hash, openAiResponse: openAiText });
    return;
  } catch (error) {
    console.error("Error in /api/generateTask:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    return;
  }
});

// Start Express server.
const PORT = process.env.PORT || 3060;
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

// Optionally, run other startup tasks.
const main = async () => {
 
    helloWorldServiceManager.on("NewTaskCreated", async (taskIndex: number, task: any) => {
        console.log(`New task detected: Hello, ${task.name}`);
        await signAndRespondToTask(taskIndex, task.taskCreatedBlock, task.name);
    });

    console.log("Monitoring for new tasks...");
  // You may want to continue with monitoring tasks or other operations.
};

main().catch((error) => {
  console.error("Error in main function:", error);
});
