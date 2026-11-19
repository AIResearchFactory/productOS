import zlib from 'node:zlib';
import { isSafeKey } from './safe-json.mjs';

export const MAX_ZIP_ENTRIES = 500;
export const MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES = 20 * 1024 * 1024; // 20 MB per entry
export const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 100 * 1024 * 1024; // 100 MB total
export const MAX_ZIP_COMPRESSION_RATIO = 100;

function isSafeZipEntryPath(entryName) {
  if (typeof entryName !== 'string' || !entryName || entryName.includes('\0')) {
    return false;
  }
  if (entryName.startsWith('/') || entryName.startsWith('\\') || /^[a-zA-Z]:/.test(entryName)) {
    return false;
  }
  const segments = entryName.split(/[\\/]/).filter(Boolean);
  if (segments.some((seg) => seg === '..' || !isSafeKey(seg))) {
    return false;
  }
  if (!isSafeKey(entryName)) {
    return false;
  }
  return true;
}

/**
 * Computes CRC-32 for buffer data.
 */
const CRC32_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[n] = c >>> 0;
}

export function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Unpacks a ZIP buffer (e.g. .pptx / .potx file) into a prototype-free dictionary of file path -> Buffer.
 * Enforces entry count, size, compression ratio, path traversal, and CRC-32 checks.
 */
export function unpackZip(zipBuffer, options = {}) {
  const maxEntries = options.maxEntries ?? MAX_ZIP_ENTRIES;
  const maxEntryBytes = options.maxEntryBytes ?? MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES;
  const maxRatio = options.maxCompressionRatio ?? MAX_ZIP_COMPRESSION_RATIO;

  const files = Object.create(null);
  let offset = 0;
  let entryCount = 0;
  let totalUncompressedBytes = 0;

  while (offset <= zipBuffer.length - 30) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) {
      // Find next local file header signature if misaligned
      const nextSig = zipBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), offset + 1);
      if (nextSig === -1 || nextSig > zipBuffer.length - 30) break;
      offset = nextSig;
    }

    const flags = zipBuffer.readUInt16LE(offset + 6);
    const method = zipBuffer.readUInt16LE(offset + 8);
    const crcExpected = zipBuffer.readUInt32LE(offset + 14);
    const compSize = zipBuffer.readUInt32LE(offset + 18);
    const uncompSize = zipBuffer.readUInt32LE(offset + 22);
    const nameLen = zipBuffer.readUInt16LE(offset + 26);
    const extraLen = zipBuffer.readUInt16LE(offset + 28);

    const nameStart = offset + 30;
    const dataOffset = nameStart + nameLen + extraLen;
    if (nameStart + nameLen > zipBuffer.length || dataOffset > zipBuffer.length || dataOffset + compSize > zipBuffer.length) {
      break;
    }

    const fileName = zipBuffer.toString('utf8', nameStart, nameStart + nameLen);

    if (uncompSize > maxEntryBytes) {
      throw new Error(`ZIP entry "${fileName}" declares uncompressed size (${uncompSize}) exceeding limit (${maxEntryBytes})`);
    }
    if (uncompSize > 65536 && compSize > 0 && uncompSize / compSize > maxRatio) {
      throw new Error(`ZIP entry "${fileName}" exceeds maximum compression ratio (${maxRatio}x)`);
    }

    // Don't record directory entries ending with /
    if (fileName.endsWith('/')) {
      offset = dataOffset + compSize;
      continue;
    }

    if (!isSafeZipEntryPath(fileName)) {
      throw new Error(`Unsafe ZIP entry path rejected: "${fileName}"`);
    }

    entryCount++;
    if (entryCount > maxEntries) {
      throw new Error(`ZIP archive exceeds maximum entry count (${maxEntries})`);
    }

    const compressedData = zipBuffer.subarray(dataOffset, dataOffset + compSize);
    let uncompressedData;

    if (method === 0) {
      uncompressedData = compressedData;
    } else if (method === 8) {
      try {
        uncompressedData = zlib.inflateRawSync(compressedData, { maxOutputLength: maxEntryBytes });
      } catch (err) {
        if (err?.code === 'ERR_BUFFER_TOO_LARGE') {
          throw new Error(`ZIP entry "${fileName}" exceeds uncompressed size limit (${maxEntryBytes})`);
        }
        // Fallback for zlib header
        try {
          uncompressedData = zlib.inflateSync(compressedData, { maxOutputLength: maxEntryBytes });
        } catch (innerErr) {
          if (innerErr?.code === 'ERR_BUFFER_TOO_LARGE') {
            throw new Error(`ZIP entry "${fileName}" exceeds uncompressed size limit (${maxEntryBytes})`);
          }
          throw innerErr;
        }
      }
    } else {
      offset = dataOffset + compSize;
      continue;
    }

    if (uncompressedData.length > maxEntryBytes) {
      throw new Error(`ZIP entry "${fileName}" exceeds uncompressed size limit (${maxEntryBytes})`);
    }
    if (uncompressedData.length > 65536 && uncompressedData.length / Math.max(compSize, 1) > maxRatio) {
      throw new Error(`ZIP entry "${fileName}" exceeds compression ratio limit (${maxRatio}x)`);
    }

    totalUncompressedBytes += uncompressedData.length;
    if (totalUncompressedBytes > maxTotalBytes) {
      throw new Error(`ZIP archive exceeds total uncompressed size limit (${maxTotalBytes})`);
    }

    // Verify CRC-32 when header CRC is authoritative (bit 3 data-descriptor flag unset)
    if ((flags & 0x08) === 0) {
      const actualCrc = crc32(uncompressedData);
      if (actualCrc !== crcExpected) {
        throw new Error(`ZIP CRC-32 mismatch for entry "${fileName}"`);
      }
    }

    files[fileName] = uncompressedData;
    offset = dataOffset + compSize;
  }

  return files;
}

