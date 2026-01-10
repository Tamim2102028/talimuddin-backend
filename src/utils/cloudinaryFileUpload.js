import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const removeLocalFile = (localFilePath) => {
  try {
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  } catch (error) {
    console.error("Error removing local file:", error);
  }
};

const uploadFile = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // 1. Upload to Cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    // 2. File uploaded successfully, now remove local file
    removeLocalFile(localFilePath);

    return response;
  } catch (error) {
    // 3. Upload Failed? Still try to remove local file
    removeLocalFile(localFilePath);

    // null রিটার্ন করলে কন্ট্রোলার বুঝবে আপলোড হয়নি
    return null;
  }
};

// Delete from Cloudinary (Unchanged but ensuring null check)
const deleteFile = async (fileId) => {
  try {
    if (!fileId) return null;
    return await cloudinary.uploader.destroy(fileId);
  } catch (error) {
    console.error("Error deleting file from cloudinary:", error);
    return null;
  }
};

export { uploadFile, deleteFile };
