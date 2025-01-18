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

    const { documents, query, chat_history } = input;

    // If history is empty, prepend the context for the first query
    const isFirstQuestion = chat_history.length === 0;

    // Format retrieved documents
    const formattedDocuments = documents
      .map((doc, index) => `Document ${index + 1}:\n${doc.pageContent}`)
      .join("\n\n");

    let questionWithContext;

    if (isFirstQuestion) {
      questionWithContext = `You are an expert in the Quran. Use the following context to answer the user's question:\n\n${formattedDocuments}\n\nUser: ${query}\nAssistant:`;
    } else {
      // Format the chat history for subsequent questions
      const formattedHistory = chat_history
        .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
        .join("\n");

      questionWithContext = `${formattedHistory}\n\nContext:\n${formattedDocuments}\n\nUser: ${query}\nAssistant:`;
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


    
    
    // Use the chain to process the user's question
    const response = await qaChain.invoke({
      query: question,
      chat_history: chatHistory[sessionId],
    });

        // Add the user's question to the chat history
        chatHistory[sessionId].push({ role: "user", content: question });

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
