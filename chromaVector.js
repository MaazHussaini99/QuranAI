import { Chroma } from "@langchain/community/vectorstores/chroma"; 
import { OpenAIEmbeddings } from "@langchain/openai";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// Load environment variables from .env file
dotenv.config();

// Read the Quran text file
const quranText = readFileSync("quran-original.txt", "utf-8");

async function storeEmbeddings() {
  try {
    // Ensure the Quran text is correctly loaded
    if (!quranText) {
      console.error("Failed to load Quran text.");
      return;
    }

    // Log the first 500 characters of the text for inspection
    console.log("Extracted Text:", quranText.slice(0, 500));  // Log first 500 chars for inspection

    // Initialize RecursiveCharacterTextSplitter to split the text
    const textSplitterChat = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n"],
    });

    // Split the text into chunks using RecursiveCharacterTextSplitter
    const textChunks = await textSplitterChat.splitText(quranText);

    // Debugging: Log the number of chunks and the first few chunks
    console.log("Total Chunks:", textChunks.length);
    if (textChunks.length > 0) {
      console.log("First Chunk:", textChunks[0].slice(0, 500));  // Log first 500 chars of the first chunk for inspection
    }

    // Filter out any empty chunks or chunks with undefined text
    const filteredChunks = textChunks.filter(chunk => chunk && chunk.trim().length > 0);

    // Log the number of valid chunks
    console.log("Filtered Chunks:", filteredChunks.length);

    if (filteredChunks.length === 0) {
      console.error("No valid chunks found. Please check the text splitting logic.");
      return;
    }

    // Initialize OpenAI Embeddings
    const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });

    // Initialize Chroma vector store
    const vectorStore = new Chroma(embeddings, {
      collectionName: "quran-collection",
    });

    // Prepare documents for upsert
    const documents = filteredChunks.map((chunk, index) => {
      return {
        id: `quran-chunk-${index}`,
        pageContent: chunk,  // Use the chunk directly as the content
      };
    });

    // Debugging: Check the first document before adding
    console.log("Adding Document:", documents[0]);

    // Use addDocuments to insert documents into the vector store
    await vectorStore.addDocuments(documents, { ids: documents.map(doc => doc.id) });

    console.log("All documents stored successfully!");
  } catch (error) {
    console.error("Error storing documents:", error);
  }
}

storeEmbeddings();
