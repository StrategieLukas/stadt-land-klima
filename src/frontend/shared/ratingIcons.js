export default {
  4: '/icons/icon_rating_4.svg',
  3: '/icons/icon_rating_3.svg',
  2: '/icons/icon_rating_2.svg',
  1: '/icons/icon_rating_1.svg',
  0: '/icons/icon_rating_0.svg',
  null: '/icons/icon_rating_na.svg',
};

export function ratingIndex(value) {
  // Yes we actually use "null" as an index here
  if (value === null) return null;
  const tempVal = Number(value);
  const isClose = (a, b) => Math.abs(a - b) < 0.001;

  if (isClose(tempVal, 0)) return 0;
  if (isClose(tempVal, 0.25)) return 1;
  if (isClose(tempVal, 0.5)) return 2;
  if (isClose(tempVal, 0.75)) return 3;
  return 4;
}
