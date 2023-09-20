import {
  Chart,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  RadialLinearScale,
} from 'chart.js';
export default defineNuxtPlugin(() => {
  Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, RadialLinearScale, ArcElement);
});
