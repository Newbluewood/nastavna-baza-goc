module.exports = {
  formatDate: (date, lang = 'sr') => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  },
  isAfterDays: (date, days) => {
    const rawDate = date instanceof Date
      ? new Date(date)
      : (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
          ? new Date(`${date}T12:00:00`)
          : new Date(date));

    if (!(rawDate instanceof Date) || Number.isNaN(rawDate.getTime())) {
      return false;
    }

    const checkIn = rawDate;
    checkIn.setHours(12, 0, 0, 0);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const daysUntil = Math.round((checkIn - today) / (1000 * 60 * 60 * 24));
    return daysUntil >= days;
  },
  parseDate: (dateString) => {
    return new Date(dateString);
  },
  addDays: (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },
  isValidDate: (dateString) => {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  },
  daysBetween: (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
};