/**
 * Packs a dictionary of file path -> Buffer/String into a valid ZIP buffer.
 */
export function packZip(files) {
  const localHeaders = [];
  const cdHeaders = [];
  let currentOffset = 0;

  for (const [fileName, rawContent] of Object.entries(files)) {
    const fileBuf = Buffer.isBuffer(rawContent) ? rawContent : Buffer.from(String(rawContent), 'utf8');
    const fileNameBuf = Buffer.from(fileName, 'utf8');

    const uncompSize = fileBuf.length;
    const crc = crc32(fileBuf);
    const compressedData = zlib.deflateRawSync(fileBuf);
    const compSize = compressedData.length;

    // Local Header (30 bytes + nameLen + data)
    const localHeader = Buffer.alloc(30 + fileNameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed (2.0)
    localHeader.writeUInt16LE(0, 6);          // General flag
    localHeader.writeUInt16LE(8, 8);          // Compression method (Deflate)
    localHeader.writeUInt16LE(0, 10);         // Last mod time
    localHeader.writeUInt16LE(0, 12);         // Last mod date
    localHeader.writeUInt32LE(crc, 14);       // CRC32
    localHeader.writeUInt32LE(compSize, 18);  // Compressed size
    localHeader.writeUInt32LE(uncompSize, 22);// Uncompressed size
    localHeader.writeUInt16LE(fileNameBuf.length, 26); // Filename length
    localHeader.writeUInt16LE(0, 28);         // Extra field length
    fileNameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, compressedData);

    // Central Directory Header (46 bytes + nameLen)
    const cdHeader = Buffer.alloc(46 + fileNameBuf.length);
    cdHeader.writeUInt32LE(0x02014b50, 0);   // Central directory signature
    cdHeader.writeUInt16LE(20, 4);           // Version made by
    cdHeader.writeUInt16LE(20, 6);           // Version needed
    cdHeader.writeUInt16LE(0, 8);            // Flags
    cdHeader.writeUInt16LE(8, 10);           // Compression method
    cdHeader.writeUInt16LE(0, 12);           // Mod time
    cdHeader.writeUInt16LE(0, 14);           // Mod date
    cdHeader.writeUInt32LE(crc, 16);         // CRC32
    cdHeader.writeUInt32LE(compSize, 20);    // Compressed size
    cdHeader.writeUInt32LE(uncompSize, 24);  // Uncompressed size
    cdHeader.writeUInt16LE(fileNameBuf.length, 28); // Filename length
    cdHeader.writeUInt16LE(0, 30);           // Extra field len
    cdHeader.writeUInt16LE(0, 32);           // Comment len
    cdHeader.writeUInt16LE(0, 34);           // Disk num start
    cdHeader.writeUInt16LE(0, 36);           // Internal attrs
    cdHeader.writeUInt32LE(0, 38);           // External attrs
    cdHeader.writeUInt32LE(currentOffset, 42); // Relative offset of local header
    fileNameBuf.copy(cdHeader, 46);

    cdHeaders.push(cdHeader);

    currentOffset += localHeader.length + compressedData.length;
  }

  const cdBuffer = Buffer.concat(cdHeaders);
  const cdOffset = currentOffset;
  const cdSize = cdBuffer.length;
  const entryCount = Object.keys(files).length;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4);          // Disk number
  eocd.writeUInt16LE(0, 6);          // Disk with CD
  eocd.writeUInt16LE(entryCount, 8); // Entries on this disk
  eocd.writeUInt16LE(entryCount, 10);// Total entries
  eocd.writeUInt32LE(cdSize, 12);    // Size of central directory
  eocd.writeUInt32LE(cdOffset, 16);  // Offset of central directory
  eocd.writeUInt16LE(0, 20);         // Comment length

  return Buffer.concat([...localHeaders, cdBuffer, eocd]);
}
