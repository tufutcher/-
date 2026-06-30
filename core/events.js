export const events = {
  _listeners: {},
  on(name, fn){
    (this._listeners[name] ||= []).push(fn);
  },
  emit(name, payload){
    (this._listeners[name] || []).forEach(fn => fn(payload));
  }
};
