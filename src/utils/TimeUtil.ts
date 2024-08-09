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
