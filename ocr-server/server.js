const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createWorker } = require('tesseract.js');

const app = express();
const port = 3002; // Different from Next.js port

// Enable CORS for your Next.js app
app.use(cors({
  origin: 'http://localhost:3001' // Your Next.js app's URL
}));

// Increase payload size limit for base64 images
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.post('/ocr', async (req, res) => {
  try {
    console.log('OCR request received');
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: 'No image data provided',
        confidence: 0,
        analysisDetails: 'Please provide an image'
      });
    }

    const worker = await createWorker();

    try {
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');

      // Extract base64 data if it's a data URL
      const base64Data = imageData.split(',')[1] || imageData;
      const imageBuffer = Buffer.from(base64Data, 'base64');

      console.log('Processing image with Tesseract...');
      const { data: { text } } = await worker.recognize(imageBuffer);
      console.log('OCR completed');

      if (!text || text.trim().length === 0) {
        return res.json({
          success: false,
          error: 'No text found',
          confidence: 0,
          analysisDetails: 'Could not extract text from image'
        });
      }

      res.json({
        success: true,
        text: text,
        confidence: 0.8,
        analysisDetails: 'Text extracted successfully'
      });
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({
      success: false,
      error: 'OCR processing failed',
      confidence: 0,
      analysisDetails: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`OCR server running at http://localhost:${port}`);
});