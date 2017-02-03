export function info(e) {
    console.log(`\x1b[34m${JSON.stringify(e)}\x1b[0m`);
}

export function error(e) {
    console.error(`\x1b[31m${JSON.stringify(e)}\x1b[0m`);
}