export function toHexString(byteArray: Uint8Array | undefined): string {
    if (byteArray == undefined) {
        return '';
    }
    return Array.from(byteArray)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join(' ').toUpperCase();
}

export function humanNumber(num: number): string {
    if (num >= 1e9) {
        return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (num >= 1e6) {
        return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1e3) {
        return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
}