import zlib from 'node:zlib';

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
 * Unpacks a ZIP buffer (e.g. .pptx / .potx file) into a dictionary of file path -> Buffer/String.
 */
export function unpackZip(zipBuffer) {
  const files = {};
  let offset = 0;

  while (offset < zipBuffer.length - 30) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) {
      // Find next local file header signature if misaligned
      const nextSig = zipBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), offset + 1);
      if (nextSig === -1) break;
      offset = nextSig;
    }

    const method = zipBuffer.readUInt16LE(offset + 8);
    const compSize = zipBuffer.readUInt32LE(offset + 18);
    const uncompSize = zipBuffer.readUInt32LE(offset + 22);
    const nameLen = zipBuffer.readUInt16LE(offset + 26);
    const extraLen = zipBuffer.readUInt16LE(offset + 28);

    const fileName = zipBuffer.toString('utf8', offset + 30, offset + 30 + nameLen);
    const dataOffset = offset + 30 + nameLen + extraLen;

    if (dataOffset + compSize > zipBuffer.length) break;

    const compressedData = zipBuffer.subarray(dataOffset, dataOffset + compSize);
    let uncompressedData;

    if (method === 0) {
      uncompressedData = compressedData;
    } else if (method === 8) {
      try {
        uncompressedData = zlib.inflateRawSync(compressedData);
      } catch (err) {
        // Fallback for zlib header
        uncompressedData = zlib.inflateSync(compressedData);
      }
    } else {
      offset = dataOffset + compSize;
      continue;
    }

    // Don't record directory entries ending with /
    if (!fileName.endsWith('/')) {
      files[fileName] = uncompressedData;
    }

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
