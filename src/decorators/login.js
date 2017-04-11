/**
 * @desc login decorator
 */
export default function login(imgcode){
    return function (target, key, descriptor) {
        const func = descriptor.value;
        descriptor.value = function () {
            let args = arguments;
            return this.login(imgcode).then(() => {
                return func.apply(this, args);
            });
        };
        return descriptor;
    };
}