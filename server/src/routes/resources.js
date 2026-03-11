// const express = require('express');
// const { Resource } = require('../models/Resource');
// const { verifyToken } = require('../middleware/auth');
// const { requireRole, blockFacultyWrite } = require('../middleware/rbac');
// const { validate, resourceSchema } = require('../validators/schemas');
// const upload = require('../config/multer');

// const router = express.Router();
// router.use(verifyToken);

// // Build audience filter
// const buildResourceFilter = (user) => {
//   const { role, teamId } = user;
//   if (role === 'admin' || role === 'faculty') return {};

//   return {
//     $or: [
//       { scope: 'global' },
//       { scope: 'team', teamId },
//       { scope: 'role', targetRoles: role },
//     ],
//   };
// };

// // GET /api/resources
// router.get('/', async (req, res, next) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 20;
//     const skip = (page - 1) * limit;

//     let filter = buildResourceFilter(req.user);

//     // Search + filter
//     if (req.query.search) {
//       filter.$text = { $search: req.query.search };
//     }
//     if (req.query.type) filter.type = req.query.type;
//     if (req.query.teamId) filter.teamId = req.query.teamId;
//     if (req.query.tag) filter.tags = req.query.tag;

//     const [resources, total] = await Promise.all([
//       Resource.find(filter)
//         .populate('uploadedBy', 'name role')
//         .populate('teamId', 'name color')
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit),
//       Resource.countDocuments(filter),
//     ]);
//     res.json({ success: true, resources, total, page, pages: Math.ceil(total / limit) });
//   } catch (err) {
//     next(err);
//   }
// });

// // GET /api/resources/:id
// router.get('/:id', async (req, res, next) => {
//   try {
//     const resource = await Resource.findById(req.params.id)
//       .populate('uploadedBy', 'name role')
//       .populate('teamId', 'name');
//     if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });
//     res.json({ success: true, resource });
//   } catch (err) {
//     next(err);
//   }
// });

// // POST /api/resources — link or text
// router.post('/', requireRole('admin', 'teamleader'), blockFacultyWrite, validate(resourceSchema), async (req, res, next) => {
//   try {
//     const body = { ...req.body, uploadedBy: req.user.id };
//     if (req.user.role === 'teamleader') {
//       body.scope = body.scope === 'global' ? 'global' : 'team';
//       body.teamId = req.user.teamId;
//     }
//     const resource = await Resource.create(body);
//     await resource.populate('uploadedBy', 'name');
//     res.status(201).json({ success: true, resource });
//   } catch (err) {
//     next(err);
//   }
// });

// // POST /api/resources/upload — file upload
// router.post('/upload', requireRole('admin', 'teamleader'), blockFacultyWrite, upload.single('file'), async (req, res, next) => {
//   try {
//     if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

//     const fileUrl = req.file.path;
//     const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
//     const body = {
//       title: req.body.title || req.file.originalname,
//       description: req.body.description || '',
//       tags,
//       type: 'file',
//       value: fileUrl,
//       originalFileName: req.file.originalname,
//       fileMimeType: req.file.mimetype,
//       fileSize: req.file.size,
//       scope: req.body.scope || 'global',
//       teamId: req.user.role === 'teamleader' ? req.user.teamId : (req.body.teamId || null),
//       targetRoles: req.body.targetRoles ? JSON.parse(req.body.targetRoles) : [],
//       uploadedBy: req.user.id,
//     };

//     const resource = await Resource.create(body);
//     await resource.populate('uploadedBy', 'name');
//     res.status(201).json({ success: true, resource });
//   } catch (err) {
//     next(err);
//   }
// });

// // DELETE /api/resources/:id
// router.delete('/:id', requireRole('admin', 'teamleader'), blockFacultyWrite, async (req, res, next) => {
//   try {
//     const resource = await Resource.findById(req.params.id);
//     if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });
//     if (req.user.role === 'teamleader' && resource.uploadedBy.toString() !== req.user.id) {
//       return res.status(403).json({ success: false, message: 'You can only delete your own resources' });
//     }
//     await Resource.findByIdAndDelete(req.params.id);
//     res.json({ success: true, message: 'Deleted' });
//   } catch (err) {
//     next(err);
//   }
// });

// module.exports = router;

// const express = require('express');
// const { Resource } = require('../models/Resource');
// const { verifyToken } = require('../middleware/auth');
// const { requireRole, blockFacultyWrite } = require('../middleware/rbac');
// const { validate, resourceSchema } = require('../validators/schemas');
// const upload = require('../config/multer');
// const cloudinary = require('cloudinary').v2;

