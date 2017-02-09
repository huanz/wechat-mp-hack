const Log = {
    info(e) {
        console.log(`\x1b[34m${JSON.stringify(e)}\x1b[0m`);
    },
    error(e) {
        console.error(`\x1b[31m${JSON.stringify(e)}\x1b[0m`);
    }
};

export default Log;