import rating4 from '@/assets/icons/icon_rating_4.svg'
import rating3 from '@/assets/icons/icon_rating_3.svg'
import rating2 from '@/assets/icons/icon_rating_2.svg'
import rating1 from '@/assets/icons/icon_rating_1.svg'
import rating0 from '@/assets/icons/icon_rating_0.svg'
import ratingNa from '@/assets/icons/icon_rating_na.svg'

export default {
  4: rating4,
  3: rating3,
  2: rating2,
  1: rating1,
  0: rating0,
  null: ratingNa,
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
