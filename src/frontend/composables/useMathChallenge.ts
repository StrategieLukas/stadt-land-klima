import { z } from 'zod';

const Challenge = z.object({num1: z.number().int().min(10).max(19), num2: z.number().int().min(1).max(10), token: z.string().min(1).max(4096)});

export function useMathChallenge(purpose: 'contact' | 'register' | 'form' | 'article') {
  const {$t} = useNuxtApp();
  const mathChallenge = ref({num1: 0, num2: 0, token: ''});
  const mathChallengeAnswer = ref('');
  const mathChallengeError = ref('');
  async function loadMathChallenge() {
    mathChallengeAnswer.value = '';
    mathChallengeError.value = '';
    mathChallenge.value = {num1: 0, num2: 0, token: ''};
    try { mathChallenge.value = Challenge.parse(await $fetch('/api/math-challenge', {query: {purpose}})); }
    catch { mathChallengeError.value = $t('generic.technical_error'); }
  }
  function validateMathChallenge(): boolean {
    const answer = mathChallengeAnswer.value;
    const valid = Boolean(mathChallenge.value.token) && /^\d{1,3}$/.test(answer)
      && Number(answer) === mathChallenge.value.num1 + mathChallenge.value.num2;
    if (!valid) mathChallengeError.value = $t('captcha.incorrect_answer');
    return valid;
  }
  return {mathChallenge, mathChallengeAnswer, mathChallengeError, loadMathChallenge, validateMathChallenge};
}