// // Ensure Cloudinary is configured
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// /**
//  * Parse a Cloudinary delivery URL into { resourceType, publicId }.
//  * Handles both /image/upload/ and /raw/upload/ paths.
//  * The public_id includes the folder, e.g. "techfest_uploads/abc.pdf"
//  */
// const parseCloudinaryUrl = (url) => {
//   try {
//     const resourceTypeMatch = url.match(/\/(image|raw|video)\/upload\//);
//     // After /upload/ there may be a version segment like v1234567890/ — skip it
//     const publicIdMatch = url.match(/\/(?:image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/);
//     if (!resourceTypeMatch || !publicIdMatch) return null;
//     return {
//       resourceType: resourceTypeMatch[1],
//       publicId: publicIdMatch[1],
//     };
//   } catch {
//     return null;
//   }
// };

// const router = express.Router();
// router.use(verifyToken);

// // Build audience filter
// const buildResourceFilter = (user) => {
//   const { role, teamId } = user;
//   if (role === 'admin' || role === 'faculty') return {};

//   return {
//     $or: [
//       { scope: 'global' },
//       { scope: 'team', teamId },
//       { scope: 'role', targetRoles: role },
//     ],
//   };
// };

// // GET /api/resources
// router.get('/', async (req, res, next) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 20;
//     const skip = (page - 1) * limit;

//     let filter = buildResourceFilter(req.user);

//     // Search + filter
//     if (req.query.search) {
//       filter.$text = { $search: req.query.search };
//     }
//     if (req.query.type) filter.type = req.query.type;
//     if (req.query.teamId) filter.teamId = req.query.teamId;
//     if (req.query.tag) filter.tags = req.query.tag;

//     const [resources, total] = await Promise.all([
//       Resource.find(filter)
//         .populate('uploadedBy', 'name role')
//         .populate('teamId', 'name color')
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit),
//       Resource.countDocuments(filter),
//     ]);
//     res.json({ success: true, resources, total, page, pages: Math.ceil(total / limit) });
//   } catch (err) {
//     next(err);
//   }
// });

// // GET /api/resources/:id/download — generate a signed Cloudinary URL and redirect.
// // This bypasses "untrusted account / blocked for delivery" restrictions on raw files
// // because signed URLs are served via Cloudinary's authenticated delivery pipeline.
// router.get('/:id/download', async (req, res, next) => {
//   try {
//     const resource = await Resource.findById(req.params.id);
//     if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });
//     if (resource.type !== 'file' || !resource.value) {
//       return res.status(400).json({ success: false, message: 'Not a file resource' });
//     }

//     const parsed = parseCloudinaryUrl(resource.value);
//     if (!parsed) {
//       // Fallback: redirect to the stored URL as-is
//       return res.redirect(resource.value);
//     }

//     const { resourceType, publicId } = parsed;

//     // Generate a signed URL valid for 1 hour
//     const signedUrl = cloudinary.url(publicId, {
//       resource_type: resourceType,
//       type: 'upload',
//       sign_url: true,
//       secure: true,
//       expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour
//     });

//     return res.redirect(signedUrl);
//   } catch (err) {
//     next(err);
//   }
// });

// // GET /api/resources/:id
// router.get('/:id', async (req, res, next) => {
//   try {
//     const resource = await Resource.findById(req.params.id)
//       .populate('uploadedBy', 'name role')
//       .populate('teamId', 'name');
//     if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });
//     res.json({ success: true, resource });
//   } catch (err) {
//     next(err);
//   }
// });

// // POST /api/resources — link or text
// router.post('/', requireRole('admin', 'teamleader'), blockFacultyWrite, validate(resourceSchema), async (req, res, next) => {
//   try {
//     const body = { ...req.body, uploadedBy: req.user.id };
//     if (req.user.role === 'teamleader') {
//       body.scope = body.scope === 'global' ? 'global' : 'team';
//       body.teamId = req.user.teamId;
//     }
//     const resource = await Resource.create(body);
//     await resource.populate('uploadedBy', 'name');
//     res.status(201).json({ success: true, resource });
//   } catch (err) {
//     next(err);
//   }
// });

// // POST /api/resources/upload — file upload
// router.post('/upload', requireRole('admin', 'teamleader'), blockFacultyWrite, upload.single('file'), async (req, res, next) => {
//   try {
//     if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

