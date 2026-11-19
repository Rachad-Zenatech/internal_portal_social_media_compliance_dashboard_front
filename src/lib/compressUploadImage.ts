/**
 * Reduce large image uploads before they leave the browser. Small images and
 * non-image attachments stay byte-for-byte unchanged.
 */
export async function compressUploadImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 1.5 * 1024 * 1024) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        let { width, height } = image;
        const maxDimension = 2048;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return resolve(file);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob && blob.size < file.size
            ? new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() })
            : file),
          "image/jpeg",
          0.85,
        );
      };
      image.onerror = () => resolve(file);
      image.src = reader.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
