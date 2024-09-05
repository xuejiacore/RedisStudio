export function toHexString(byteArray: Uint8Array | undefined): string {
    if (byteArray == undefined) {
        return '';
    }
    return Array.from(byteArray)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join(' ').toUpperCase();
}
