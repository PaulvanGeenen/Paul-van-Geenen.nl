
import fs from 'fs';

// DICOM tags are stored as (group, element)
// (0008,103E) is Series Description
// We'll do a simple scan for the string "SeriesDescription" or just look for the tag (0008, 103E)
// DICOM files start with a 128-byte preamble followed by "DICM"

const buffer = fs.readFileSync('public/mri/SE000003/IM000001');

function findTag(buffer, group, element) {
    for (let i = 0; i < buffer.length - 8; i++) {
        if (buffer[i] === element && buffer[i+1] === group) {
            // Very simplified check, might not work if it's not Little Endian or if tag is split
        }
    }
}

// Just print the first 1024 bytes and see if there's any human readable text
console.log(buffer.toString('ascii', 0, 10000).replace(/[^\x20-\x7E]/g, '.'));
