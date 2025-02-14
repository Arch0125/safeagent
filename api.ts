import axios from "axios";

async function sendPrompt() {
  const apiUrl = "http://localhost:3060/api/generateTask";
  const prompt = "set eth limit to 1";

  try {
    const response = await axios.post(
      apiUrl,
      { prompt },
      { headers: { "Content-Type": "application/json" } }
    );

    // Get the response string (which contains JSON)
    const openAiResponseString = response.data.openAiResponse;

    // Parse the JSON string to an object
    const parsedResponse = JSON.parse(openAiResponseString);

    // Pretty-print the parsed JSON object with 2-space indentation
    const prettyPrinted = JSON.stringify(parsedResponse, null, 2);
    
    console.log("Formatted JSON response:\n", parsedResponse[0].limit);
  } catch (error: any) {
    if (error.response) {
      console.error("Error response:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Error:", error.message);
    }
  }
}

sendPrompt();
