/**
 * @desc login decorator
 */
export function login(target, key, descriptor) {
  const func = descriptor.value;
  descriptor.value = function() {
    let args = arguments;
    return this.login().then(() => {
      return func.apply(this, args);
    });
  };
  return descriptor;
}
