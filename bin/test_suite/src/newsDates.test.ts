import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBerlinDateTime, formatBerlinDate, formatBerlinDateRange, getEventMonthKey, formatEventMonth } from '../../../src/frontend/shared/eventDateTime.js';

test('CMS wall-clock dates preserve feed order and milliseconds regardless of machine timezone', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Europe/Berlin', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = zone;
      assert.equal(parseBerlinDateTime('2026-05-27T12:00:00')?.toISOString(), '2026-05-27T10:00:00.000Z');
      assert.equal(parseBerlinDateTime('2026-12-27T12:00:00.123')?.toISOString(), '2026-12-27T11:00:00.123Z');
      assert.equal(parseBerlinDateTime('2026-05-27T12:00:00.000Z')?.toISOString(), '2026-05-27T12:00:00.000Z');
      const dates = ['2026-05-27T12:00:00', '2026-05-27T12:00:00.000Z'];
      dates.sort((a, b) => parseBerlinDateTime(b)!.getTime() - parseBerlinDateTime(a)!.getTime());
      assert.equal(dates[0], '2026-05-27T12:00:00.000Z');
    }
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});

test('Berlin date and month labels agree across midnight and daylight-saving transitions', () => {
  assert.equal(getEventMonthKey('2026-04-30T22:30:00Z'), '2026-05');
  assert.equal(formatEventMonth('2026-04-30T22:30:00Z'), 'Mai 2026');
  assert.equal(formatBerlinDate('2026-04-30T22:30:00Z'), '01. Mai 2026');
  assert.equal(parseBerlinDateTime('2026-03-29T01:30:00')?.toISOString(), '2026-03-29T00:30:00.000Z');
  assert.equal(parseBerlinDateTime('2026-03-29T03:30:00')?.toISOString(), '2026-03-29T01:30:00.000Z');
  assert.equal(parseBerlinDateTime('2026-10-25T03:30:00')?.toISOString(), '2026-10-25T02:30:00.000Z');
  assert.equal(parseBerlinDateTime('invalid'), null);
  assert.equal(formatBerlinDate(null), '');
});

test('news event date ranges retain compact German labels using Berlin calendar days', () => {
  assert.equal(formatBerlinDateRange('2026-05-01T00:00:00Z', '2026-05-02T00:00:00Z'), '1. – 02. Mai 2026');
  assert.equal(formatBerlinDateRange('2026-04-30T22:30:00Z', '2026-05-01T10:00:00Z'), '01. Mai 2026');
  assert.equal(formatBerlinDateRange('2026-05-01T00:00:00Z', '2026-06-02T00:00:00Z'), '01. Mai – 02. Juni 2026');
  assert.equal(formatBerlinDateRange('2026-12-01T00:00:00Z', '2027-01-02T00:00:00Z'), '01. Dezember 2026 – 02. Januar 2027');
});
