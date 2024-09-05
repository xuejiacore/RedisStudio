function padZero(num: number): string {
    return num.toString().padStart(2, '0'); // 使用 padStart 方法在数字前面填充 0，以确保始终为两位数
}

export function formatTimestamp(timestamp: number, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    const date = new Date(timestamp * 1000); // JavaScript 时间戳是以毫秒为单位的，所以需要乘以 1000

    const year = date.getFullYear();
    const month = padZero(date.getMonth() + 1); // 月份是从 0 开始的，所以需要加 1
    const day = padZero(date.getDate());
    const hours = padZero(date.getHours());
    const minutes = padZero(date.getMinutes());
    const seconds = padZero(date.getSeconds());

    return format
        .replace('YYYY', year.toString())
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
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
