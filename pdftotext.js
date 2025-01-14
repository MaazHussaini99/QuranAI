// const { PDFDocument } = require("pdf-lib");
// const fs = require("fs");

// async function extractTwoColumnText(pdfPath) {
//   const pdfBytes = fs.readFileSync(pdfPath);
//   const pdfDoc = await PDFDocument.load(pdfBytes);
//   const allText = [];

//   for (let i = 0; i < pdfDoc.getPageCount(); i++) {
//     const page = pdfDoc.getPage(i);
//     const { width, height } = page.getSize();

//     // Extract left and right columns
//     const leftColumn = await page.getTextContent({
//       bounds: { x: 0, y: 0, width: width / 2, height },
//     });
//     const rightColumn = await page.getTextContent({
//       bounds: { x: width / 2, y: 0, width: width / 2, height },
//     });

//     const pageText = [
//       leftColumn.items.map((item) => item.str).join(" "),
//       rightColumn.items.map((item) => item.str).join(" "),
//     ].join("\n");

//     allText.push(pageText);
//   }

//   return allText.join("\n\n");
// }

// // Save Quran text to file
// extractTwoColumnText("./quran.pdf").then((text) => {
//   fs.writeFileSync("quran-text.txt", text);
//   console.log("Quran text extracted and saved!");
// });
// const fs = require("fs");
// const pdfParse = require("pdf-parse");

// async function extractTwoColumnText(pdfPath) {
//   const pdfBytes = fs.readFileSync(pdfPath);
//   const data = await pdfParse(pdfBytes);

//   const allText = [];
  
//   const pageText = data.text; // Extract all text from the PDF
//   const pages = pageText.split("\n\n"); // Assuming each page is separated by two line breaks

//   // Split the text of each page into two columns
//   pages.forEach((page) => {
//     const half = Math.ceil(page.length / 2);
//     const leftColumn = page.slice(0, half).trim();
//     const rightColumn = page.slice(half).trim();
    
//     allText.push([leftColumn, rightColumn].join("\n"));
//   });

//   return allText.join("\n\n");
// }

// // Save Quran text to file
// extractTwoColumnText("./quran.pdf").then((text) => {
//   fs.writeFileSync("quran-text.txt", text);
//   console.log("Quran text extracted and saved!");
// });
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fs = require("fs");
const pdfParse = require("pdf-parse");

// Function to sanitize text by removing invalid characters
function sanitizeText(text) {
  return text.replace(/[\x00-\x1F\x7F-\x9F]/g, ""); // Removes non-printable characters
}

async function extractTwoColumnText(pdfPath) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const data = await pdfParse(pdfBytes);

  const allText = [];
  
  const pageText = data.text; // Extract all text from the PDF
  const pages = pageText.split("\n\n"); // Assuming each page is separated by two line breaks

  // Split the text of each page into two columns
  pages.forEach((page) => {
    // Combine the left and right columns into one column by concatenating them
    const columns = page.split('\n');
    const combined = columns.join(' '); // Combine into a single column
    allText.push(sanitizeText(combined)); // Sanitize and add to final text
  });

  return allText.join("\n\n");
}

async function createNewPDFWithText(extractedText) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]); // A standard 8.5x11 inch page (in points)

  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica); // Use the default Helvetica font
  
  const fontSize = 12;
  const margin = 50;
  const lineHeight = fontSize * 1.5;
  let currentY = height - margin;

  const lines = extractedText.split("\n");

  // Loop through each line and add it to the page
  lines.forEach((line) => {
    if (currentY - lineHeight < margin) {
      // Add a new page if we don't have enough space left
      const newPage = pdfDoc.addPage([width, height]);
      currentY = newPage.getSize().height - margin; // Reset Y coordinate for the new page
    }

    // Draw text for the single column
    page.drawText(line, {
      x: margin,
      y: currentY,
      font,
      size: fontSize,
      color: rgb(0, 0, 0), // Black color for text
    });

    // Update Y coordinate for the next line
    currentY -= lineHeight;
  });

  // Serialize the PDF to bytes and save to a file
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync("modified-quran.pdf", pdfBytes);
  console.log("New PDF created: modified-quran.pdf");
}

// Process: Extract text and then create the PDF
extractTwoColumnText("./quran.pdf").then((extractedText) => {
  createNewPDFWithText(extractedText);
});
