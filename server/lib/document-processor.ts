import fs from "fs";
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import ExcelJS from "exceljs";
import { promisify } from "util";

/**
 * Extracts text from a PDF file
 * @param filePath Path to the PDF file
 * @returns Extracted text with page references
 */
export async function extractTextFromPDF(filePath: string): Promise<string[]> {
  try {
    console.log(`Starting PDF extraction for: ${path.basename(filePath)}`);
    
    const loader = new PDFLoader(filePath, {
      splitPages: true,
    });
    
    console.log(`PDF loader created, beginning load operation...`);
    const docs = await loader.load();
    console.log(`PDF loaded successfully. Number of pages: ${docs.length}`);
    
    if (docs.length === 0) {
      console.warn(`PDF loaded but no pages extracted: ${path.basename(filePath)}`);
      return [`[PDF Document] No content could be extracted from this PDF.`];
    }
    
    // Map to pages with references
    const result = docs.map((doc, index) => {
      const content = doc.pageContent || '';
      if (content.trim().length === 0) {
        console.warn(`Empty content on page ${index + 1} of PDF: ${path.basename(filePath)}`);
        return `[PDF Page ${index + 1}] (No text content on this page)`;
      }
      return `[PDF Page ${index + 1}] ${content}`;
    });
    
    console.log(`PDF processing complete. Extracted ${result.length} pages from ${path.basename(filePath)}`);
    return result;
  } catch (error) {
    console.error(`Error extracting text from PDF ${path.basename(filePath)}:`, error);
    return [`Error processing PDF: ${path.basename(filePath)}`];
  }
}

/**
 * Extracts data from an Excel file
 * @param filePath Path to the Excel file
 * @returns Extracted text with cell references
 */
export async function extractDataFromExcel(filePath: string): Promise<string[]> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const sheets: string[] = [];
    
    workbook.eachSheet((worksheet, sheetId) => {
      const sheetName = worksheet.name;
      const rows: string[] = [];
      
      worksheet.eachRow((row, rowNumber) => {
        const cells: string[] = [];
        
        row.eachCell((cell, colNumber) => {
          const colLetter = String.fromCharCode(64 + colNumber);
          const cellRef = `${colLetter}${rowNumber}`;
          cells.push(`${cellRef}: ${cell.text}`);
        });
        
        if (cells.length > 0) {
          rows.push(cells.join(" | "));
        }
      });
      
      if (rows.length > 0) {
        sheets.push(`[Excel Sheet: ${sheetName}]\n${rows.join("\n")}`);
      }
    });
    
    return sheets;
  } catch (error) {
    console.error("Error extracting data from Excel:", error);
    return [`Error processing Excel file: ${path.basename(filePath)}`];
  }
}

/**
 * Extracts text from a plain text file
 * @param filePath Path to the text file
 * @returns Extracted text with line numbers for longer files
 */
export async function extractTextFromTXT(filePath: string): Promise<string[]> {
  try {
    const readFile = promisify(fs.readFile);
    const content = await readFile(filePath, 'utf8');
    
    // Split the content by lines
    const lines = content.split(/\r?\n/);
    
    // For small text files, just return the whole content as one chunk
    if (lines.length <= 10) {
      return [`[Text File] ${content}`];
    }
    
    // For larger text files, add line numbers and break into sections
    const result: string[] = [];
    const sectionSize = 50; // Number of lines per section
    
    for (let i = 0; i < lines.length; i += sectionSize) {
      const section = lines.slice(i, i + sectionSize);
      const sectionText = section.map((line, idx) => 
        `Line ${i + idx + 1}: ${line}`
      ).join('\n');
      
      result.push(`[Text File Section ${Math.floor(i / sectionSize) + 1}]\n${sectionText}`);
    }
    
    return result;
  } catch (error) {
    console.error("Error extracting text from TXT file:", error);
    return [`Error processing text file: ${path.basename(filePath)}`];
  }
}

/**
 * Processes uploaded documents based on file type
 * @param filePath Path to the document
 * @param fileType Type of the document (pdf, excel)
 * @returns Processed text content
 */
export async function processDocument(filePath: string, fileType: string): Promise<string[]> {
  try {
    console.log(`Beginning document processing: ${path.basename(filePath)}, type: ${fileType}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Document file not found: ${filePath}`);
      throw new Error(`File not found: ${filePath}`);
    }
    
    console.log(`File exists at path: ${filePath}`);
    
    // Process based on file type
    let result: string[] = [];
    
    if (fileType === "application/pdf") {
      console.log(`Processing PDF document: ${path.basename(filePath)}`);
      result = await extractTextFromPDF(filePath);
    } else if (
      fileType === "application/vnd.ms-excel" ||
      fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      console.log(`Processing Excel document: ${path.basename(filePath)}`);
      result = await extractDataFromExcel(filePath);
    } else if (
      fileType === "text/plain" ||
      filePath.toLowerCase().endsWith('.txt')
    ) {
      console.log(`Processing text document: ${path.basename(filePath)}`);
      result = await extractTextFromTXT(filePath);
    } else {
      console.error(`Unsupported file type: ${fileType} for file: ${path.basename(filePath)}`);
      throw new Error(`Unsupported file type: ${fileType}`);
    }
    
    console.log(`Successfully processed document: ${path.basename(filePath)}, extracted ${result.length} content chunks`);
    return result;
  } catch (error) {
    console.error(`Error processing document ${path.basename(filePath)}:`, error);
    return [`Error processing document: ${path.basename(filePath)}`];
  }
}
