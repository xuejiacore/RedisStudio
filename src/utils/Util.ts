export function toHexString(byteArray: Uint8Array | undefined): string {
    if (byteArray == undefined) {
        return '';
    }
    return Array.from(byteArray)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join(' ').toUpperCase();
}

export function timeUntil(timestamp: number): string {
    const now = Date.now(); // 当前时间的时间戳
    const diff = timestamp - now; // 计算时间差

    if (diff <= 0) {
        return "";
    }

    const msInSecond = 1000;
    const msInMinute = msInSecond * 60;
    const msInHour = msInMinute * 60;
    const msInDay = msInHour * 24;
    const msInMonth = msInDay * 30;
    const msInYear = msInDay * 365;

    if (diff > msInYear) {
        return `+${Math.floor(diff / msInYear)}y`;
    } else if (diff > msInMonth) {
        return `+${Math.floor(diff / msInMonth)}m`;
    } else if (diff > msInDay) {
        return `+${Math.floor(diff / msInDay)}d`;
    } else {
        return '';
    }
}