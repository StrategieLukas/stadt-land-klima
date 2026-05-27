declare module 'slugify' {
  interface SlugifyOptions {
    replacement?: string;
    lower?: boolean;
    strict?: boolean;
    locale?: string;
    trim?: boolean;
  }

  function slugify(input: string, options?: SlugifyOptions): string;

  export = slugify;
}
