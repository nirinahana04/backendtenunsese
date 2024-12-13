const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const { PubSub } = require('@google-cloud/pubsub');
const { Storage } = require('@google-cloud/storage');
const { PredictionServiceClient } = require('@google-cloud/vertex-ai');
const cors = require('cors');

// Initialize
const app = express();
const upload = multer({ dest: 'uploads/' });
const pubSubClient = new PubSub();
const storage = new Storage();
const predictionClient = new PredictionServiceClient();

app.use(bodyParser.json());
app.use(cors());

// Cloud Storage Bucket
const BUCKET_NAME = 'tenun-image';

// Vertex AI Model Endpoint
const ENDPOINT_ID = 'vertex-ai-endpoint-belum-ada-haha-cape';
const PROJECT_ID = 'tenunsense';
const REGION = 'asian-southeast2';

// Image Upload
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const validFormats = ['image/jpeg', 'image/png'];
    if (!validFormats.includes(req.file.mimetype)) {
      return res.status(400).send({ message: 'Invalid file format. Please upload JPEG or PNG images.' });
    }

    const bucket = storage.bucket(BUCKET_NAME);
    const blob = bucket.file(req.file.originalname);
    const blobStream = blob.createWriteStream();

    blobStream.on('error', (err) => {
      console.error(err);
      res.status(500).send({ message: 'Failed to upload image to Cloud Storage.' });
    });

    blobStream.on('finish', async () => {
      const message = {
        fileName: req.file.originalname,
        bucketName: BUCKET_NAME,
      };

      const topicName = 'image-processing-topic';
      await pubSubClient.topic(topicName).publishMessage({ data: Buffer.from(JSON.stringify(message)) });

      res.status(200).send({ message: 'Image uploaded and processing initiated.' });
    });

    blobStream.end(req.file.buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal server error.' });
  }
});

// Model Prediction
app.post('/predict', async (req, res) => {
  try {
    const { bucketName, fileName } = req.body;

    const instance = {
      content: `gs://${bucketName}/${fileName}`,
    };

    const request = {
      endpoint: `projects/${PROJECT_ID}/locations/${REGION}/endpoints/${ENDPOINT_ID}`,
      instances: [instance],
    };

    const [response] = await predictionClient.predict(request);
    const predictions = response.predictions;

    res.status(200).send({ message: 'Prediction successful.', predictions });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Error during prediction.' });
  }
});

// Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});