//     // multer-storage-cloudinary sometimes strips the file extension from req.file.path
//     // even when it's embedded in the public_id. We re-append it here so the stored URL
//     // ends in .pdf / .csv / .docx etc., which is required for the browser to open the
//     // file inline (especially critical for PDFs).
//     let fileUrl = req.file.path;
//     const originalExt = req.file.originalname.split('.').pop().toLowerCase();
//     const isDocument =
//       req.file.mimetype === 'application/pdf' ||
//       req.file.mimetype.includes('document') ||
//       req.file.mimetype.includes('text') ||
//       req.file.mimetype.includes('csv');
//     if (isDocument && !fileUrl.endsWith(`.${originalExt}`)) {
//       fileUrl = `${fileUrl}.${originalExt}`;
//     }
//     const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
//     const body = {
//       title: req.body.title || req.file.originalname,
//       description: req.body.description || '',
//       tags,
//       type: 'file',
//       value: fileUrl,
//       // Store Cloudinary identifiers for signed URL generation later
//       cloudinaryPublicId: req.file.filename || req.file.public_id || null,
//       cloudinaryResourceType: req.file.resource_type || (isDocument ? 'raw' : 'image'),
//       originalFileName: req.file.originalname,
//       fileMimeType: req.file.mimetype,
//       fileSize: req.file.size,
//       scope: req.body.scope || 'global',
//       teamId: req.user.role === 'teamleader' ? req.user.teamId : (req.body.teamId || null),
//       targetRoles: req.body.targetRoles ? JSON.parse(req.body.targetRoles) : [],
//       uploadedBy: req.user.id,
//     };

//     const resource = await Resource.create(body);
//     await resource.populate('uploadedBy', 'name');
//     res.status(201).json({ success: true, resource });
//   } catch (err) {
//     next(err);
//   }
// });

// // DELETE /api/resources/:id
// router.delete('/:id', requireRole('admin', 'teamleader'), blockFacultyWrite, async (req, res, next) => {
//   try {
//     const resource = await Resource.findById(req.params.id);
//     if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });
//     if (req.user.role === 'teamleader' && resource.uploadedBy.toString() !== req.user.id) {
//       return res.status(403).json({ success: false, message: 'You can only delete your own resources' });
//     }
//     await Resource.findByIdAndDelete(req.params.id);
//     res.json({ success: true, message: 'Deleted' });
//   } catch (err) {
//     next(err);
//   }
// });

// module.exports = router;



const express = require('express');
const { Resource } = require('../models/Resource');
const { verifyToken } = require('../middleware/auth');
const { requireRole, blockFacultyWrite } = require('../middleware/rbac');
const { validate, resourceSchema } = require('../validators/schemas');
const upload = require('../config/multer');
const cloudinary = require('cloudinary').v2;

// Ensure Cloudinary is configured
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Parse a Cloudinary delivery URL into { resourceType, publicId }.
 * Handles both /image/upload/ and /raw/upload/ paths.
 * The public_id includes the folder, e.g. "techfest_uploads/abc.pdf"
 */
const parseCloudinaryUrl = (url) => {
  try {
    const resourceTypeMatch = url.match(/\/(image|raw|video)\/upload\//);
    // After /upload/ there may be a version segment like v1234567890/ — skip it
    const publicIdMatch = url.match(/\/(?:image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/);
    if (!resourceTypeMatch || !publicIdMatch) return null;
    return {
      resourceType: resourceTypeMatch[1],
      publicId: publicIdMatch[1],
    };
  } catch {
    return null;
  }
};

const router = express.Router();
router.use(verifyToken);

// Build audience filter
const buildResourceFilter = (user) => {
  const { role, teamId } = user;
  if (role === 'admin' || role === 'faculty') return {};
  const audienceFilter = {
    $or: [
      { scope: 'global' },
      { scope: 'team', teamId },
      { scope: 'role', targetRoles: role },
    ],
  };

  // If CA, they can ONLY see resources specifically marked as CA-viewable
  if (role === 'campus_ambassador') {
    return {
      $and: [
        audienceFilter,
        { isCAResource: true }
      ]
    };
  }

  return audienceFilter;
};

// GET /api/resources
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let filter = buildResourceFilter(req.user);

    // Search + filter
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }
    if (req.query.type) filter.type = req.query.type;
    if (req.query.scope && req.query.scope !== 'all') filter.scope = req.query.scope;
    if (req.query.teamId) filter.teamId = req.query.teamId;
    if (req.query.tag) filter.tags = req.query.tag;
    if (req.query.category && req.query.category !== 'all') {
      const cat = req.query.category;
      // Match resources where category = 'tech' OR tag = 'tech' (legacy resources tagged but not categorized)
      const catFilter = { $or: [{ category: cat }, { tags: cat }] };
      if (filter.$or) {
        // wrap existing audience $or together with category filter using $and
        filter = { $and: [filter, catFilter] };
      } else {
        Object.assign(filter, catFilter);
      }
    }
    if (req.query.isCAResource === 'true') filter.isCAResource = true;

    const [resources, total] = await Promise.all([
      Resource.find(filter)
        .populate('uploadedBy', 'name role')
        .populate('teamId', 'name color')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Resource.countDocuments(filter),
    ]);
    res.json({ success: true, resources, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/resources/:id/download — generate a signed Cloudinary URL and redirect.
// This bypasses "untrusted account / blocked for delivery" restrictions on raw files
// because signed URLs are served via Cloudinary's authenticated delivery pipeline.
router.get('/:id/download', async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });
    if (resource.type !== 'file' || !resource.value) {
      return res.status(400).json({ success: false, message: 'Not a file resource' });
    }

    const parsed = parseCloudinaryUrl(resource.value);
    if (!parsed) {
      // Fallback: redirect to the stored URL as-is
      return res.redirect(resource.value);
    }

    const { resourceType, publicId } = parsed;

    // Generate a signed URL valid for 1 hour
    const signedUrl = cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'upload',
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    });

    return res.redirect(signedUrl);
  } catch (err) {
    next(err);
  }
});

