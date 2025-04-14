import fs from "fs";
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import * as ExcelJS from "exceljs";
import { promisify } from "util";

/**
 * Extracts text from a PDF file
 * @param filePath Path to the PDF file
 * @returns Extracted text with page references
 */
export async function extractTextFromPDF(filePath: string): Promise<string[]> {
  try {
    const loader = new PDFLoader(filePath, {
      splitPages: true,
    });
    
    const docs = await loader.load();
    
    return docs.map((doc, index) => {
      return `[PDF Page ${index + 1}] ${doc.pageContent}`;
    });
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
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
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Process based on file type
    if (fileType === "application/pdf") {
      return extractTextFromPDF(filePath);
    } else if (
      fileType === "application/vnd.ms-excel" ||
      fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      return extractDataFromExcel(filePath);
    } else if (
      fileType === "text/plain" ||
      filePath.toLowerCase().endsWith('.txt')
    ) {
      return extractTextFromTXT(filePath);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error("Error processing document:", error);
    return [`Error processing document: ${path.basename(filePath)}`];
  }
}
