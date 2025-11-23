import cloudinary from 'cloudinary';
import formidable from 'formidable';
import fs from 'fs';

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Disable body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  const form = new formidable.IncomingForm();
  const uploadedImages = [];

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Error parsing file.' });
    }

    const filesArray = Array.isArray(files.image) ? files.image : [files.image];

    for (let file of filesArray) {
      try {
        const result = await cloudinary.v2.uploader.upload(file.filepath, {
          folder: 'experiences', // Optional: specify Cloudinary folder for organization
        });

        uploadedImages.push(result.secure_url); // Store the Cloudinary URL
        fs.unlinkSync(file.filepath); // Clean up temporary file
      } catch (uploadError) {
        console.error(uploadError);
        return res.status(500).json({ error: 'Image upload failed' });
      }
    }

    return res.status(200).json({ urls: uploadedImages }); // Return all the image URLs
  });
}
