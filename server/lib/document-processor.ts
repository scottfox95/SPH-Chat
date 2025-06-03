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
    console.log(`Starting Excel extraction for: ${path.basename(filePath)}`);
    
    const workbook = new ExcelJS.Workbook();
    console.log(`Excel workbook created, beginning file read...`);
    
    // Read the Excel file
    await workbook.xlsx.readFile(filePath);
    console.log(`Excel file loaded successfully`);
    
    // Count the total sheets to see if we need to handle empty ones differently
    const totalSheets = workbook.worksheets.length;
    console.log(`Excel file contains ${totalSheets} sheets`);
    
    if (totalSheets === 0) {
      console.warn(`Excel file has no sheets: ${path.basename(filePath)}`);
      return [`[Excel Document] No sheets found in this Excel file.`];
    }
    
    const sheets: string[] = [];
    let emptySheetsCount = 0;
    let processedSheetsCount = 0;
    
    workbook.eachSheet((worksheet, sheetId) => {
      processedSheetsCount++;
      const sheetName = worksheet.name;
      console.log(`Processing Excel sheet: "${sheetName}" (${sheetId})`);
      
      // Count rows in the sheet
      const rowCount = worksheet.rowCount;
      const columnCount = worksheet.columnCount;
      console.log(`Sheet dimensions: ${rowCount} rows, ${columnCount} columns`);
      
      if (rowCount === 0 || columnCount === 0) {
        console.warn(`Empty sheet found: "${sheetName}" - no content to extract`);
        emptySheetsCount++;
        return;
      }
      
      const rows: string[] = [];
      let cellsProcessed = 0;
      
      worksheet.eachRow((row, rowNumber) => {
        const cells: string[] = [];
        
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          cellsProcessed++;
          const colLetter = String.fromCharCode(64 + colNumber);
          const cellRef = `${colLetter}${rowNumber}`;
          
          // Extract the appropriate value based on cell type
          let cellValue: string;
          if (cell.formula) {
            // For formula cells, use the result
            cellValue = cell.result ? cell.result.toString() : cell.value?.toString() || '';
            cells.push(`${cellRef} (formula): ${cellValue}`);
          } else if (typeof cell.value === 'number') {
            // For numeric cells, check if it might be currency
            const isCurrency = cell.numFmt?.includes('$') || 
                              cell.numFmt?.includes('€') ||
                              cell.numFmt?.includes('£');
            
            if (isCurrency) {
              // Format currency values specially
              cellValue = cell.numFmt?.replace(/\[.*\]/, '') || '$';
              cellValue = `${cellValue}${cell.value.toFixed(2)}`;
            } else {
              cellValue = cell.value.toString();
            }
            cells.push(`${cellRef}: ${cellValue}`);
          } else if (cell.value instanceof Date) {
            // For date cells, format them consistently
            const date = cell.value as Date;
            cellValue = date.toISOString().split('T')[0];
            cells.push(`${cellRef} (date): ${cellValue}`);
          } else {
            // Default case for text and other cell types
            cellValue = cell.text || cell.value?.toString() || '';
            cells.push(`${cellRef}: ${cellValue}`);
          }
        });
        
        if (cells.length > 0) {
          rows.push(cells.join(" | "));
        }
      });
      
      console.log(`Processed ${cellsProcessed} cells in sheet "${sheetName}"`);
      
      if (rows.length > 0) {
        const sheetContent = `[Excel Sheet: ${sheetName}]\n${rows.join("\n")}`;
        sheets.push(sheetContent);
        console.log(`Sheet "${sheetName}" processed with ${rows.length} rows of content`);
      } else {
        console.warn(`No content extracted from sheet "${sheetName}"`);
        emptySheetsCount++;
      }
    });
    
    // Log summary statistics
    console.log(`Excel processing complete for ${path.basename(filePath)}:`);
    console.log(`- Total sheets: ${totalSheets}`);
    console.log(`- Sheets with content: ${sheets.length}`);
    console.log(`- Empty sheets: ${emptySheetsCount}`);
    
    if (sheets.length === 0) {
      console.warn(`No content extracted from any sheet in: ${path.basename(filePath)}`);
      return [`[Excel Document] No extractable content found in this Excel file.`];
    }
    
    return sheets;
  } catch (error) {
    console.error(`Error extracting data from Excel ${path.basename(filePath)}:`, error);
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
 * Extracts text from an RTF file
 * @param filePath Path to the RTF file
 * @returns Extracted plain text content
 */
export async function extractTextFromRTF(filePath: string): Promise<string[]> {
  try {
    console.log(`Starting RTF extraction for: ${path.basename(filePath)}`);
    
    const readFile = promisify(fs.readFile);
    const content = await readFile(filePath, 'utf8');
    
    // Basic RTF parser - removes RTF control sequences and extracts plain text
    let plainText = content;
    
    // Remove RTF header
    plainText = plainText.replace(/^\{\\rtf1[^}]*\}/, '');
    
    // Remove control words and groups
    plainText = plainText.replace(/\{[^{}]*\}/g, '');
    plainText = plainText.replace(/\\[a-z]+[0-9]*\s?/gi, '');
    plainText = plainText.replace(/\\[^a-z]/gi, '');
    
    // Remove remaining braces
    plainText = plainText.replace(/[{}]/g, '');
    
    // Clean up whitespace
    plainText = plainText.replace(/\s+/g, ' ').trim();
    
    // Convert RTF line breaks to actual line breaks
    plainText = plainText.replace(/\\par\s*/g, '\n');
    plainText = plainText.replace(/\\line\s*/g, '\n');
    
    if (!plainText || plainText.length === 0) {
      console.warn(`No text content extracted from RTF file: ${path.basename(filePath)}`);
      return [`[RTF Document] No text content could be extracted from this RTF file.`];
    }
    
    // Split into lines and process similar to TXT files
    const lines = plainText.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    console.log(`RTF extraction complete: ${lines.length} lines extracted from ${path.basename(filePath)}`);
    
    // For small RTF files, return the whole content as one chunk
    if (lines.length <= 10) {
      return [`[RTF Document] ${plainText}`];
    }
    
    // For larger RTF files, break into sections
    const result: string[] = [];
    const sectionSize = 50; // Number of lines per section
    
    for (let i = 0; i < lines.length; i += sectionSize) {
      const section = lines.slice(i, i + sectionSize);
      const sectionText = section.map((line, idx) => 
        `Line ${i + idx + 1}: ${line}`
      ).join('\n');
      
      result.push(`[RTF Document Section ${Math.floor(i / sectionSize) + 1}]\n${sectionText}`);
    }
    
    return result;
  } catch (error) {
    console.error(`Error extracting text from RTF file ${path.basename(filePath)}:`, error);
    return [`Error processing RTF file: ${path.basename(filePath)}`];
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
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();
    
    // Determine file type using both MIME type and extension for more reliable detection
    const isPdf = fileType === "application/pdf" || fileExtension === '.pdf';
    const isExcel = 
      fileType === "application/vnd.ms-excel" || 
      fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      fileType === "application/octet-stream" || // Sometimes Excel files are detected as generic binary
      fileExtension === '.xlsx' || 
      fileExtension === '.xls';
    const isText = 
      fileType === "text/plain" || 
      fileExtension === '.txt' || 
      fileExtension === '.csv' ||
      fileExtension === '.md';
    const isRtf = 
      fileType === "text/rtf" || 
      fileType === "application/rtf" || 
      fileExtension === '.rtf';
    
    console.log(`File type detection: isPdf=${isPdf}, isExcel=${isExcel}, isText=${isText}, isRtf=${isRtf}`);
    
    if (isPdf) {
      console.log(`Processing PDF document: ${fileName}`);
      result = await extractTextFromPDF(filePath);
    } else if (isExcel) {
      console.log(`Processing Excel document: ${fileName}`);
      result = await extractDataFromExcel(filePath);
    } else if (isText) {
      console.log(`Processing text document: ${fileName}`);
      result = await extractTextFromTXT(filePath);
    } else if (isRtf) {
      console.log(`Processing RTF document: ${fileName}`);
      result = await extractTextFromRTF(filePath);
    } else {
      console.error(`Unsupported file type: ${fileType} with extension ${fileExtension} for file: ${fileName}`);
      return [`The file "${fileName}" has an unsupported format (${fileType}). Please upload PDF, Excel, TXT, or RTF files.`];
    }
    
    if (result.length === 0) {
      console.warn(`Document processed but yielded no content: ${fileName}`);
      return [`The file "${fileName}" was processed but no text content could be extracted. The file might be empty, password-protected, or contain only images.`];
    }
    
    console.log(`Successfully processed document: ${fileName}, extracted ${result.length} content chunks`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error processing document ${path.basename(filePath)}: ${errorMessage}`);
    
    // Return a more informative error message that still indicates there was a processing issue
    return [`The document "${path.basename(filePath)}" could not be processed: ${errorMessage}. Please try uploading it again or contact support if the issue persists.`];
  }
}
