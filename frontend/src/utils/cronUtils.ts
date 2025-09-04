export interface CronPreset {
  label: string;
  description: string;
  expression: string;
  icon: string;
}

export const CRON_PRESETS: CronPreset[] = [
  {
    label: 'Daily at 2 AM',
    description: 'Every day at 2:00 AM',
    expression: '0 2 * * *',
    icon: '🌙',
  },
  {
    label: 'Daily at 8 AM',
    description: 'Every day at 8:00 AM',
    expression: '0 8 * * *',
    icon: '🌅',
  },
  {
    label: 'Weekdays at 6 PM',
    description: 'Monday to Friday at 6:00 PM',
    expression: '0 18 * * 1-5',
    icon: '🏢',
  },
  {
    label: 'Weekly on Sunday',
    description: 'Every Sunday at midnight',
    expression: '0 0 * * 0',
    icon: '📅',
  },
  {
    label: 'Monthly on 1st',
    description: 'First day of each month at midnight',
    expression: '0 0 1 * *',
    icon: '📆',
  },
  {
    label: 'Every 6 hours',
    description: 'Every 6 hours starting at midnight',
    expression: '0 */6 * * *',
    icon: '⏰',
  },
  {
    label: 'Twice daily',
    description: 'Every day at 6 AM and 6 PM',
    expression: '0 6,18 * * *',
    icon: '🔄',
  },
];

export const translateCronExpression = (cronExpression: string): string => {
  if (!cronExpression || !cronExpression.trim()) {
    return 'Invalid cron expression';
  }

  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return 'Invalid cron format (should be: minute hour day month weekday)';
  }

  const [minute, hour, day, month, weekday] = parts;

  try {
    // Check for preset matches first
    const preset = CRON_PRESETS.find((p) => p.expression === cronExpression);
    if (preset) {
      return preset.description;
    }

    // Build human readable description
    let description = '';

    // Handle frequency
    if (minute === '0' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
      // Daily at specific hour
      const hourNum = parseInt(hour);
      const time = formatTime(hourNum, 0);
      description = `Daily at ${time}`;
    } else if (minute === '0' && hour === '0' && day === '*' && month === '*' && weekday !== '*') {
      // Weekly on specific day
      const dayName = parseDayOfWeek(weekday);
      description = `Weekly on ${dayName} at midnight`;
    } else if (minute === '0' && hour === '0' && day !== '*' && month === '*' && weekday === '*') {
      // Monthly on specific day
      description = `Monthly on the ${day}${getOrdinalSuffix(parseInt(day))} at midnight`;
    } else if (
      minute === '0' &&
      hour.includes('*/') &&
      day === '*' &&
      month === '*' &&
      weekday === '*'
    ) {
      // Every X hours
      const interval = hour.replace('*/', '');
      description = `Every ${interval} hours`;
    } else if (minute !== '*' && hour !== '*' && day === '*' && month === '*' && weekday !== '*') {
      // Specific days of week at specific time
      const hourNum = parseInt(hour);
      const minNum = parseInt(minute);
      const time = formatTime(hourNum, minNum);
      const days = parseDayOfWeek(weekday);
      description = `${days} at ${time}`;
    } else if (minute !== '*' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
      // Daily at specific time
      const hourNum = parseInt(hour);
      const minNum = parseInt(minute);
      const time = formatTime(hourNum, minNum);
      description = `Daily at ${time}`;
    } else {
      // Complex expression - show basic format
      const timeStr =
        minute !== '*' || hour !== '*' ? ` at ${hour}:${minute.padStart(2, '0')}` : '';
      const dayStr = day !== '*' ? ` on day ${day}` : '';
      const monthStr = month !== '*' ? ` in month ${month}` : '';
      const weekdayStr = weekday !== '*' ? ` on ${parseDayOfWeek(weekday)}` : '';

      description = `Custom schedule${timeStr}${dayStr}${monthStr}${weekdayStr}`;
    }

    return description || 'Custom cron expression';
  } catch (error) {
    return 'Invalid cron expression';
  }
};

const formatTime = (hour: number, minute: number): string => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMinute = minute === 0 ? '' : `:${minute.toString().padStart(2, '0')}`;
  return `${displayHour}${displayMinute} ${period}`;
};

const parseDayOfWeek = (weekday: string): string => {
  const dayMap: { [key: string]: string } = {
    '0': 'Sunday',
    '1': 'Monday',
    '2': 'Tuesday',
    '3': 'Wednesday',
    '4': 'Thursday',
    '5': 'Friday',
    '6': 'Saturday',
    '7': 'Sunday', // Some systems use 7 for Sunday
    '1-5': 'Weekdays (Mon-Fri)',
    '6,0': 'Weekends',
    '0,6': 'Weekends',
  };

  return dayMap[weekday] || `Day ${weekday}`;
};

const getOrdinalSuffix = (num: number): string => {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
};

export const validateCronExpression = (
  cronExpression: string
): { isValid: boolean; error?: string } => {
  if (!cronExpression || !cronExpression.trim()) {
    return { isValid: false, error: 'Cron expression is required' };
  }

  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return {
      isValid: false,
      error: 'Cron expression must have 5 parts: minute hour day month weekday',
    };
  }

  // Basic validation for each part
  const [minute, hour, day, month, weekday] = parts;

  if (!isValidCronPart(minute, 0, 59)) {
    return { isValid: false, error: 'Invalid minute (0-59)' };
  }
  if (!isValidCronPart(hour, 0, 23)) {
    return { isValid: false, error: 'Invalid hour (0-23)' };
  }
  if (!isValidCronPart(day, 1, 31)) {
    return { isValid: false, error: 'Invalid day (1-31)' };
  }
  if (!isValidCronPart(month, 1, 12)) {
    return { isValid: false, error: 'Invalid month (1-12)' };
  }
  if (!isValidCronPart(weekday, 0, 7)) {
    return { isValid: false, error: 'Invalid weekday (0-7, where 0 and 7 are Sunday)' };
  }

  return { isValid: true };
};

const isValidCronPart = (part: string, min: number, max: number): boolean => {
  if (part === '*') return true;

  // Handle ranges like 1-5
  if (part.includes('-')) {
    const [start, end] = part.split('-').map(Number);
    return start >= min && end <= max && start <= end;
  }

  // Handle lists like 1,3,5
  if (part.includes(',')) {
    const nums = part.split(',').map(Number);
    return nums.every((num) => num >= min && num <= max);
  }

  // Handle step values like */6
  if (part.includes('/')) {
    const [range, step] = part.split('/');
    const stepNum = Number(step);
    return stepNum > 0 && (range === '*' || isValidCronPart(range, min, max));
  }

  // Handle single number
  const num = Number(part);
  return !isNaN(num) && num >= min && num <= max;
};
