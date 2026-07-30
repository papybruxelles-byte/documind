export interface CapturedPage {
  dataUrl: string;
  width: number;
  height: number;
}

export async function captureFromCamera(video: HTMLVideoElement): Promise<CapturedPage | null> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  return { dataUrl, width: canvas.width, height: canvas.height };
}

function bytesPerRow(width: number): number {
  return ((width * 8 + 31) >> 5) << 2;
}

function decodeImageSync(img: HTMLImageElement): { pixels: Uint8Array; width: number; height: number } | null {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { pixels: new Uint8Array(imageData.data), width: canvas.width, height: canvas.height };
}

function createFlateStream(uncompressed: Uint8Array): Uint8Array {
  const blockSize = 0x8000;
  const blocks: number[] = [];

  for (let offset = 0; offset < uncompressed.length; offset += blockSize) {
    const isLast = offset + blockSize >= uncompressed.length;
    const chunk = uncompressed.subarray(offset, Math.min(offset + blockSize, uncompressed.length));
    blocks.push(isLast ? 1 : 0);
    blocks.push(chunk.length & 0xff, (chunk.length >> 8) & 0xff);
    const inv = ~chunk.length & 0xffff;
    blocks.push(inv & 0xff, (inv >> 8) & 0xff);
    for (let i = 0; i < chunk.length; i++) blocks.push(chunk[i]);
  }

  return new Uint8Array(blocks);
}

export async function imagesToPdfBlob(pages: CapturedPage[]): Promise<Blob> {
  const pdfBytes: number[] = [];

  const header = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  for (let i = 0; i < header.length; i++) pdfBytes.push(header.charCodeAt(i));

  const objectPositions: number[] = [];
  let objectCount = 0;

  function writeString(s: string) {
    for (let i = 0; i < s.length; i++) pdfBytes.push(s.charCodeAt(i));
  }

  return new Promise((resolve) => {
    const processedImages: { id: number; width: number; height: number }[] = [];
    let pending = pages.length;

    if (pages.length === 0) {
      resolve(new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }));
      return;
    }

    pages.forEach((page, pageIndex) => {
      const img = new Image();
      img.onload = () => {
        const decoded = decodeImageSync(img);
        if (decoded) {
          const { pixels, width, height } = decoded;
          const rowSize = bytesPerRow(width);
          const rawSize = rowSize * height;
          const rawBytes = new Uint8Array(rawSize);
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const srcIdx = (y * width + x) * 4;
              const dstIdx = y * rowSize + x;
              rawBytes[dstIdx] = pixels[srcIdx];
            }
          }
          const flateData = createFlateStream(rawBytes);
          const imageObjId = ++objectCount;
          objectPositions[imageObjId] = pdfBytes.length;
          writeString(`${imageObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${flateData.length} >>\nstream\n`);
          for (let i = 0; i < flateData.length; i++) pdfBytes.push(flateData[i]);
          writeString('\nendstream\nendobj\n');
          processedImages[pageIndex] = { id: imageObjId, width, height };
        }
        pending--;
        if (pending === 0) {
          buildRestOfPdf();
        }
      };
      img.onerror = () => {
        pending--;
        if (pending === 0) buildRestOfPdf();
      };
      img.src = page.dataUrl;
    });

    function buildRestOfPdf() {
      const pageObjIds: number[] = [];
      const contentObjIds: number[] = [];

      processedImages.forEach((img) => {
        if (!img) return;
        const w = img.width;
        const h = img.height;

        const pageObjId = ++objectCount;
        objectPositions[pageObjId] = pdfBytes.length;
        pageObjIds.push(pageObjId);

        const contentObjId = ++objectCount;
        objectPositions[contentObjId] = pdfBytes.length;
        contentObjIds.push(contentObjId);

        const contentStr = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;

        writeString(`${pageObjId} 0 obj\n<< /Type /Page /Parent 1 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${img.id} 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`);
        writeString(`${contentObjId} 0 obj\n<< /Length ${contentStr.length} >>\nstream\n${contentStr}\nendstream\nendobj\n`);
      });

      objectPositions[1] = pdfBytes.length;
      const kids = pageObjIds.map((id) => `${id} 0 R`).join(' ');
      writeString(`1 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageObjIds.length} >>\nendobj\n`);

      const catalogObjId = ++objectCount;
      objectPositions[catalogObjId] = pdfBytes.length;
      writeString(`${catalogObjId} 0 obj\n<< /Type /Catalog /Pages 1 0 R >>\nendobj\n`);

      const xrefPos = pdfBytes.length;
      writeString(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
      for (let i = 1; i <= objectCount; i++) {
        const pos = objectPositions[i] || 0;
        writeString(`${pos.toString().padStart(10, '0')} 00000 n \n`);
      }

      writeString(`trailer\n<< /Size ${objectCount + 1} /Root ${catalogObjId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

      resolve(new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }));
    }
  });
}

export async function imagesToPdfFile(pages: CapturedPage[], filename: string): Promise<File> {
  const blob = await imagesToPdfBlob(pages);
  return new File([blob], filename, { type: 'application/pdf' });
}
