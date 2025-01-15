import express, { json } from "express";
import cors from "cors"; // Import CORS
import { ChatAnthropic } from "@langchain/anthropic";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import dotenv from "dotenv";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RunnableLambda } from "@langchain/core/runnables";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Middleware to parse JSON requests
app.use(json());

// Initialize Chroma client with OpenAI embeddings
const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
const vectorStore = await Chroma.fromExistingCollection(embeddings, {
  collectionName: "quran-collection", // Ensure your Chroma instance has this collection
});

const retriever = vectorStore.asRetriever({ topK: Infinity }); // Retrieve top 3 results

// Set up Claude (Anthropic) LLM
const llm = new ChatAnthropic({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-5-sonnet-20241022",
});

// Define a RunnableLambda for the retriever
const retrieverRunnable = new RunnableLambda({
  func: async (input) => {
    const results = await retriever.getRelevantDocuments(input.query);
    return { documents: results, query: input.query, chat_history: input.chat_history}; // Ensure it returns an object matching the expected schema
  },
});

const llmRunnable = new RunnableLambda({
  func: async (input) => {
    console.log("Input to LLM:", input); // Debugging

    // If history is empty, prepend the context for the first query
    const isFirstQuestion = input.chat_history.length === 0;
    let questionWithContext;

    if (isFirstQuestion) {
      questionWithContext = `You are answering a question about the Quran. Please provide an insightful and context-aware response.\n\nUser: ${input.query}\nAssistant:`;
    } else {
      // Format the chat history for subsequent questions
      const formattedHistory = input.chat_history
        .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
        .join("\n");

      questionWithContext = `${formattedHistory}\n\nUser: ${input.query}\nAssistant:`;
    }

    const response = await llm.invoke(questionWithContext);
    return response; // Return the trimmed response
  },
});


// Define a query-answering chain
const qaChain = retrieverRunnable.pipe(llmRunnable); // Pipe the output of retriever to the LLM

let chatHistory = {}; // Store chat history for each session

app.post("/ask", async (req, res) => {
  try {
    const { sessionId, question } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required." });
    }

    if (!question) {
      return res.status(400).json({ error: "Question is required." });
    }

    // Initialize chat history for the session if not present
    if (!chatHistory[sessionId]) {
      chatHistory[sessionId] = [];
    }

    // Add the user's question to the chat history
    chatHistory[sessionId].push({ role: "user", content: question });
    console.log('batman', chatHistory);
    
    // Use the chain to process the user's question
    const response = await qaChain.invoke({
      query: question,
      chat_history: chatHistory[sessionId],
    });

    // Save the assistant's response to the chat history
    chatHistory[sessionId].push({ role: "assistant", content: response.content });

    return res.json(response);
  } catch (error) {
    console.error("Error processing the query:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
