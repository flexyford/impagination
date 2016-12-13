const { defineProperty, getOwnPropertyDescriptors } = Object;

export default function cached(constructor) {
  let prototype = constructor.prototype;

  eachProperty(getOwnPropertyDescriptors(prototype), function(key, descriptor) {
    if (descriptor.get) {
      defineProperty(prototype, key, {
        get() {
          let value = descriptor.get.call(this);
          let { writeable, enumerable } = descriptor;
          defineProperty(this, key, { value, writeable, enumerable });
          return value;
        }
      });
    }
  });
  return constructor;
}


function eachProperty(object, fn) {
  if (typeof object === 'object') {
    Object.keys(object).forEach(function(name) {
      fn(name, object[name]);
    });
  }
}
