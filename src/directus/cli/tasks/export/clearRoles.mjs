import clearDir from '../shared/clearDir.mjs';

async function clearRoles(dest, options = {verbose: false}) {
  try {
    clearDir(dest);

    if (options.verbose) {
      console.info(`${dest} cleared`);
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default clearRoles;
