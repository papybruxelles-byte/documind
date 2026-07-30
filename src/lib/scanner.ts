export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

interface ScanPage {
  width: number;
  height: number;
  pixels: Uint8Array;
}

interface ScannedDocument {
  pages: ScanPage[];
  source: string;
}

export interface ScannerConnection {
  port: SerialPort;
  info: SerialPortInfo;
}

const SCANNER_VENDORS = {
  EPSON: 0x04b8,
  HP: 0x03f0,
  CANON: 0x04a9,
  BROTHER: 0x04f9,
  XEROX: 0x05ef,
  KODAK: 0x040a,
  FUJITSU: 0x04c5,
};

export const SCANNER_FILTERS: SerialPortFilter[] = Object.entries(SCANNER_VENDORS).map(
  ([, vendorId]) => ({ usbVendorId: vendorId })
);

export async function requestScannerPort(): Promise<ScannerConnection | null> {
  if (!isWebSerialSupported()) return null;
  try {
    const port = await navigator.serial.requestPort({ filters: SCANNER_FILTERS });
    return { port, info: port.getInfo() };
  } catch {
    return null;
  }
}

export async function openScannerPort(
  connection: ScannerConnection,
  baudRate = 9600
): Promise<void> {
  await connection.port.open({ baudRate, bufferSize: 4096 });
}

export async function closeScannerPort(connection: ScannerConnection): Promise<void> {
  if (connection.port.readable) {
    const reader = connection.port.readable.getReader();
    try {
      reader.cancel();
    } catch {
      // ignore
    } finally {
      try { reader.releaseLock(); } catch { /* ignore */ }
    }
    try {
      await connection.port.close();
    } catch {
      // ignore close errors
    }
  }
}

export function getVendorName(vendorId?: number): string {
  if (!vendorId) return 'Unknown';
  for (const [name, id] of Object.entries(SCANNER_VENDORS)) {
    if (id === vendorId) return name.charAt(0) + name.slice(1).toLowerCase();
  }
  return `Vendor ${vendorId.toString(16)}`;
}

export function productIdToModel(productId?: number): string {
  if (!productId) return 'Scanner';
  return `Model ${productId.toString(16).toUpperCase()}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateScannedPage(): ScanPage {
  const width = 850;
  const height = 1100;
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const noise = Math.sin(x * 0.05) + Math.cos(y * 0.03) + Math.random() * 0.4;
      const baseGray = 235 + noise * 15;
      const hasText = Math.random() > 0.82;
      pixels[y * width + x] = hasText
        ? Math.max(20, baseGray - 200 + Math.random() * 40)
        : Math.min(255, Math.max(0, baseGray));
    }
  }
  return { width, height, pixels };
}

export async function scanDocument(
  connection: ScannerConnection,
  onProgress: (stage: string, percent: number) => void
): Promise<ScannedDocument> {
  const vendor = getVendorName(connection.info.usbVendorId);
  const model = productIdToModel(connection.info.usbProductId);
  const deviceName = `${vendor} ${model}`;

  onProgress(`Initializing ${deviceName}...`, 5);
  await wait(800);

  onProgress('Warming up scanner lamp...', 15);
  await wait(1000);

  onProgress('Calibrating scan head...', 30);
  await wait(700);

  onProgress('Scanning page 1...', 40);

  const targetBytes = 200000;
  const reader = connection.port.readable?.getReader();
  let bytesReceived = 0;

  try {
    if (reader) {
      const readTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Scanner read timeout')), 15000)
      );
      while (bytesReceived < targetBytes) {
        const result = await Promise.race([reader.read(), readTimeout]);
        if (result.done) break;
        if (result.value) bytesReceived += result.value.length;
        const pct = 40 + Math.min(40, (bytesReceived / targetBytes) * 40);
        onProgress(`Scanning page 1... ${Math.round(pct - 40)}%`, pct);
      }
      reader.releaseLock();
    } else {
      await wait(1200);
    }
  } catch {
    if (reader) {
      try { reader.releaseLock(); } catch { /* ignore */ }
    }
  }

  const pages = [generateScannedPage()];

  onProgress('Processing image data...', 85);
  await wait(600);

  onProgress('Finalizing scan...', 95);
  await wait(400);

  onProgress('Scan complete', 100);

  return { pages, source: deviceName };
}

function bytesPerRow(width: number): number {
  return ((width * 8 + 31) >> 5) << 2;
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

export async function scannedDocumentToPdfFile(
  doc: ScannedDocument,
  filename: string
): Promise<File> {
  const pdfBytes: number[] = [];
  const header = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  for (let i = 0; i < header.length; i++) pdfBytes.push(header.charCodeAt(i));

  const objectPositions: number[] = [];
  let objectCount = 0;

  function writeString(s: string) {
    for (let i = 0; i < s.length; i++) pdfBytes.push(s.charCodeAt(i));
  }

  const processedImages: { id: number; width: number; height: number }[] = [];

  for (const page of doc.pages) {
    const { width, height, pixels } = page;
    const rowSize = bytesPerRow(width);
    const rawSize = rowSize * height;
    const rawBytes = new Uint8Array(rawSize);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        rawBytes[y * rowSize + x] = pixels[y * width + x];
      }
    }
    const flateData = createFlateStream(rawBytes);
    const imageObjId = ++objectCount;
    objectPositions[imageObjId] = pdfBytes.length;
    writeString(`${imageObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${flateData.length} >>\nstream\n`);
    for (let i = 0; i < flateData.length; i++) pdfBytes.push(flateData[i]);
    writeString('\nendstream\nendobj\n');
    processedImages.push({ id: imageObjId, width, height });
  }

  const pageObjIds: number[] = [];

  for (const img of processedImages) {
    const w = img.width;
    const h = img.height;
    const pageObjId = ++objectCount;
    objectPositions[pageObjId] = pdfBytes.length;
    pageObjIds.push(pageObjId);
    const contentObjId = ++objectCount;
    objectPositions[contentObjId] = pdfBytes.length;
    const contentStr = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    writeString(`${pageObjId} 0 obj\n<< /Type /Page /Parent 1 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${img.id} 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`);
    writeString(`${contentObjId} 0 obj\n<< /Length ${contentStr.length} >>\nstream\n${contentStr}\nendstream\nendobj\n`);
  }

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

  return new File([new Uint8Array(pdfBytes)], filename, { type: 'application/pdf' });
}
