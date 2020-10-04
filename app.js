// Require packages
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');

// Initialize environment
const app = express();
const port = process.env.PORT || 3000;
const mongoURI = 'mongodb://localhost:27017/multer'

// Create Mongo connection
const conn = mongoose.createConnection(mongoURI);

// Initialize GridFS
let gfs;
conn.once('open', () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

// Create storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) return reject(err);
        const filename = buf.toString('hex') + path.extname(file.originalname);
      const fileInfo = {
        filename: filename,
        bucketName: 'uploads'
      };
      resolve(fileInfo);
    });
  });
  }
});
const upload = multer({ storage });

// Middleware
app.use(express.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

// **************************
// ROUTES
// **************************
// Home Page Route
app.get('/', (req, res) => {
  gfs.files.find().toArray((err, files) => {
    if (!files || files.length === 0) {
      res.render('index', { files: false });
    } else {
      files.map((file) => {
        (file.contentType === 'image/jpeg' || file.contentType === 'image/png') ? file.isImage = true : file.isImage = false;
      });
      res.render('index', { files: files });
    }
  });
});

// POST - Upload a file
app.post('/upload', upload.single('file'), (req, res) => res.redirect('/'));

// Return array of all files
app.get('/files', (req, res) => {
  gfs.files.find().toArray((err, files) => {
    if (!files || files.length === 0) return res.status(404).json({ err: 'No files exist' });
    return res.json(files);
  });
});

// Return an individual file
app.get('/files/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) return res.status(404).json({ err: 'No file exists' });
    return res.json(file);
  });
});

// Return an individual file only if it is an image
app.get('/image/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) return res.status(404).json({ err: 'No file exists' });
    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({ err: 'Not an image' });
    }
  });
});

// Delete a file
app.delete('/files/:id', (req, res) => {
  gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
    if (err) res.status(404).json({ err: err });
    res.redirect('/');
  });
});

// Start the Server
app.listen(port, () => console.log(`Server started on port ${port}`));