// GET /api/resources/:id
router.get('/:id', async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id)
      .populate('uploadedBy', 'name role')
      .populate('teamId', 'name');
    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });
    res.json({ success: true, resource });
  } catch (err) {
    next(err);
  }
});

// POST /api/resources — link or text
router.post('/', requireRole('admin', 'teamleader'), blockFacultyWrite, validate(resourceSchema), async (req, res, next) => {
  try {
    const body = { ...req.body, uploadedBy: req.user.id };
    
    // Sanitize teamId from empty string back to null to avoid BSON ObjectId casting errors
    if (!body.teamId || body.teamId === '') {
      body.teamId = null;
    }
    
    // Handle new fields
    if (body.isCAResource !== undefined) body.isCAResource = body.isCAResource === true || body.isCAResource === 'true';
    if (!body.category) body.category = 'all';
    if (body.category !== 'private') body.accessCode = null;
    
    if (req.user.role === 'teamleader') {
      body.scope = body.scope === 'global' ? 'global' : 'team';
      body.teamId = req.user.teamId;
    }
    const resource = await Resource.create(body);
    await resource.populate('uploadedBy', 'name');
    res.status(201).json({ success: true, resource });
  } catch (err) {
    next(err);
  }
});

// POST /api/resources/upload — file upload
router.post('/upload', requireRole('admin', 'teamleader'), blockFacultyWrite, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    // multer-storage-cloudinary sometimes strips the file extension from req.file.path
    // even when it's embedded in the public_id. We re-append it here so the stored URL
    // ends in .pdf / .csv / .docx etc., which is required for the browser to open the
    // file inline (especially critical for PDFs).
    let fileUrl = req.file.path;
    const originalExt = req.file.originalname.split('.').pop().toLowerCase();
    const isDocument =
      req.file.mimetype === 'application/pdf' ||
      req.file.mimetype.includes('document') ||
      req.file.mimetype.includes('text') ||
      req.file.mimetype.includes('csv');
    if (isDocument && !fileUrl.endsWith(`.${originalExt}`)) {
      fileUrl = `${fileUrl}.${originalExt}`;
    }
    const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
    const body = {
      title: req.body.title || req.file.originalname,
      description: req.body.description || '',
      tags,
      type: 'file',
      value: fileUrl,
      // Store Cloudinary identifiers for signed URL generation later
      cloudinaryPublicId: req.file.filename || req.file.public_id || null,
      cloudinaryResourceType: req.file.resource_type || (isDocument ? 'raw' : 'image'),
      originalFileName: req.file.originalname,
      fileMimeType: req.file.mimetype,
      fileSize: req.file.size,
      scope: req.body.scope || 'global',
      teamId: req.user.role === 'teamleader' ? req.user.teamId : (req.body.teamId || null),
      targetRoles: req.body.targetRoles ? JSON.parse(req.body.targetRoles) : [],
      isCAResource: req.body.isCAResource === 'true' || req.body.isCAResource === true,
      category: req.body.category || 'all',
      accessCode: req.body.category === 'private' ? (req.body.accessCode || null) : null,
      uploadedBy: req.user.id,
    };

    const resource = await Resource.create(body);
    await resource.populate('uploadedBy', 'name');
    res.status(201).json({ success: true, resource });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/resources/:id
router.delete('/:id', requireRole('admin', 'teamleader'), blockFacultyWrite, async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });
    if (req.user.role === 'teamleader' && resource.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only delete your own resources' });
    }

    // If this is a file resource, also delete it from Cloudinary
    if (resource.type === 'file' && resource.value) {
      const parsed = parseCloudinaryUrl(resource.value);
      if (parsed) {
        try {
          await cloudinary.uploader.destroy(parsed.publicId, {
            resource_type: parsed.resourceType,
            invalidate: true, // purge from CDN cache too
          });
        } catch (cloudinaryErr) {
          // Log but don't block the DB deletion — the file may have already been
          // removed manually from Cloudinary, or the public_id may have shifted.
          console.error('Cloudinary deletion failed (continuing):', cloudinaryErr.message);
        }
      }
    }

    await Resource.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;