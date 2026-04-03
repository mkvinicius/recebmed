const MAX_DIMENSION = 2048;
const QUALITY = 0.82;

export function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        const testCanvas = document.createElement("canvas");
        testCanvas.width = width;
        testCanvas.height = height;
        const testCtx = testCanvas.getContext("2d")!;
        testCtx.drawImage(img, 0, 0);
        const compressed = testCanvas.toDataURL("image/jpeg", QUALITY);
        if (compressed.length < dataUrl.length) {
          resolve(compressed);
        } else {
          resolve(dataUrl);
        }
        return;
      }

      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL("image/jpeg", QUALITY));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
