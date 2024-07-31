const Cors = require('cors');
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand, ListObjectsCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const port = 3000;
app.use(express.json());  


app.use(Cors({
  origin: "*", 
  methods: ["GET", "POST"], 
  allowedHeaders: ["Content-Type"], 
}));

// Configure AWS S3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload endpoint for audio and subtitle files
app.post('/upload', upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'subtitle', maxCount: 1 }
  ]), async (req, res) => {
  const { audio, subtitle } = req.files;
  if (!audio) {
    return res.status(400).json({message: "Audio file is required"});
  }

  try {
    const uploadPromises = [];
    const prefix = Date.now();

    // Upload audio file
    const audioParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `${prefix}-${audio[0].originalname}`,
      Body: audio[0].buffer,
      ContentType: audio[0].mimetype,
    };
    console.log ('audiooo keyyyy', `${prefix}-${audio[0].originalname}`)
    uploadPromises.push(s3.send(new PutObjectCommand(audioParams)));

    // Upload subtitle file
    if (subtitle) {
      const subtitleParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `${prefix}-${subtitle[0].originalname}`,
        Body: subtitle[0].buffer,
        ContentType: subtitle[0].mimetype,
      };
      console.log ('subbbbbb keyyyy', `${prefix}-${subtitle[0].originalname}`)
      uploadPromises.push(s3.send(new PutObjectCommand(subtitleParams)));
    }
    

    await Promise.all(uploadPromises);
    res.status(200).json({message:'Files uploaded successfully'});
  } catch (err) {
    res.status(500).json({ message: 'Error uploading files' });
  }
});

// List files endpoint
app.get('/files', async (req, res) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
  };

  try {
    const command = new ListObjectsCommand(params);
    const data = await s3.send(command);
    const files = data.Contents.map(item => ({
      Key: item.Key,
      LastModified: item.LastModified,
    }));
    res.status(200).json(files);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving files', error: err });
  }
});

// Get file endpoint
app.get('/file/:key', async (req, res) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: req.params.key,
  };

  try {
    const command = new GetObjectCommand(params);
    const data = await s3.send(command);
    res.setHeader('Content-Type', data.ContentType);
    data.Body.pipe(res);  // Stream the file directly to the response
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving file', error: err });
  }
});


app.post('/file', async (req, res) => {
  const { key } = req.body;  // Get the key from the request body
  
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  };
  // kk

  try {
    const command = new GetObjectCommand(params);
    const data = await s3.send(command);
    res.setHeader('Content-Type', data.ContentType);
    data.Body.pipe(res);  // Stream the file directly to the response
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving file', error: err });
  }
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
