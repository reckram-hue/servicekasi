// Plain test script for src/lib/recurrence.ts and src/lib/holidays.ts.
// Run with: npm run test:recurrence
import assert from 'node:assert/strict';
import { buildRule, describeRule, isValidDateStr, occurrences, parseRule } from './recurrence.ts';
import { easterSunday, publicHolidayName } from './holidays.ts';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

function rule(result: { rule: string } | { error: string }): string {
  assert.ok('rule' in result, `expected a rule, got: ${JSON.stringify(result)}`);
  return result.rule;
}

// ───────────────────────── building rules ─────────────────────────
// 2026-09-29 is a Tuesday.

test('weekly takes its weekday from the first date', () => {
  assert.equal(rule(buildRule('WEEKLY', '2026-09-29')), 'FREQ=WEEKLY;BYDAY=TU');
});

test('fortnightly', () => {
  assert.equal(rule(buildRule('FORTNIGHTLY', '2026-09-29')), 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU');
});

test('monthly on a date from 1 to 28', () => {
  assert.equal(rule(buildRule('MONTHLY_DATE', '2026-10-15')), 'FREQ=MONTHLY;BYMONTHDAY=15');
});

test('monthly on the 31st of a 31-day month becomes "last day"', () => {
  assert.equal(rule(buildRule('MONTHLY_DATE', '2026-10-31')), 'FREQ=MONTHLY;BYMONTHDAY=-1');
});

test('monthly on the 30th of a 30-day month becomes "last day"', () => {
  assert.equal(rule(buildRule('MONTHLY_DATE', '2026-09-30')), 'FREQ=MONTHLY;BYMONTHDAY=-1');
});

test('monthly on 29–31 that is not the month end is refused', () => {
  assert.ok('error' in buildRule('MONTHLY_DATE', '2026-01-30'));
  assert.ok('error' in buildRule('MONTHLY_DATE', '2026-10-29'));
});

test('monthly on Feb 28 in a leap year is the 28th, not "last day"', () => {
  assert.equal(rule(buildRule('MONTHLY_DATE', '2028-02-28')), 'FREQ=MONTHLY;BYMONTHDAY=28');
  assert.equal(rule(buildRule('MONTHLY_DATE', '2028-02-29')), 'FREQ=MONTHLY;BYMONTHDAY=-1');
});

test('monthly on the nth weekday', () => {
  assert.equal(rule(buildRule('MONTHLY_WEEKDAY', '2026-10-13')), 'FREQ=MONTHLY;BYDAY=2TU'); // 2nd Tuesday
  assert.equal(rule(buildRule('MONTHLY_WEEKDAY', '2026-10-01')), 'FREQ=MONTHLY;BYDAY=1TH'); // 1st Thursday
});

test('a 5th weekday becomes "last"', () => {
  assert.equal(rule(buildRule('MONTHLY_WEEKDAY', '2026-10-30')), 'FREQ=MONTHLY;BYDAY=-1FR');
});

test('invalid first dates are refused', () => {
  assert.ok('error' in buildRule('WEEKLY', '2026-02-30'));
  assert.ok('error' in buildRule('WEEKLY', 'tomorrow'));
});

// ───────────────────────── parsing ─────────────────────────

test('unsupported or malformed rules are rejected, not half-supported', () => {
  for (const bad of [
    'FREQ=DAILY',
    'FREQ=YEARLY;BYMONTH=3',
    'FREQ=WEEKLY',
    'FREQ=WEEKLY;BYDAY=TU,TH',
    'FREQ=WEEKLY;INTERVAL=0;BYDAY=TU',
    'FREQ=WEEKLY;INTERVAL=1.5;BYDAY=TU',
    'FREQ=MONTHLY;BYMONTHDAY=31',
    'FREQ=MONTHLY;BYMONTHDAY=0',
    'FREQ=MONTHLY;BYMONTHDAY=15;BYDAY=1TU',
    'FREQ=MONTHLY;BYDAY=5TU',
    'FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1',
    'FREQ=WEEKLY;BYDAY=TU;COUNT=10',
    'FREQ=WEEKLY;FREQ=WEEKLY;BYDAY=TU',
    '',
    'garbage',
  ]) {
    assert.equal(parseRule(bad), null, bad);
    assert.deepEqual(occurrences(bad, '2026-09-29', '2026-09-29', '2026-12-31'), [], bad);
  }
});

test('describes rules in plain English', () => {
  assert.equal(describeRule('FREQ=WEEKLY;BYDAY=TU'), 'Every week on Tuesday');
  assert.equal(describeRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=FR'), 'Every 2 weeks on Friday');
  assert.equal(describeRule('FREQ=MONTHLY;BYMONTHDAY=1'), 'Monthly on the 1st');
  assert.equal(describeRule('FREQ=MONTHLY;BYMONTHDAY=12'), 'Monthly on the 12th');
  assert.equal(describeRule('FREQ=MONTHLY;BYMONTHDAY=22'), 'Monthly on the 22nd');
  assert.equal(describeRule('FREQ=MONTHLY;BYMONTHDAY=-1'), 'Monthly on the last day');
  assert.equal(describeRule('FREQ=MONTHLY;BYDAY=2TU'), 'Monthly on the 2nd Tuesday');
  assert.equal(describeRule('FREQ=MONTHLY;BYDAY=-1FR'), 'Monthly on the last Friday');
});

// ───────────────────────── weekly ─────────────────────────

test('weekly', () => {
  assert.deepEqual(occurrences('FREQ=WEEKLY;BYDAY=TU', '2026-09-29', '2026-09-29', '2026-10-27'), [
    '2026-09-29',
    '2026-10-06',
    '2026-10-13',
    '2026-10-20',
    '2026-10-27',
  ]);
});

test('fortnightly', () => {
  assert.deepEqual(occurrences('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', '2026-09-29', '2026-09-29', '2026-11-10'), [
    '2026-09-29',
    '2026-10-13',
    '2026-10-27',
    '2026-11-10',
  ]);
});

test('fortnightly keeps its rhythm when topped up from a later date', () => {
  // The top-up job asks "what's due from 1 Oct?" — must not restart the count.
  assert.deepEqual(occurrences('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', '2026-09-29', '2026-10-01', '2026-11-15'), [
    '2026-10-13',
    '2026-10-27',
    '2026-11-10',
  ]);
  // …and from a date that lands on an "off" week.
  assert.deepEqual(occurrences('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', '2026-09-29', '2026-10-19', '2026-10-31'), ['2026-10-27']);
});

test('fortnightly rhythm survives a year boundary', () => {
  const dates = occurrences('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', '2026-09-29', '2026-12-01', '2027-01-31');
  assert.deepEqual(dates, ['2026-12-08', '2026-12-22', '2027-01-05', '2027-01-19']);
});

test('RFC 5545: when the start is not on BYDAY, weeks still count from the start week', () => {
  // Start Wed 30 Sep: Tue 29 Sep (week 0) is before the start, week 1 is off → Tue 13 Oct.
  assert.deepEqual(occurrences('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', '2026-09-30', '2026-09-30', '2026-10-31'), [
    '2026-10-13',
    '2026-10-27',
  ]);
});

test('never returns dates before the series start', () => {
  assert.deepEqual(occurrences('FREQ=WEEKLY;BYDAY=TU', '2026-10-13', '2026-09-01', '2026-10-20'), ['2026-10-13', '2026-10-20']);
});

test('an empty or inverted range gives nothing', () => {
  assert.deepEqual(occurrences('FREQ=WEEKLY;BYDAY=TU', '2026-09-29', '2026-10-01', '2026-10-05'), []);
  assert.deepEqual(occurrences('FREQ=WEEKLY;BYDAY=TU', '2026-09-29', '2026-10-31', '2026-10-01'), []);
});

// ───────────────────────── monthly ─────────────────────────

test('monthly on a date, across a year end', () => {
  assert.deepEqual(occurrences('FREQ=MONTHLY;BYMONTHDAY=15', '2026-10-15', '2026-10-01', '2027-01-31'), [
    '2026-10-15',
    '2026-11-15',
    '2026-12-15',
    '2027-01-15',
  ]);
});

test('monthly on the last day handles 28/29/30/31-day months', () => {
  assert.deepEqual(occurrences('FREQ=MONTHLY;BYMONTHDAY=-1', '2027-01-31', '2027-01-01', '2027-05-31'), [
    '2027-01-31',
    '2027-02-28',
    '2027-03-31',
    '2027-04-30',
    '2027-05-31',
  ]);
  assert.deepEqual(occurrences('FREQ=MONTHLY;BYMONTHDAY=-1', '2028-01-31', '2028-02-01', '2028-02-29'), ['2028-02-29']);
});

test('monthly on the 2nd Tuesday', () => {
  assert.deepEqual(occurrences('FREQ=MONTHLY;BYDAY=2TU', '2026-10-13', '2026-10-01', '2026-12-31'), [
    '2026-10-13',
    '2026-11-10',
    '2026-12-08',
  ]);
});

test('monthly on the last Friday', () => {
  assert.deepEqual(occurrences('FREQ=MONTHLY;BYDAY=-1FR', '2026-10-30', '2026-10-01', '2027-01-31'), [
    '2026-10-30',
    '2026-11-27',
    '2026-12-25',
    '2027-01-29',
  ]);
});

test('monthly on the 1st weekday when the month starts on that weekday', () => {
  // 1 Dec 2026 is a Tuesday.
  assert.deepEqual(occurrences('FREQ=MONTHLY;BYDAY=1TU', '2026-11-03', '2026-12-01', '2026-12-31'), ['2026-12-01']);
});

test('monthly: the first month is skipped if its date is before the start', () => {
  assert.deepEqual(occurrences('FREQ=MONTHLY;BYMONTHDAY=5', '2026-10-20', '2026-10-01', '2026-12-31'), ['2026-11-05', '2026-12-05']);
});

test('date validation', () => {
  assert.ok(isValidDateStr('2028-02-29'));
  assert.ok(!isValidDateStr('2027-02-29'));
  assert.ok(!isValidDateStr('2026-13-01'));
  assert.ok(!isValidDateStr('2026-9-1'));
});

test('does not depend on the server time zone', () => {
  const before = process.env.TZ;
  const expected = occurrences('FREQ=MONTHLY;BYMONTHDAY=-1', '2027-01-31', '2027-01-01', '2027-03-31');
  for (const tz of ['Pacific/Kiritimati', 'America/Los_Angeles', 'UTC']) {
    process.env.TZ = tz;
    assert.deepEqual(occurrences('FREQ=MONTHLY;BYMONTHDAY=-1', '2027-01-31', '2027-01-01', '2027-03-31'), expected, tz);
  }
  process.env.TZ = before;
});

// ───────────────────────── SA public holidays ─────────────────────────

test('Easter Sunday', () => {
  assert.equal(easterSunday(2019), '2019-04-21');
  assert.equal(easterSunday(2024), '2024-03-31');
  assert.equal(easterSunday(2025), '2025-04-20');
  assert.equal(easterSunday(2026), '2026-04-05');
  assert.equal(easterSunday(2027), '2027-03-28');
});

test('Good Friday and Family Day move with Easter', () => {
  assert.equal(publicHolidayName('ZA', '2026-04-03'), 'Good Friday');
  assert.equal(publicHolidayName('ZA', '2026-04-06'), 'Family Day');
  assert.equal(publicHolidayName('ZA', '2027-03-26'), 'Good Friday');
  assert.equal(publicHolidayName('ZA', '2027-03-29'), 'Family Day');
});

test('fixed holidays', () => {
  assert.equal(publicHolidayName('ZA', '2026-09-24'), 'Heritage Day');
  assert.equal(publicHolidayName('ZA', '2026-12-16'), 'Day of Reconciliation');
  assert.equal(publicHolidayName('ZA', '2026-12-25'), 'Christmas Day');
});

test('a holiday on a Sunday makes the Monday a holiday', () => {
  assert.equal(publicHolidayName('ZA', '2026-08-10'), "National Women's Day (observed)"); // 9 Aug 2026 is a Sunday
  assert.equal(publicHolidayName('ZA', '2022-05-02'), "Workers' Day (observed)");
  assert.equal(publicHolidayName('ZA', '2021-12-27'), 'Day of Goodwill (observed)'); // Christmas Sat, Goodwill Sun
});

test('Christmas on a Sunday does not double-book the Monday', () => {
  assert.equal(publicHolidayName('ZA', '2022-12-26'), 'Day of Goodwill');
});

test('ordinary days and other countries are not flagged', () => {
  assert.equal(publicHolidayName('ZA', '2026-09-29'), null);
  assert.equal(publicHolidayName('ZA', '2026-08-11'), null);
  assert.equal(publicHolidayName('BW', '2026-12-25'), null);
});

console.log(`✓ all ${passed} recurrence/holiday tests passed`);
