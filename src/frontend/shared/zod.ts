/** Browser builds must never probe Function/eval under the enforced CSP. */
import {z} from 'zod/v4';
z.config({jitless: true});
export * from 'zod/v4';
export {default} from 'zod/v4';
