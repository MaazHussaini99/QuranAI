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

const retriever = vectorStore.asRetriever({ topK: 3 }); // Retrieve top 3 results

// Set up Claude (Anthropic) LLM
const llm = new ChatAnthropic({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-5-sonnet-20241022",
});

// Define a RunnableLambda for the retriever
const retrieverRunnable = new RunnableLambda({
  func: async (input) => {
    const results = await retriever.getRelevantDocuments(input.query);
    return { documents: results, query: input.query }; // Ensure it returns an object matching the expected schema
  },
});

const llmRunnable = new RunnableLambda({
  func: async (input) => {
    console.log("Input to LLM:", input); // Debugging

    // Prepend context about the Quran before the user query
    const questionWithContext = `You are answering a question about the Quran. Please provide an insightful and context-aware response. Question: ${input.query}`;

    const response = await llm.invoke(questionWithContext + "\n\n" + input.documents.map((doc) => doc.pageContent).join("\n\n"));

    // console.log("LLM Response:", response); // Debugging
    return response ; // Use the `completion` property of the response
  },
});

// Define a query-answering chain
const qaChain = retrieverRunnable.pipe(llmRunnable); // Pipe the output of retriever to the LLM

// Define the route to handle user queries
app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    // Use the chain to process the user's question
    const response = await qaChain.invoke({ query: question });
    console.log(response);
    
    return res.json(response );
  } catch (error) {
    console.error("Error processing the query:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
