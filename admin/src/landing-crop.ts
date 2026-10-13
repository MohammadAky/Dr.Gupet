export type FocusPoint = { x: number; y: number };

/** Same cover geometry and object-position percentages used by the storefront. */
export function coverCrop(
  width: number,
  height: number,
  ratio: number,
  focus: FocusPoint,
) {
  if (![focus.x, focus.y].every(Number.isFinite))
    throw new Error("جایگاه کادر معتبر نیست.");
  if (
    ![width, height, ratio].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  ) {
    throw new Error("ابعاد تصویر معتبر نیست.");
  }
  const cropWidth = Math.min(width, height * ratio);
  const cropHeight = Math.min(height, width / ratio);
  const x = Math.min(100, Math.max(0, focus.x));
  const y = Math.min(100, Math.max(0, focus.y));
  return {
    x: ((width - cropWidth) * x) / 100,
    y: ((height - cropHeight) * y) / 100,
    width: cropWidth,
    height: cropHeight,
  };
}

export async function verifyRaster(file: File) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("حجم تصویر باید حداکثر ۱۰ مگابایت باشد.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
    (value, index) => bytes[index] === value,
  );
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (
    (file.type === "image/jpeg" && jpeg) ||
    (file.type === "image/png" && png) ||
    (file.type === "image/webp" && webp)
  )
    return;
  throw new Error("یک تصویر معتبر JPEG، PNG یا WebP انتخاب کنید.");
}

export function loadCropImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      image.naturalWidth > 0 && image.naturalHeight > 0
        ? resolve(image)
        : reject(new Error("ابعاد تصویر معتبر نیست."));
    image.onerror = () =>
      reject(
        new Error("تصویر باز نشد. فایل را بررسی کنید و دوباره تلاش کنید."),
      );
    image.src = source;
  });
}

export async function exportCrop(
  source: string,
  width: number,
  height: number,
  focus: FocusPoint,
): Promise<Blob> {
  const image = await loadCropImage(source);
  const crop = coverCrop(
    image.naturalWidth,
    image.naturalHeight,
    width / height,
    focus,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("مرورگر امکان برش تصویر را ندارد.");
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("خروجی تصویر ساخته نشد. دوباره تلاش کنید.")),
      "image/webp",
      0.9,
    ),
  );
}
