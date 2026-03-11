// const multer = require('multer');
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const cloudinary = require('cloudinary').v2;

// // Configure Cloudinary using environment variables
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// const storage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: async (req, file) => {
//     const ext = file.originalname.split('.').pop().toLowerCase();
//     const randomId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

//     if (file.mimetype === 'application/pdf') {
//       return {
//         folder: 'techfest_uploads',
//         resource_type: 'image', // Cloudinary manages PDFs natively under the 'image' type for previews!
//         format: 'pdf',
//         public_id: randomId,
//       };
//     } else if (
//       file.mimetype.includes('document') ||
//       file.mimetype.includes('text') ||
//       file.mimetype.includes('csv')
//     ) {
//       return {
//         folder: 'techfest_uploads',
//         resource_type: 'raw',
//         // Raw files need the extension in the public_id to be served with right mime-type
//         public_id: `${randomId}.${ext}`,
//       };
//     } else {
//       // standard images
//       return {
//         folder: 'techfest_uploads',
//         resource_type: 'image',
//         format: ext, // ensures the original extension (.png, .jpg) is appended
//         public_id: randomId,
//       };
//     }
//   },
// });

// const fileFilter = (req, file, cb) => {
//   const allowed = [
//     'application/pdf',
//     'text/csv',
//     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//     'application/msword',
//     'image/jpeg',
//     'image/png',
//     'image/gif',
//     'image/webp',
//     'text/plain',
//   ];
//   if (allowed.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error(`File type ${file.mimetype} not allowed`), false);
//   }
// };

// const upload = multer({
//   storage: storage,
//   limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
//   fileFilter,
// });

// module.exports = upload;





const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const randomId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype.includes('document') ||
      file.mimetype.includes('text') ||
      file.mimetype.includes('csv')
    ) {
      // All documents must use resource_type 'raw'.
      // Cloudinary serves raw files as-is with correct Content-Type, enabling native PDF preview.
      // Extension is embedded in public_id so the URL ends in .pdf/.csv etc.
      // NOTE: multer-storage-cloudinary sometimes strips the extension from req.file.path —
      // the upload route in resources.js re-appends it if missing.
      return {
        folder: 'techfest_uploads',
        resource_type: 'raw',
        public_id: `${randomId}.${ext}`,
      };
    } else {
      // Standard images (jpeg, png, gif, webp)
      return {
        folder: 'techfest_uploads',
        resource_type: 'image',
        format: ext,
        public_id: randomId,
      };
    }
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

module.exports = upload;