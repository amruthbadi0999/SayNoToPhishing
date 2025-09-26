import { NextResponse } from "next/server";
import { createWorker } from 'tesseract.js';

export async function POST(req) {
  try {
    console.log('OCR endpoint called');
    const body = await req.json();
    const { imageData } = body;
    
    if (!imageData) {
      console.error('No image data received');
      return NextResponse.json({ 
        success: false, 
        error: 'No image data provided',
        confidence: 0,
        analysisDetails: 'No input provided. Please provide URL, email, message, or screenshot.'
      });
    }
    
    console.log('Received image data, processing...');
    
    // Create a worker
    const worker = await createWorker();
    
    try {
      // Initialize worker with English language
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      
      // Convert base64 to buffer
      const base64Data = imageData.split(',')[1];
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Perform OCR
      const { data: { text } } = await worker.recognize(imageBuffer);
      
      // Check if text was extracted
      if (!text || text.trim().length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No text found',
          confidence: 0,
          analysisDetails: 'Could not extract any text from the image. Please ensure the image contains clear, readable text.'
        });
      }
      
      return NextResponse.json({
        success: true,
        text: text,
        confidence: 0.8,
        analysisDetails: 'Text successfully extracted from image'
      });
    } finally {
      // Always clean up
      await worker.terminate();
    }
  } catch (error) {
    console.error('OCR processing error:', error);
    return NextResponse.json({
      success: false,
      error: 'OCR processing failed',
      confidence: 0,
      analysisDetails: error.message || 'An error occurred while processing the image'
    }, { status: 500 });
  }
}